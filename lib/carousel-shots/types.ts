export type CarouselGenerationMode = "fast" | "hd"



export type CarouselGridSize = 4 | 9



export type CarouselPanelAspectRatio = "3:4" | "4:5" | "9:16"



export type CarouselVariationStrength = "subtle" | "natural" | "creative" | "custom"



export type CarouselShotsModelId =

  | "openai/gpt-image-2"

  | "google/nano-banana-2"

  | "google/nano-banana-2-lite"

  | "xai/grok-imagine-image-2.0"

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

  generationMode?: CarouselGenerationMode

  contactSheetUrl: string | null

  contactSheetStoragePath: string | null

  shots: CarouselShotRecord[]

  /** Fast mode grid size. Legacy records always include this. */

  gridSize?: CarouselGridSize

  /** Total shot count for both modes. */

  shotCount: number

  aspectRatio: CarouselPanelAspectRatio

  variationStrength: CarouselVariationStrength

  customVariation?: string | null

  perShotVariations?: string[] | null

  model: CarouselShotsModelId

  referenceImageStoragePaths: string[]

}



export function isCarouselShotsMetadata(value: unknown): value is CarouselShotsMetadata {

  if (!value || typeof value !== "object") return false

  const record = value as Record<string, unknown>

  return record.kind === "carousel_shots" && Array.isArray(record.shots)

}



export function getCarouselGenerationMode(

  metadata: CarouselShotsMetadata,

): CarouselGenerationMode {

  return metadata.generationMode ?? "fast"

}



export function getCarouselShotCount(metadata: CarouselShotsMetadata): number {

  if (typeof metadata.shotCount === "number" && metadata.shotCount > 0) {

    return metadata.shotCount

  }

  if (metadata.gridSize === 4 || metadata.gridSize === 9) {

    return metadata.gridSize

  }

  return metadata.shots.length

}


