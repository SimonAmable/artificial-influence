import {
  SEEDVR2_MODEL_IDENTIFIER,
  UPSCALE_MODEL_IDENTIFIER,
  isSeedVr2ModelIdentifier,
  type UpscaleRunParameters,
} from "@/lib/upscale/constants"

export type UpscaleModelId = typeof UPSCALE_MODEL_IDENTIFIER | typeof SEEDVR2_MODEL_IDENTIFIER

export type SeedVrStrength = "mild" | "balanced" | "strong"

export type UpscaleSettings = {
  modelIdentifier: UpscaleModelId
  enhanceRealism: boolean
  enhanceDetails: boolean
  targetMegapixels: number
  seedVrColorFix: boolean
  seedVrStrength: SeedVrStrength
}

export const DEFAULT_UPSCALE_PAGE_SETTINGS: UpscaleSettings = {
  modelIdentifier: UPSCALE_MODEL_IDENTIFIER,
  enhanceRealism: true,
  enhanceDetails: false,
  targetMegapixels: 4,
  seedVrColorFix: false,
  seedVrStrength: "balanced",
}

export const DEFAULT_CAROUSEL_UPSCALE_SETTINGS: UpscaleSettings = {
  ...DEFAULT_UPSCALE_PAGE_SETTINGS,
  targetMegapixels: 2,
}

const SEEDVR_STRENGTH_TO_CFG: Record<SeedVrStrength, number> = {
  mild: 0.8,
  balanced: 1,
  strong: 1.5,
}

export function buildUpscaleRequestPayload(settings: UpscaleSettings): {
  modelIdentifier: UpscaleModelId
  parameters: UpscaleRunParameters
} {
  if (isSeedVr2ModelIdentifier(settings.modelIdentifier)) {
    return {
      modelIdentifier: SEEDVR2_MODEL_IDENTIFIER,
      parameters: {
        model_variant: "3b",
        sample_steps: 1,
        cfg_scale: SEEDVR_STRENGTH_TO_CFG[settings.seedVrStrength],
        apply_color_fix: settings.seedVrColorFix,
        output_format: "png",
      },
    }
  }

  return {
    modelIdentifier: UPSCALE_MODEL_IDENTIFIER,
    parameters: {
      upscale_mode: "target",
      target: settings.targetMegapixels,
      enhance_realism: settings.enhanceRealism,
      enhance_details: settings.enhanceDetails,
      output_format: "png",
    },
  }
}
