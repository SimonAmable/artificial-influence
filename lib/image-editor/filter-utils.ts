import type { Canvas as FabricCanvas, FabricImage } from "fabric"
import { filters } from "fabric"
import { DEFAULT_IMAGE_FILTER_SETTINGS } from "./constants"
import type { ImageFilterPresetId, ImageFilterSettings } from "./types"

type BaseAwareImage = FabricImage & {
  layerId?: string
  name?: string
  editorFilterSettings?: ImageFilterSettings
}

export const IMAGE_FILTER_PRESETS: Record<
  ImageFilterPresetId,
  ImageFilterSettings
> = {
  none: DEFAULT_IMAGE_FILTER_SETTINGS,
  "subtle-film": {
    grain: 25,
    brightness: 0,
    contrast: 10,
    saturation: -8,
    warmth: 0,
  },
  "warm-vintage": {
    grain: 35,
    brightness: 0,
    contrast: 5,
    saturation: -15,
    warmth: 12,
  },
}

function sliderToUnit(value: number): number {
  return value / 100
}

function grainToNoise(grain: number): number {
  return Math.round((grain / 100) * 250)
}

export function getBaseImage(canvas: FabricCanvas): BaseAwareImage | null {
  const match = canvas.getObjects().find((obj) => {
    const candidate = obj as BaseAwareImage & { type?: string }
    return (
      candidate.type === "image" &&
      (candidate.layerId === "base" || candidate.name === "Background Image")
    )
  })
  return (match as BaseAwareImage | undefined) ?? null
}

export function buildFiltersFromSettings(settings: ImageFilterSettings) {
  const built: NonNullable<BaseAwareImage["filters"]> = []

  if (settings.grain > 0) {
    built.push(new filters.Noise({ noise: grainToNoise(settings.grain) }))
  }

  if (settings.brightness !== 0) {
    built.push(
      new filters.Brightness({ brightness: sliderToUnit(settings.brightness) })
    )
  }

  if (settings.contrast !== 0) {
    built.push(
      new filters.Contrast({ contrast: sliderToUnit(settings.contrast) })
    )
  }

  if (settings.saturation !== 0) {
    built.push(
      new filters.Saturation({ saturation: sliderToUnit(settings.saturation) })
    )
  }

  if (settings.warmth !== 0) {
    const warmth = sliderToUnit(settings.warmth)
    built.push(
      new filters.Gamma({
        gamma: [1 + warmth * 0.15, 1, 1 - warmth * 0.15],
      })
    )
  }

  return built
}

export function applyBaseImageFilters(
  canvas: FabricCanvas,
  settings: ImageFilterSettings
): boolean {
  const img = getBaseImage(canvas)
  if (!img) return false

  img.filters = buildFiltersFromSettings(settings)
  img.editorFilterSettings = { ...settings }
  img.applyFilters()
  canvas.requestRenderAll()
  return true
}

export function readFilterSettingsFromCanvas(
  canvas: FabricCanvas
): ImageFilterSettings {
  const img = getBaseImage(canvas)
  if (!img?.editorFilterSettings) {
    return { ...DEFAULT_IMAGE_FILTER_SETTINGS }
  }
  return { ...img.editorFilterSettings }
}

export function hasActiveFilters(settings: ImageFilterSettings): boolean {
  return (
    settings.grain !== DEFAULT_IMAGE_FILTER_SETTINGS.grain ||
    settings.brightness !== DEFAULT_IMAGE_FILTER_SETTINGS.brightness ||
    settings.contrast !== DEFAULT_IMAGE_FILTER_SETTINGS.contrast ||
    settings.saturation !== DEFAULT_IMAGE_FILTER_SETTINGS.saturation ||
    settings.warmth !== DEFAULT_IMAGE_FILTER_SETTINGS.warmth
  )
}

export function detectFilterPreset(
  settings: ImageFilterSettings
): ImageFilterPresetId {
  for (const id of ["subtle-film", "warm-vintage"] as const) {
    const preset = IMAGE_FILTER_PRESETS[id]
    const matches = (Object.keys(preset) as (keyof ImageFilterSettings)[]).every(
      (key) => preset[key] === settings[key]
    )
    if (matches) return id
  }
  return "none"
}
