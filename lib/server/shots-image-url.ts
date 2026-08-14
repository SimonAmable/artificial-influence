import "server-only"

import Replicate from "replicate"
import { fal } from "@fal-ai/client"
import type { CarouselGenerationMode, CarouselShotsModelId } from "@/lib/carousel-shots/types"
import {
  getCarouselFalQualityParams,
  getCarouselGenerationQualityParams,
  getCarouselReplicateResolution,
} from "@/lib/carousel-shots/quality"
import { applyMinimalReplicateImageModeration } from "@/lib/server/minimal-moderation"
import { formatFalClientError } from "@/lib/server/fal-client-error"
import {
  buildFalImageRequest,
  configureFal,
  isSupportedFalImageModel,
  submitFalImageQueue,
} from "@/lib/server/fal-image"
import { callXaiImageEdits } from "@/lib/server/xai-image-edits"
import { buildReplicateReferenceImageInput } from "@/lib/utils/model-parameters"

const FAL_POLL_INTERVAL_MS = 2000
const FAL_MAX_WAIT_MS = 5 * 60 * 1000

const GROK_IMAGE_2_MODEL = "xai/grok-imagine-image-2.0" as const satisfies CarouselShotsModelId

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

function parseGrokQualityParams(params: Record<string, unknown>): {
  quality?: "low" | "medium" | "high"
  resolution?: "1k" | "2k"
} {
  return {
    ...(typeof params.quality === "string"
      ? { quality: params.quality as "low" | "medium" | "high" }
      : {}),
    ...(typeof params.resolution === "string"
      ? { resolution: params.resolution as "1k" | "2k" }
      : {}),
  }
}

export async function generateShotsModelImageUrl(options: {
  aspectRatio: string
  generationMode: CarouselGenerationMode
  model: CarouselShotsModelId
  prompt: string
  referenceImageUrls: string[]
}): Promise<string> {
  if (options.model === GROK_IMAGE_2_MODEL) {
    const qualityParams = getCarouselGenerationQualityParams(
      options.generationMode,
      options.model,
    )
    const { quality, resolution } = parseGrokQualityParams(qualityParams)
    const base64Images = await callXaiImageEdits({
      modelIdentifier: options.model,
      prompt: options.prompt,
      referenceImageUrls: options.referenceImageUrls,
      aspectRatio: options.aspectRatio,
      quality,
      resolution,
    })
    return `data:image/png;base64,${base64Images[0]}`
  }

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

  throw new Error(`Unsupported shots model: ${options.model}`)
}
