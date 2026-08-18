import { DEFAULT_STUDIO_TILE_GAP, DEFAULT_STUDIO_TILE_HEIGHT } from "@/lib/studio/types"

const IMAGE_MAX_BYTES = 10 * 1024 * 1024
const VIDEO_MAX_BYTES = 50 * 1024 * 1024

export function isStudioMediaFile(file: File): boolean {
  return file.type.startsWith("image/") || file.type.startsWith("video/")
}

export function studioMediaKind(file: File): "image" | "video" | null {
  if (file.type.startsWith("video/")) return "video"
  if (file.type.startsWith("image/")) return "image"
  return null
}

export function maxBytesForStudioMedia(kind: "image" | "video"): number {
  return kind === "video" ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES
}

export function collectClipboardMediaFiles(data: DataTransfer | null): File[] {
  if (!data) return []
  const fromFiles = Array.from(data.files ?? []).filter(isStudioMediaFile)
  if (fromFiles.length > 0) return fromFiles

  const files: File[] = []
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind !== "file") continue
    const file = item.getAsFile()
    if (file && isStudioMediaFile(file)) files.push(file)
  }
  return files
}

export function measureImagePixelSize(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const image = new window.Image()
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        resolve(null)
        return
      }
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => resolve(null)
    image.src = url
  })
}

export function measureVideoPixelSize(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video")
    video.preload = "metadata"
    video.onloadedmetadata = () => {
      if (!video.videoWidth || !video.videoHeight) {
        resolve(null)
        return
      }
      resolve({ width: video.videoWidth, height: video.videoHeight })
    }
    video.onerror = () => resolve(null)
    video.src = url
  })
}

export async function measureMediaPixelSize(
  url: string,
  kind: "image" | "video",
): Promise<{ width: number; height: number } | null> {
  return kind === "video" ? measureVideoPixelSize(url) : measureImagePixelSize(url)
}

export function originForCenteredTile(
  point: { x: number; y: number },
  size: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: point.x - size.width / 2,
    y: point.y - size.height / 2,
  }
}

export function rowPlacementForIndex(
  origin: { x: number; y: number },
  index: number,
  width: number,
): { x: number; y: number } {
  return {
    x: origin.x + index * (width + DEFAULT_STUDIO_TILE_GAP),
    y: origin.y,
  }
}

export function defaultImportTileSize(kind: "image" | "video"): { width: number; height: number } {
  if (kind === "video") {
    return {
      width: Math.round(DEFAULT_STUDIO_TILE_HEIGHT * (16 / 9)),
      height: DEFAULT_STUDIO_TILE_HEIGHT,
    }
  }
  return { width: DEFAULT_STUDIO_TILE_HEIGHT, height: DEFAULT_STUDIO_TILE_HEIGHT }
}
