import "server-only"

import Replicate from "replicate"
import { fal } from "@fal-ai/client"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  computeContactSheetLayout,
  getTargetPanelLongEdgeForModel,
} from "@/lib/carousel-shots/contact-sheet"
import {
  buildCarouselHdShotPrompt,
  buildCarouselShotsPrompt,
} from "@/lib/carousel-shots/prompt"
import type {
  CarouselGenerationMode,
  CarouselGridSize,
  CarouselPanelAspectRatio,
  CarouselShotsMetadata,
  CarouselShotsModelId,
  CarouselVariationStrength,
} from "@/lib/carousel-shots/types"
import { CAROUSEL_SHOTS_TOOL } from "@/lib/carousel-shots/constants"
import {
  getCarouselFalQualityParams,
  getCarouselGenerationQualityParams,
  getCarouselReplicateResolution,
} from "@/lib/carousel-shots/quality"
import { checkUserHasCredits, deductUserCredits } from "@/lib/credits"
import {
  buildImagePricingParameters,
  resolveGenerationPricingQuote,
} from "@/lib/generation-pricing"
import { getAutoStripImageMetadata } from "@/lib/server/auto-strip-image-metadata"
import { applyMinimalReplicateImageModeration } from "@/lib/server/minimal-moderation"
import { formatFalClientError } from "@/lib/server/fal-client-error"
import {
  buildFalImageRequest,
  configureFal,
  isSupportedFalImageModel,
  submitFalImageQueue,
} from "@/lib/server/fal-image"
import { splitContactSheet } from "@/lib/server/split-contact-sheet"
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

