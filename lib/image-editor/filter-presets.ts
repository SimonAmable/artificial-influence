import filterPresetsData from "./filter-presets.json"
import { buildMiniGlPipeline } from "./minigl-pipeline"
import type { MiniGlPresetConfig } from "./minigl-params"
import type { ImageFilterPresetId, ImageFilterSettings } from "./types"

export type ImageFilterPresetMeta = {
  id: ImageFilterPresetId
  label: string
  settings: ImageFilterSettings
  /** Public URL for the generated thumbnail (name overlaid in UI). */
  previewSrc: string
  minigl?: MiniGlPresetConfig
}

type FilterPresetsFile = {
  sourceImage: string
  previewDir: string
  presets: Array<{
    id: string
    label: string
    settings: ImageFilterSettings
    minigl?: MiniGlPresetConfig
  }>
}

const data = filterPresetsData as FilterPresetsFile

export const FILTER_PRESET_SOURCE_IMAGE = data.sourceImage
export const FILTER_PRESET_PREVIEW_DIR = data.previewDir

export const IMAGE_FILTER_PRESET_LIST: ImageFilterPresetMeta[] = data.presets.map(
  (preset) => ({
    id: preset.id as ImageFilterPresetId,
    label: preset.label,
    settings: { ...preset.settings },
    previewSrc: `${data.previewDir}/${preset.id}.webp`,
    minigl: preset.minigl,
  })
)

export const IMAGE_FILTER_PRESETS: Record<
  ImageFilterPresetId,
  ImageFilterSettings
> = Object.fromEntries(
  IMAGE_FILTER_PRESET_LIST.map((preset) => [preset.id, { ...preset.settings }])
) as Record<ImageFilterPresetId, ImageFilterSettings>

export function getFilterPresetMeta(
  id: ImageFilterPresetId
): ImageFilterPresetMeta | undefined {
  return IMAGE_FILTER_PRESET_LIST.find((preset) => preset.id === id)
}

export function resolveMiniGlPipelineForSettings(
  settings: ImageFilterSettings,
  isExactPreset: (settings: ImageFilterSettings, id: ImageFilterPresetId) => boolean
): ReturnType<typeof buildMiniGlPipeline> {
  for (const preset of IMAGE_FILTER_PRESET_LIST) {
    if (preset.id === "none") continue
    if (isExactPreset(settings, preset.id) && preset.minigl) {
      return buildMiniGlPipeline(settings, preset.minigl)
    }
  }
  return buildMiniGlPipeline(settings)
}
