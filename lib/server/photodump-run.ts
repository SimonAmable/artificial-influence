import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { checkUserHasCredits, deductUserCredits } from "@/lib/credits"
import {
  buildImagePricingParameters,
  resolveGenerationPricingQuote,
} from "@/lib/generation-pricing"
import { PHOTODUMP_TOOL } from "@/lib/photodump/constants"
import { getPhotodumpPackById, getPhotodumpShotBriefs } from "@/lib/photodump/packs"
import { buildPhotodumpShotPrompt } from "@/lib/photodump/prompt"
import { getPhotodumpQualityParams } from "@/lib/photodump/quality"
import type {
  PhotodumpAspectRatio,
  PhotodumpMetadata,
  PhotodumpModelId,
} from "@/lib/photodump/types"
import { getAutoStripImageMetadata } from "@/lib/server/auto-strip-image-metadata"
import { generateShotsModelImageUrl } from "@/lib/server/shots-image-url"
import { uploadPreparedGeneratedImage } from "@/lib/server/store-generated-image"

async function downloadImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download generated image (${response.status})`)
  }
  return Buffer.from(await response.arrayBuffer())
}

export type RunPhotodumpGenerationInput = {
  aspectRatio: PhotodumpAspectRatio
  aestheticReferenceImageUrls: string[]
  aestheticReferenceStoragePaths: string[]
  model: PhotodumpModelId
  note?: string | null
  packId: string
  packName: string
  packStyleLine: string
  referenceImageStoragePaths: string[]
  referenceImageUrls: string[]
  shotCount: number
  supabase: SupabaseClient
  userId: string
  usesAestheticReferences: boolean
}

export type RunPhotodumpGenerationResult = {
  generationId: string
  metadata: PhotodumpMetadata
  prompt: string
}

async function resolvePricingQuote(
  supabase: SupabaseClient,
  model: PhotodumpModelId,
  outputCount: number,
) {
  const { data: modelData, error: modelError } = await supabase
    .from("models")
    .select("identifier, name, model_cost, pricing_config, type")
    .eq("identifier", model)
    .eq("type", "image")
    .eq("is_active", true)
    .single()

  if (modelError || !modelData) {
    throw new Error(`Model "${model}" not found or is inactive`)
  }

  const pricingParams = buildImagePricingParameters(getPhotodumpQualityParams(model))

  const pricingQuote = resolveGenerationPricingQuote({
    model: {
      identifier: model,
      type: "image",
      model_cost: modelData.model_cost,
      pricing_config: modelData.pricing_config,
    },
    parameters: pricingParams,
    outputCount,
  })

  return pricingQuote
}

export async function runPhotodumpGeneration(
  input: RunPhotodumpGenerationInput,
): Promise<RunPhotodumpGenerationResult> {
  const pack = getPhotodumpPackById(input.packId)
  if (!pack) {
    throw new Error(`Unknown photodump preset: ${input.packId}`)
  }

  const shotBriefs = getPhotodumpShotBriefs(pack, input.shotCount)

  const prompts = shotBriefs.map((shotBrief, index) =>
    buildPhotodumpShotPrompt({
      shotBrief,
      shotIndex: index,
      shotCount: input.shotCount,
      note: input.note,
      usesAestheticReferences: input.usesAestheticReferences,
    }),
  )
  const combinedPrompt = prompts.join("\n\n")

  const pricingQuote = await resolvePricingQuote(input.supabase, input.model, input.shotCount)
  const requiredCredits = pricingQuote.quotedCredits
  const hasCredits = await checkUserHasCredits(input.userId, requiredCredits, input.supabase)
  if (!hasCredits) {
    const error = new Error(
      `Insufficient credits. This generation requires ${requiredCredits} credits.`,
    )
    error.name = "InsufficientCreditsError"
    throw error
  }

  const referenceImageUrls = [
    ...input.referenceImageUrls,
    ...input.aestheticReferenceImageUrls,
  ]

  const autoStrip = await getAutoStripImageMetadata(input.supabase, input.userId)
  const shots: PhotodumpMetadata["shots"] = []

  for (let index = 0; index < input.shotCount; index += 1) {
    const prompt = prompts[index]!
    const remoteUrl = await generateShotsModelImageUrl({
      aspectRatio: input.aspectRatio,
      generationMode: "hd",
      model: input.model,
      prompt,
      referenceImageUrls,
    })
    const buffer = await downloadImageBuffer(remoteUrl)
    const stored = await uploadPreparedGeneratedImage({
      autoStrip,
      buffer,
      index: index + 1,
      mimeType: "image/png",
      modelIdentifier: input.model,
      supabase: input.supabase,
      userId: input.userId,
    })

    shots.push({
      id: crypto.randomUUID(),
      url: stored.url,
      storagePath: stored.storagePath,
      index,
      shotBrief: shotBriefs[index] ?? "",
    })
  }

  const metadata: PhotodumpMetadata = {
    kind: "photodump",
    presetId: input.packId,
    presetName: input.packName,
    shots,
    shotCount: input.shotCount,
    aspectRatio: input.aspectRatio,
    model: input.model,
    referenceImageStoragePaths: input.referenceImageStoragePaths,
    aestheticReferenceStoragePaths:
      input.aestheticReferenceStoragePaths.length > 0
        ? input.aestheticReferenceStoragePaths
        : null,
    note: input.note?.trim() || null,
  }

  const { data: generation, error: insertError } = await input.supabase
    .from("generations")
    .insert({
      user_id: input.userId,
      prompt: combinedPrompt,
      supabase_storage_path: shots[0]?.storagePath ?? null,
      reference_images_supabase_storage_path: [
        ...input.referenceImageStoragePaths,
        ...input.aestheticReferenceStoragePaths,
      ],
      aspect_ratio: input.aspectRatio,
      model: input.model,
      type: "image",
      is_public: true,
      tool: PHOTODUMP_TOOL,
      status: "completed",
      metadata,
      quoted_credits: requiredCredits,
      pricing_snapshot: pricingQuote.pricingSnapshot,
      finished_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (insertError || !generation) {
    throw new Error(insertError?.message ?? "Failed to save photodump generation")
  }

  await deductUserCredits(input.userId, requiredCredits, input.supabase)

  return {
    generationId: generation.id,
    metadata,
    prompt: combinedPrompt,
  }
}
