import { DEFAULT_IMAGE_FILTER_SETTINGS } from "./constants"
import type { ImageFilterSettings } from "./types"

const LAST_USED_FILTER_SETTINGS_KEY = "image-editor:v1:last-filter-settings"

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function normalizeImageFilterSettings(
  raw: unknown
): ImageFilterSettings | null {
  if (!raw || typeof raw !== "object") return null

  const candidate = raw as Partial<ImageFilterSettings>
  const keys: (keyof ImageFilterSettings)[] = [
    "grain",
    "brightness",
    "contrast",
    "saturation",
    "warmth",
  ]

  if (!keys.every((key) => typeof candidate[key] === "number")) {
    return null
  }

  return {
    grain: clamp(candidate.grain!, 0, 100),
    brightness: clamp(candidate.brightness!, -50, 50),
    contrast: clamp(candidate.contrast!, -50, 50),
    saturation: clamp(candidate.saturation!, -50, 50),
    warmth: clamp(candidate.warmth!, -50, 50),
  }
}

export function getRememberedFilterSettings(): ImageFilterSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_IMAGE_FILTER_SETTINGS }
  }

  try {
    const raw = window.localStorage.getItem(LAST_USED_FILTER_SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_IMAGE_FILTER_SETTINGS }

    const parsed: unknown = JSON.parse(raw)
    return normalizeImageFilterSettings(parsed) ?? { ...DEFAULT_IMAGE_FILTER_SETTINGS }
  } catch {
    return { ...DEFAULT_IMAGE_FILTER_SETTINGS }
  }
}

export function setRememberedFilterSettings(settings: ImageFilterSettings): void {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(
      LAST_USED_FILTER_SETTINGS_KEY,
      JSON.stringify(settings)
    )
  } catch {
    // Ignore storage failures; editor stays usable.
  }
}
