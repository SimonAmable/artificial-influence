export const ANGLES_TOOL = "angles" as const

export const ANGLES_MODEL_IDS = [
  "google/nano-banana-2-lite",
  "openai/gpt-image-2",
  "bytedance/seedream-5-lite",
] as const

export type AnglesModelId = (typeof ANGLES_MODEL_IDS)[number]

export const DEFAULT_ANGLES_MODEL: AnglesModelId = "google/nano-banana-2-lite"

export const ANGLES_ROTATION_MIN = 0
export const ANGLES_ROTATION_MAX = 359
export const ANGLES_TILT_MIN = -90
export const ANGLES_TILT_MAX = 90
export const ANGLES_ZOOM_MIN = 0
export const ANGLES_ZOOM_MAX = 10

export function isAnglesModelId(value: string): value is AnglesModelId {
  return ANGLES_MODEL_IDS.includes(value as AnglesModelId)
}
