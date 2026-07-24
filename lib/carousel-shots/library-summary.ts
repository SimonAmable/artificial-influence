import type { CarouselShotsMetadata } from "@/lib/carousel-shots/types"
import { isCarouselShotsMetadata } from "@/lib/carousel-shots/types"

export type CarouselShotsLibrarySummary = {
  shotCount: number
  previewUrls: string[]
  extraShotCount: number
  aspectRatio: string
  gridSize: number
  hasHd: boolean
}

export function extractCarouselShotsLibrarySummary(
  metadata: unknown,
): CarouselShotsLibrarySummary | null {
  if (!isCarouselShotsMetadata(metadata)) return null

  const shots = metadata.shots
  const shotCount = shots.length
  const previewUrls = shots.slice(0, 4).map((shot) => shot.upscaledUrl ?? shot.url)
  const extraShotCount = Math.max(0, shotCount - 4)

  return {
    shotCount,
    previewUrls,
    extraShotCount,
    aspectRatio: metadata.aspectRatio,
    gridSize: metadata.gridSize,
    hasHd: shots.some((shot) => Boolean(shot.upscaledUrl)),
  }
}

export function isCarouselShotsGeneration(tool: string | null | undefined): boolean {
  return tool === "carousel_shots"
}
