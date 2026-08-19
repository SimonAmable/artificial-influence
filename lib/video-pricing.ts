import type { ModelPricingConfig } from "@/lib/types/pricing"
import { resolveGenerationPricingQuote } from "@/lib/generation-pricing"

export type { VideoDurationInput } from "@/lib/video-duration"
export { resolvePredictedDurationSeconds } from "@/lib/video-duration"

export interface VideoPricingQuoteInput {
  modelIdentifier: string
  modelCost?: number | null
  modelCostPerSecond?: number | null
  pricingConfig?: ModelPricingConfig | null
  duration?: number | string | null
  resolution?: string | null
  draft?: boolean | null
  mode?: string | null
  generateAudio?: boolean | null
  characterOrientation?: string | null
  faceLock?: string | null
  hasInputVideo?: boolean
  hasReferenceVideo?: boolean
  sourceDurationSeconds?: number | null
}

export interface VideoPricingQuote {
  creditsPerSecond: number | null
  predictedDurationSeconds: number | null
  quotedCredits: number
}

export function resolveVideoPricingQuote(input: VideoPricingQuoteInput): VideoPricingQuote {
  const quote = resolveGenerationPricingQuote({
    model: {
      identifier: input.modelIdentifier,
      type: "video",
      model_cost: input.modelCost,
      model_cost_per_second: input.modelCostPerSecond,
      pricing_config: input.pricingConfig ?? null,
    },
    parameters: {
      resolution: input.resolution,
      mode: input.mode,
      draft: input.draft,
      generate_audio: input.generateAudio,
      duration: input.duration,
      character_orientation: input.characterOrientation,
      face_lock: input.faceLock,
      has_reference_video: Boolean(input.hasInputVideo || input.hasReferenceVideo),
    },
    durationSeconds: input.duration,
    sourceDurationSeconds: input.sourceDurationSeconds,
    hasInputVideo: input.hasInputVideo,
    hasReferenceVideo: input.hasReferenceVideo,
    characterOrientation: input.characterOrientation,
  })

  return {
    creditsPerSecond: quote.creditsPerUnit,
    predictedDurationSeconds: quote.predictedDurationSeconds,
    quotedCredits: quote.quotedCredits,
  }
}
