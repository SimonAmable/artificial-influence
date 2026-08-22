import {
  buildImagePricingParameters,
  resolveGenerationPricingQuote,
} from "@/lib/generation-pricing"
import {
  getStudioToolFalQualityParams,
  isStudioImageFallbackModel,
} from "@/lib/image/studio-tools/moderation-fallback"
import type { ModelPricingConfig } from "@/lib/types/pricing"

/** Matches the live GPT Image 2 quality table when a catalog quote has no pricing_config. */
const GPT_IMAGE_2_PRICING_FALLBACK: ModelPricingConfig = {
  strategy: "tiered_per_output",
  defaultCredits: 4,
  dimensions: [
    {
      parameter: "quality",
      values: { low: 2, medium: 4, high: 8 },
    },
  ],
}

function pricingConfigForStudioTool(
  baseModelIdentifier: string,
  pricingConfig: ModelPricingConfig | null | undefined,
): ModelPricingConfig | null {
  if (pricingConfig) return pricingConfig
  if (baseModelIdentifier === "openai/gpt-image-2") return GPT_IMAGE_2_PRICING_FALLBACK
  return null
}

/** Client/server quote for a proprietary studio tool, using the same quality knobs as generation. */
export function estimateStudioToolCredits(input: {
  baseModelIdentifier: string
  model_cost?: number | null
  pricing_config?: ModelPricingConfig | null
  outputCount?: number
}): number {
  const falParams = isStudioImageFallbackModel(input.baseModelIdentifier)
    ? getStudioToolFalQualityParams(input.baseModelIdentifier)
    : {}

  return resolveGenerationPricingQuote({
    model: {
      identifier: input.baseModelIdentifier,
      type: "image",
      model_cost: input.model_cost ?? 4,
      pricing_config: pricingConfigForStudioTool(
        input.baseModelIdentifier,
        input.pricing_config,
      ),
    },
    parameters: buildImagePricingParameters({
      quality: typeof falParams.quality === "string" ? falParams.quality : null,
      resolutionPreset:
        typeof falParams.resolutionPreset === "string" ? falParams.resolutionPreset : null,
    }),
    outputCount: input.outputCount ?? 1,
  }).quotedCredits
}
