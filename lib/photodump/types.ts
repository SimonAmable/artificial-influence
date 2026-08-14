import type { CarouselShotsModelId } from "@/lib/carousel-shots/types"

export type PhotodumpModelId = CarouselShotsModelId

export type PhotodumpAspectRatio = "9:16" | "4:5" | "1:1"

export type PhotodumpShotRecord = {
  id: string
  url: string
  storagePath: string
  index: number
  shotBrief: string
}

export type PhotodumpMetadata = {
  kind: "photodump"
  presetId: string
  presetName: string
  shots: PhotodumpShotRecord[]
  shotCount: number
  aspectRatio: PhotodumpAspectRatio
  model: PhotodumpModelId
  referenceImageStoragePaths: string[]
  aestheticReferenceStoragePaths: string[] | null
  note: string | null
}

export function isPhotodumpMetadata(value: unknown): value is PhotodumpMetadata {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return record.kind === "photodump" && Array.isArray(record.shots)
}
