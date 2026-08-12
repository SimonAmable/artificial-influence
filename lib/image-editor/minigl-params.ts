/** mini-gl / glfx-style adjustment inputs (see @xdadda/mini-gl filterAdjustments). */
export type MiniGlAdjustments = {
  brightness?: number
  contrast?: number
  saturation?: number
  exposure?: number
  temperature?: number
  gamma?: number
  clarity?: number
  vibrance?: number
  vignette?: number
  tint?: number
  sepia?: number
}

export type MiniGlInstaMtx = {
  type: "MTX"
  mtx: "vintage" | "kodachrome" | "polaroid" | "browni"
  mix: number
}

export type MiniGlPresetConfig = {
  adjustments?: MiniGlAdjustments
  highlightsShadows?: [number, number]
  insta?: MiniGlInstaMtx
}

export type MiniGlPipeline = MiniGlPresetConfig & {
  grain: number
}

export const MAX_FILTER_GRAIN = 30
/** Preset catalog grain must stay at or below this (slider allows up to MAX_FILTER_GRAIN). */
export const MAX_PRESET_GRAIN = 10
