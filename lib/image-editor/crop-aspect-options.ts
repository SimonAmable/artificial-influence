import type { Crop } from "react-image-crop"

export type CropAspectPresetId =
  | "original"
  | "free"
  | "1:1"
  | "4:3"
  | "3:2"
  | "16:9"
  | "9:16"

export type CropAspectRatio = number | "original" | "free"

export interface CropAspectPreset {
  id: CropAspectPresetId
  label: string
  ratio: CropAspectRatio
}

export const CROP_ASPECT_PRESETS: CropAspectPreset[] = [
  { id: "free", label: "Free", ratio: "free" },
  { id: "original", label: "Original", ratio: "original" },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "4:3", label: "4:3", ratio: 4 / 3 },
  { id: "3:2", label: "3:2", ratio: 3 / 2 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "9:16", label: "9:16", ratio: 9 / 16 },
]

export function cropPercentToAspect(
  crop: Crop,
  mediaWidth: number,
  mediaHeight: number
): number | undefined {
  if (!crop.width || !crop.height || mediaWidth <= 0 || mediaHeight <= 0) {
    return undefined
  }

  return (crop.width / crop.height) * (mediaWidth / mediaHeight)
}

export function resolveCropAspect(
  presetId: CropAspectPresetId,
  naturalAspect: number
): number | undefined {
  const preset = CROP_ASPECT_PRESETS.find((entry) => entry.id === presetId)
  if (!preset) return naturalAspect

  if (preset.ratio === "original") return naturalAspect
  if (preset.ratio === "free") return undefined
  return preset.ratio
}
