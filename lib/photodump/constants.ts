import type { PhotodumpAspectRatio, PhotodumpModelId } from "@/lib/photodump/types"
import { CAROUSEL_SHOTS_MODELS } from "@/lib/carousel-shots/constants"
import { MODEL_IDENTIFIERS } from "@/lib/constants/models"

export const PHOTODUMP_TOOL = "photodump" as const

export const PHOTODUMP_CUSTOM_PRESET_ID = "custom" as const

export const DEFAULT_PHOTODUMP_MODEL: PhotodumpModelId = MODEL_IDENTIFIERS.OPENAI_GPT_IMAGE_2

export const PHOTODUMP_MODELS = CAROUSEL_SHOTS_MODELS

export const PHOTODUMP_SHOT_COUNTS = [6, 9, 12, 15] as const

export const DEFAULT_PHOTODUMP_SHOT_COUNT = 12

export const PHOTODUMP_ASPECT_RATIOS: readonly PhotodumpAspectRatio[] = ["9:16", "4:5", "1:1"]

export const DEFAULT_PHOTODUMP_ASPECT_RATIO: PhotodumpAspectRatio = "4:5"

export const PHOTODUMP_MAX_AESTHETIC_REFS = 8

export const PHOTODUMP_MAX_NOTE_LENGTH = 200

export const PHOTODUMP_HISTORY_PAGE_LIMIT = 6

export function isPhotodumpModelId(value: string): value is PhotodumpModelId {
  return PHOTODUMP_MODELS.some((model) => model.id === value)
}

export function isPhotodumpShotCount(value: number): boolean {
  return PHOTODUMP_SHOT_COUNTS.includes(value as (typeof PHOTODUMP_SHOT_COUNTS)[number])
}

export function isPhotodumpAspectRatio(value: string): value is PhotodumpAspectRatio {
  return PHOTODUMP_ASPECT_RATIOS.includes(value as PhotodumpAspectRatio)
}
