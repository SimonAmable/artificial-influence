import "server-only"

import Replicate from "replicate"
import { fal } from "@fal-ai/client"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getCarouselFalQualityParams,
  getCarouselReplicateResolution,
} from "@/lib/carousel-shots/quality"
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
import { applyMinimalReplicateImageModeration } from "@/lib/server/minimal-moderation"
import { formatFalClientError } from "@/lib/server/fal-client-error"
import {
  buildFalImageRequest,
  configureFal,
  isSupportedFalImageModel,
  submitFalImageQueue,
} from "@/lib/server/fal-image"
import { uploadPreparedGeneratedImage } from "@/lib/server/store-generated-image"
import { buildReplicateReferenceImageInput } from "@/lib/utils/model-parameters"

const FAL_POLL_INTERVAL_MS = 2000
const FAL_MAX_WAIT_MS = 5 * 60 * 1000

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function extractFalImageUrls(data: unknown): string[] {
  if (!data || typeof data !== "object") return []
  const images = (data as { images?: Array<{ url?: string }> }).images ?? []
  return images
    .map((image) => (typeof image?.url === "string" ? image.url : null))
    .filter((url): url is string => Boolean(url))
}

async function waitForFalImageUrl(endpointId: string, requestId: string): Promise<string> {
  configureFal()
  const startedAt = Date.now()

  while (Date.now() - startedAt < FAL_MAX_WAIT_MS) {
    const queueStatus = await fal.queue.status(endpointId, { requestId })
    const status = queueStatus.status as string

    if (status === "IN_QUEUE" || status === "IN_PROGRESS") {
      await sleep(FAL_POLL_INTERVAL_MS)
      continue
    }

    if (status !== "COMPLETED") {
      throw new Error(`Fal generation failed with status: ${status}`)
    }

    const result = await fal.queue.result(endpointId, { requestId })
    const urls = extractFalImageUrls(result.data)
    if (urls.length === 0) {
      throw new Error("Fal generation returned no image URLs")
    }
    return urls[0]!
  }

  throw new Error("Fal generation timed out")
}

async function generatePhotodumpImageUrl(options: {
  aspectRatio: string
  model: PhotodumpModelId
  prompt: string
  referenceImageUrls: string[]
}): Promise<string> {
  if (isSupportedFalImageModel(options.model)) {
    const qualityParams = getCarouselFalQualityParams("hd", options.model)

    const falRequest = buildFalImageRequest({
      aspectRatio: options.aspectRatio,
      enableSafetyChecker: false,
      modelIdentifier: options.model,
      numImages: 1,
      outputFormat: "png",
      prompt: options.prompt,
      referenceImageUrls: options.referenceImageUrls,
      ...qualityParams,
    })

    const { endpointId, requestId } = await submitFalImageQueue(
      falRequest.endpointId,
      falRequest.input,
    )

    try {
      return await waitForFalImageUrl(endpointId, requestId)
    } catch (error) {
      throw new Error(formatFalClientError(error))
    }
  }

  if (options.model === "google/nano-banana-2") {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error("REPLICATE_API_TOKEN is not configured.")
    }

    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
    const referenceInput = buildReplicateReferenceImageInput(
      options.model,
      options.referenceImageUrls,
    )

    const replicateInput: Record<string, unknown> = {
      prompt: options.prompt,
      aspect_ratio: options.aspectRatio,
      resolution: getCarouselReplicateResolution("hd", options.model),
      output_format: "png",
      google_search: true,
      image_search: true,
      ...referenceInput.input,
    }
    applyMinimalReplicateImageModeration(options.model, replicateInput)

    const output: unknown = await replicate.run(options.model, {
      input: replicateInput,
      wait: { mode: "poll", interval: 2000 },
    })

    if (typeof output === "string" && output.startsWith("http")) {
      return output
    }

    if (Array.isArray(output) && typeof output[0] === "string") {
      return output[0]
    }

    if (output && typeof output === "object" && "url" in output) {
      const url = (output as { url?: string | (() => string) }).url
      if (typeof url === "function") return url()
      if (typeof url === "string") return url
    }

    throw new Error("Replicate returned no image URL")
  }

  throw new Error(`Unsupported photodump model: ${options.model}`)
}

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
    const remoteUrl = await generatePhotodumpImageUrl({
      aspectRatio: input.aspectRatio,
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
