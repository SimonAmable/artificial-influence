export const UPSCALE_MODEL_IDENTIFIER = "prunaai/p-image-upscale"

export const SEEDVR2_MODEL_IDENTIFIER = "zsxkib/seedvr2"

export const DEFAULT_UPSCALE_CREDITS_COST = 1

export type UpscaleMode = "target" | "factor"

export type UpscaleParameters = {
  upscale_mode?: UpscaleMode
  target?: number
  factor?: number
  enhance_realism?: boolean
  enhance_details?: boolean
  output_format?: "jpg" | "png" | "webp"
}

export type SeedVr2ModelVariant = "3b" | "7b"

export type SeedVr2Parameters = {
  model_variant?: SeedVr2ModelVariant
  sample_steps?: number
  cfg_scale?: number
  apply_color_fix?: boolean
  output_format?: "jpg" | "png" | "webp"
}

export type UpscaleRunParameters = UpscaleParameters & SeedVr2Parameters

export function isSeedVr2ModelIdentifier(identifier: string): boolean {
  const trimmed = identifier.trim()
  return trimmed === SEEDVR2_MODEL_IDENTIFIER || trimmed.startsWith("zsxkib/seedvr2:")
}

export function normalizeUpscaleModelIdentifier(identifier?: string | null): string {
  const trimmed = (identifier ?? "").trim()
  if (!trimmed) return UPSCALE_MODEL_IDENTIFIER
  return isSeedVr2ModelIdentifier(trimmed) ? SEEDVR2_MODEL_IDENTIFIER : UPSCALE_MODEL_IDENTIFIER
}
