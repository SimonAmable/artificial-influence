import type { Canvas as FabricCanvas, FabricImage } from "fabric"
import { DEFAULT_IMAGE_FILTER_SETTINGS } from "./constants"
import { gradeImage } from "./apply-minigl-browser"
import { resolveImageUrlForFabric } from "./canvas-image-url"
import {
  IMAGE_FILTER_PRESET_LIST,
  IMAGE_FILTER_PRESETS,
  resolveMiniGlPipelineForSettings,
} from "./filter-presets"
import type { ImageFilterPresetId, ImageFilterSettings } from "./types"

export {
  FILTER_PRESET_PREVIEW_DIR,
  FILTER_PRESET_SOURCE_IMAGE,
  getFilterPresetMeta,
  IMAGE_FILTER_PRESET_LIST,
  IMAGE_FILTER_PRESETS,
} from "./filter-presets"
export type { ImageFilterPresetMeta } from "./filter-presets"
export { MAX_FILTER_GRAIN, MAX_PRESET_GRAIN } from "./minigl-params"

type BaseAwareImage = FabricImage & {
  layerId?: string
  name?: string
  editorFilterSettings?: ImageFilterSettings
  editorSourceImageUrl?: string
}

let filterApplyToken = 0
let debouncedFilterTimer: ReturnType<typeof setTimeout> | null = null

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

export function getBaseImageSourceUrl(img: BaseAwareImage): string {
  if (img.editorSourceImageUrl) {
    return resolveImageUrlForFabric(img.editorSourceImageUrl)
  }
  const element = img.getElement() as HTMLImageElement | undefined
  if (element?.src) return element.src
  return img.getSrc()
}

export async function applyBaseImageFilters(
  canvas: FabricCanvas,
  settings: ImageFilterSettings,
  options?: { immediate?: boolean }
): Promise<boolean> {
  const img = getBaseImage(canvas)
  if (!img) return false

  const run = async () => {
    const token = ++filterApplyToken
    const sourceUrl = getBaseImageSourceUrl(img)
    const pipeline = resolveMiniGlPipelineForSettings(settings, isExactFilterPreset)

    try {
      const gradedUrl = await gradeImage(sourceUrl, pipeline)
      if (token !== filterApplyToken) return

      img.filters = []
      await img.setSrc(gradedUrl, { crossOrigin: "anonymous" })
      img.editorFilterSettings = { ...settings }
      img.set({ dirty: true })
      canvas.requestRenderAll()
    } catch (error) {
      console.error("Failed to apply image filters:", error)
    }
  }

  if (options?.immediate) {
    if (debouncedFilterTimer) {
      clearTimeout(debouncedFilterTimer)
      debouncedFilterTimer = null
    }
    await run()
    return true
  }

  if (debouncedFilterTimer) clearTimeout(debouncedFilterTimer)
  debouncedFilterTimer = setTimeout(() => {
    debouncedFilterTimer = null
    void run()
  }, 48)

  img.editorFilterSettings = { ...settings }
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

export function isCustomFilterPreset(settings: ImageFilterSettings): boolean {
  if (!hasActiveFilters(settings)) return false
  return !IMAGE_FILTER_PRESET_LIST.some(
    (preset) =>
      preset.id !== "none" && isExactFilterPreset(settings, preset.id)
  )
}

export function detectFilterPreset(
  settings: ImageFilterSettings
): ImageFilterPresetId {
  for (const preset of IMAGE_FILTER_PRESET_LIST) {
    if (preset.id === "none") continue
    const matches = (
      Object.keys(preset.settings) as (keyof ImageFilterSettings)[]
    ).every((key) => preset.settings[key] === settings[key])
    if (matches) return preset.id
  }

  if (isCustomFilterPreset(settings)) return "custom"
  return "none"
}

export function isExactFilterPreset(
  settings: ImageFilterSettings,
  presetId: ImageFilterPresetId
): boolean {
  if (presetId === "custom") {
    return isCustomFilterPreset(settings)
  }

  const preset = IMAGE_FILTER_PRESETS[presetId]
  if (!preset) return false
  return (Object.keys(preset) as (keyof ImageFilterSettings)[]).every(
    (key) => preset[key] === settings[key]
  )
}
