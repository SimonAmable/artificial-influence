import "server-only"

import { fal } from "@fal-ai/client"
import type { SupabaseClient } from "@supabase/supabase-js"
import { checkUserHasCredits } from "@/lib/credits"
import {
  buildImagePricingParameters,
  resolveGenerationPricingQuote,
} from "@/lib/generation-pricing"
import {
  getStudioToolFalQualityParams,
  isModerationGenerationFailure,
  STUDIO_IMAGE_FALLBACK_CHAIN,
  type StudioImageFallbackModelId,
  type StudioToolImageFallbackMetadata,
} from "@/lib/image/studio-tools/moderation-fallback"
import { formatFalClientError } from "@/lib/server/fal-client-error"
import {
  buildFalImageRequest,
  configureFal,
  submitFalImageQueue,
} from "@/lib/server/fal-image"

export {
  getStudioToolFalQualityParams,
  isModerationGenerationFailure,
  isStudioImageToolTag,
  STUDIO_IMAGE_FALLBACK_CHAIN,
  type StudioImageFallbackModelId,
  type StudioToolImageFallbackMetadata,
} from "@/lib/image/studio-tools/moderation-fallback"

const FAL_POLL_INTERVAL_MS = 2000
const FAL_MAX_WAIT_MS = 5 * 60 * 1000

export type StudioToolImageGenerationResult = StudioToolImageFallbackMetadata & {
  imageUrl: string
}

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
      try {
        await fal.queue.result(endpointId, { requestId })
      } catch (error) {
        throw new Error(formatFalClientError(error))
      }
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

async function generateFalImageUrl(options: {
  aspectRatio: string
  model: StudioImageFallbackModelId
  prompt: string
  referenceImageUrls: string[]
}): Promise<string> {
  const qualityParams = getStudioToolFalQualityParams(options.model)
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

export async function resolveStudioToolPricingQuote(
  supabase: SupabaseClient,
  model: StudioImageFallbackModelId,
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

  return resolveGenerationPricingQuote({
    model: {
      identifier: model,
      type: "image",
      model_cost: modelData.model_cost,
      pricing_config: modelData.pricing_config,
    },
    parameters: buildImagePricingParameters(getStudioToolFalQualityParams(model)),
    outputCount: 1,
  })
}

export async function resolveStudioToolMaxQuotedCredits(
  supabase: SupabaseClient,
): Promise<number> {
  const quotes = await Promise.all(
    STUDIO_IMAGE_FALLBACK_CHAIN.map((model) => resolveStudioToolPricingQuote(supabase, model)),
  )
  return Math.max(...quotes.map((quote) => quote.quotedCredits))
}

export async function generateStudioToolImageWithFallback(options: {
  aspectRatio: string
  prompt: string
  referenceImageUrls: string[]
  supabase: SupabaseClient
  userId: string
}): Promise<StudioToolImageGenerationResult> {
  const requestedModel = STUDIO_IMAGE_FALLBACK_CHAIN[0]
  let lastError: Error | undefined

  for (const model of STUDIO_IMAGE_FALLBACK_CHAIN) {
    if (model !== requestedModel) {
      const pricingQuote = await resolveStudioToolPricingQuote(options.supabase, model)
      const hasCredits = await checkUserHasCredits(
        options.userId,
        pricingQuote.quotedCredits,
        options.supabase,
      )
      if (!hasCredits) {
        break
      }
    }

    try {
      const imageUrl = await generateFalImageUrl({
        aspectRatio: options.aspectRatio,
        model,
        prompt: options.prompt,
        referenceImageUrls: options.referenceImageUrls,
      })

      return {
        imageUrl,
        deliveredModel: model,
        requestedModel,
        fallbackUsed: model !== requestedModel,
        ...(model !== requestedModel ? { fallbackReason: "content_moderation" as const } : {}),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const wrapped = error instanceof Error ? error : new Error(message)
      if (!isModerationGenerationFailure(wrapped)) {
        throw wrapped
      }
      lastError = wrapped
    }
  }

  throw lastError ?? new Error("Image generation failed due to content moderation.")
}
