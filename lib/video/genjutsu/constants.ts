export const GENJUTSU_UI_MODEL = "custom/genjutsu" as const
export const GENJUTSU_DISPLAY_NAME = "Unican Genjutsu"
export const GENJUTSU_BASE_MODEL = "alibaba/wan-3.0" as const
export const GENJUTSU_MAX_REFERENCE_IMAGES = 10
export const GENJUTSU_MIN_SECONDS = 2
export const GENJUTSU_MAX_SOURCE_SECONDS = 15
export const GENJUTSU_TOOL = "genjutsu" as const

export function isGenjutsuModelIdentifier(identifier: string | null | undefined): boolean {
  return identifier === GENJUTSU_UI_MODEL
}

export function formatGenjutsuModelLabel(model: string | null | undefined): string | null | undefined {
  if (model === GENJUTSU_UI_MODEL) return GENJUTSU_DISPLAY_NAME
  return model
}