async function generateImageUrl(options: {
  aspectRatio: string
  generationMode: CarouselGenerationMode
  model: CarouselShotsModelId
  prompt: string
  referenceImageUrls: string[]
}): Promise<string> {
  if (isSupportedFalImageModel(options.model)) {
    const qualityParams = getCarouselFalQualityParams(options.generationMode, options.model)

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
      resolution: getCarouselReplicateResolution(options.generationMode, options.model),
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

  throw new Error(`Unsupported carousel shots model: ${options.model}`)
}

async function downloadImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download generated image (${response.status})`)
  }
  return Buffer.from(await response.arrayBuffer())
}

export type RunCarouselShotsGenerationInput = {
  aspectRatio: CarouselPanelAspectRatio
  generationMode: CarouselGenerationMode
  gridSize?: CarouselGridSize
  shotCount: number
  model: CarouselShotsModelId
  prompt?: string
  referenceImageStoragePaths: string[]
  referenceImageUrls: string[]
  supabase: SupabaseClient
  userId: string
  variationStrength: CarouselVariationStrength
  customVariation?: string | null
  perShotVariations?: string[] | null
}

export type RunCarouselShotsGenerationResult = {
  generationId: string
  metadata: CarouselShotsMetadata
  prompt: string
}

async function resolvePricingQuote(
  supabase: SupabaseClient,
  model: CarouselShotsModelId,
  generationMode: CarouselGenerationMode,
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

  const pricingParams = buildImagePricingParameters(
    getCarouselGenerationQualityParams(generationMode, model),
  )

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

async function runFastCarouselShotsGeneration(
  input: RunCarouselShotsGenerationInput,
): Promise<RunCarouselShotsGenerationResult> {
  const gridSize = input.gridSize ?? 4
  const prompt =
    input.prompt ??
    buildCarouselShotsPrompt({
      gridSize,
      variationStrength: input.variationStrength,
      customVariation: input.customVariation,
      perShotVariations: input.perShotVariations,
    })

  const layout = computeContactSheetLayout({
    gridSize,
    panelAspectRatio: input.aspectRatio,
    targetPanelLongEdge: getTargetPanelLongEdgeForModel(input.model),
  })

  const pricingQuote = await resolvePricingQuote(input.supabase, input.model, "fast", 1)
  const requiredCredits = pricingQuote.quotedCredits
  const hasCredits = await checkUserHasCredits(input.userId, requiredCredits, input.supabase)
  if (!hasCredits) {
    const error = new Error(
      `Insufficient credits. This generation requires ${requiredCredits} credits.`,
    )
    error.name = "InsufficientCreditsError"
    throw error
  }

  const contactSheetRemoteUrl = await generateImageUrl({
    aspectRatio: layout.aspectRatio,
    generationMode: "fast",
    model: input.model,
    prompt,
    referenceImageUrls: input.referenceImageUrls,
  })

  const contactSheetBuffer = await downloadImageBuffer(contactSheetRemoteUrl)
  const splitResult = await splitContactSheet(contactSheetBuffer, gridSize, input.aspectRatio, {
    targetPanelWidth: layout.panelWidth,
    targetPanelHeight: layout.panelHeight,
  })
  const autoStrip = await getAutoStripImageMetadata(input.supabase, input.userId)

  const contactSheetStored = await uploadPreparedGeneratedImage({
    autoStrip,
    buffer: contactSheetBuffer,
    index: 0,
    mimeType: "image/png",
    modelIdentifier: input.model,
    supabase: input.supabase,
    userId: input.userId,
  })

  const storedPanels = await Promise.all(
    splitResult.panels.map((panelBuffer, index) =>
      uploadPreparedGeneratedImage({
        autoStrip,
        buffer: panelBuffer,
        index: index + 1,
        mimeType: "image/png",
        modelIdentifier: input.model,
        supabase: input.supabase,
        userId: input.userId,
      }),
    ),
  )

  const shots = storedPanels.map((panel, index) => ({
    id: crypto.randomUUID(),
    url: panel.url,
    storagePath: panel.storagePath,
    index,
  }))

  const metadata: CarouselShotsMetadata = {
    kind: "carousel_shots",
    generationMode: "fast",
    contactSheetUrl: contactSheetStored.url,
    contactSheetStoragePath: contactSheetStored.storagePath,
    shots,
    gridSize,
    shotCount: gridSize,
    aspectRatio: input.aspectRatio,
    variationStrength: input.variationStrength,
    customVariation: input.customVariation ?? null,
    perShotVariations: input.perShotVariations ?? null,
    model: input.model,
    referenceImageStoragePaths: input.referenceImageStoragePaths,
  }

  const { data: generation, error: insertError } = await input.supabase
    .from("generations")
    .insert({
      user_id: input.userId,
      prompt,
      supabase_storage_path: shots[0]?.storagePath ?? contactSheetStored.storagePath,
      reference_images_supabase_storage_path:
        input.referenceImageStoragePaths.length > 0 ? input.referenceImageStoragePaths : null,
      aspect_ratio: input.aspectRatio,
      model: input.model,
      type: "image",
      is_public: true,
      tool: CAROUSEL_SHOTS_TOOL,
      status: "completed",
      metadata,
      quoted_credits: requiredCredits,
      pricing_snapshot: pricingQuote.pricingSnapshot,
      finished_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (insertError || !generation) {
    throw new Error(insertError?.message ?? "Failed to save carousel shots generation")
  }

  await deductUserCredits(input.userId, requiredCredits, input.supabase)

  return {
    generationId: generation.id,
    metadata,
    prompt,
  }
}

async function runHdCarouselShotsGeneration(
  input: RunCarouselShotsGenerationInput,
): Promise<RunCarouselShotsGenerationResult> {
  const shotCount = input.shotCount
  const prompts = Array.from({ length: shotCount }, (_, index) =>
    buildCarouselHdShotPrompt({
      shotIndex: index,
      shotCount,
      variationStrength: input.variationStrength,
      customVariation: input.customVariation,
      perShotVariation: input.perShotVariations?.[index] ?? null,
    }),
  )
  const combinedPrompt = prompts.join("\n\n")

  const pricingQuote = await resolvePricingQuote(input.supabase, input.model, "hd", shotCount)
  const requiredCredits = pricingQuote.quotedCredits
  const hasCredits = await checkUserHasCredits(input.userId, requiredCredits, input.supabase)
  if (!hasCredits) {
    const error = new Error(
      `Insufficient credits. This generation requires ${requiredCredits} credits.`,
    )
    error.name = "InsufficientCreditsError"
    throw error
  }

  const autoStrip = await getAutoStripImageMetadata(input.supabase, input.userId)
  const shots: CarouselShotsMetadata["shots"] = []

  for (let index = 0; index < shotCount; index += 1) {
    const prompt = prompts[index]!
    const remoteUrl = await generateImageUrl({
      aspectRatio: input.aspectRatio,
      generationMode: "hd",
      model: input.model,
      prompt,
      referenceImageUrls: input.referenceImageUrls,
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
    })
  }

  const metadata: CarouselShotsMetadata = {
    kind: "carousel_shots",
    generationMode: "hd",
    contactSheetUrl: null,
    contactSheetStoragePath: null,
    shots,
    shotCount,
    aspectRatio: input.aspectRatio,
    variationStrength: input.variationStrength,
    customVariation: input.customVariation ?? null,
    perShotVariations: input.perShotVariations ?? null,
    model: input.model,
    referenceImageStoragePaths: input.referenceImageStoragePaths,
  }

  const { data: generation, error: insertError } = await input.supabase
    .from("generations")
    .insert({
      user_id: input.userId,
      prompt: combinedPrompt,
      supabase_storage_path: shots[0]?.storagePath ?? null,
      reference_images_supabase_storage_path:
        input.referenceImageStoragePaths.length > 0 ? input.referenceImageStoragePaths : null,
      aspect_ratio: input.aspectRatio,
      model: input.model,
      type: "image",
      is_public: true,
      tool: CAROUSEL_SHOTS_TOOL,
      status: "completed",
      metadata,
      quoted_credits: requiredCredits,
      pricing_snapshot: pricingQuote.pricingSnapshot,
      finished_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (insertError || !generation) {
    throw new Error(insertError?.message ?? "Failed to save carousel shots generation")
  }

  await deductUserCredits(input.userId, requiredCredits, input.supabase)

  return {
    generationId: generation.id,
    metadata,
    prompt: combinedPrompt,
  }
}

export async function runCarouselShotsGeneration(
  input: RunCarouselShotsGenerationInput,
): Promise<RunCarouselShotsGenerationResult> {
  if (input.generationMode === "hd") {
    return runHdCarouselShotsGeneration(input)
  }

  return runFastCarouselShotsGeneration(input)
}

