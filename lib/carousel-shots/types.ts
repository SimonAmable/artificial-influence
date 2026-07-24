export type CarouselGridSize = 4 | 9

export type CarouselPanelAspectRatio = "3:4" | "4:5" | "9:16"

export type CarouselVariationStrength = "subtle" | "natural" | "creative"

export type CarouselShotsModelId =
  | "openai/gpt-image-2"
  | "google/nano-banana-2"
  | "bytedance/seedream-4.5"
  | "bytedance/seedream-5-lite"
  | "bytedance/seedream-5-pro"

export type CarouselShotRecord = {
  id: string
  url: string
  storagePath: string
  index: number
  upscaledUrl?: string | null
  upscaleGenerationId?: string | null
  upscaleModel?: string | null
}

export type CarouselShotsMetadata = {
  kind: "carousel_shots"
  contactSheetUrl: string
  contactSheetStoragePath: string
  shots: CarouselShotRecord[]
  gridSize: CarouselGridSize
  aspectRatio: CarouselPanelAspectRatio
  variationStrength: CarouselVariationStrength
  model: CarouselShotsModelId
  referenceImageStoragePaths: string[]
}

export function isCarouselShotsMetadata(value: unknown): value is CarouselShotsMetadata {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return record.kind === "carousel_shots" && Array.isArray(record.shots)
}
