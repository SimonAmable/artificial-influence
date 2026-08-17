import {
  DEFAULT_STUDIO_TILE_GAP,
  DEFAULT_STUDIO_TILE_HEIGHT,
  type StudioBoardFields,
  type StudioTile,
} from "@/lib/studio/types"
import { isAutoAspectRatio } from "@/lib/utils/aspect-ratios"

function parseAspectRatio(aspectRatio: string | null | undefined): number {
  if (!aspectRatio || isAutoAspectRatio(aspectRatio)) return 1
  const match = aspectRatio.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/)
  if (!match) return 1
  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 1
  }
  return width / height
}

export function tileSizeForAspectRatio(aspectRatio: string | null | undefined): {
  width: number
  height: number
} {
  const ratio = parseAspectRatio(aspectRatio)
  const height = DEFAULT_STUDIO_TILE_HEIGHT
  const width = Math.max(96, Math.round(height * ratio))
  return { width, height }
}

export function tileSizeFromPixelRatio(ratio: number): { width: number; height: number } {
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1
  const height = DEFAULT_STUDIO_TILE_HEIGHT
  return {
    width: Math.max(96, Math.round(height * safeRatio)),
    height,
  }
}

export function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  gap = DEFAULT_STUDIO_TILE_GAP,
): boolean {
  return !(
    a.x + a.width + gap <= b.x ||
    b.x + b.width + gap <= a.x ||
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y
  )
}

export function findOpenPlacement(options: {
  existing: Array<{ x: number; y: number; width: number; height: number }>
  width: number
  height: number
  anchor?: { x: number; y: number; width: number; height: number } | null
  count?: number
}): Array<{ x: number; y: number }> {
  const count = Math.max(1, options.count ?? 1)
  const gap = DEFAULT_STUDIO_TILE_GAP
  const occupied = [...options.existing]
  const placements: Array<{ x: number; y: number }> = []

  let startX = options.anchor
    ? options.anchor.x + options.anchor.width + gap
    : 0
  let startY = options.anchor ? options.anchor.y : 0

  if (!options.anchor && occupied.length > 0) {
    const rightmost = occupied.reduce((max, tile) =>
      tile.x + tile.width > max.x + max.width ? tile : max,
    )
    startX = rightmost.x + rightmost.width + gap
    startY = rightmost.y
  }

  for (let i = 0; i < count; i++) {
    let x = startX + i * (options.width + gap)
    let y = startY
    let attempts = 0

    while (
      attempts < 200 &&
      occupied.some((tile) =>
        rectsOverlap(tile, {
          x,
          y,
          width: options.width,
          height: options.height,
        }),
      )
    ) {
      attempts += 1
      x += options.width + gap
      if (attempts % 8 === 0) {
        x = startX
        y += options.height + gap
      }
    }

    placements.push({ x, y })
    occupied.push({ x, y, width: options.width, height: options.height })
  }

  return placements
}

export function offsetStudioBoardFields(
  base: StudioBoardFields,
  index: number,
): StudioBoardFields {
  if (index <= 0) return base
  return {
    ...base,
    studio_x: base.studio_x + index * (base.studio_width + DEFAULT_STUDIO_TILE_GAP),
  }
}

export function tileFromGeneration(generation: {
  id: string
  url?: string | null
  prompt?: string | null
  model?: string | null
  aspect_ratio?: string | null
  status?: string | null
  reference_image_urls?: string[] | null
  studio_x?: number | null
  studio_y?: number | null
  studio_width?: number | null
  studio_height?: number | null
  created_at?: string | null
}): StudioTile {
  const size = tileSizeForAspectRatio(generation.aspect_ratio)
  const status =
    generation.status === "failed"
      ? "failed"
      : generation.status === "pending" || !generation.url
        ? "pending"
        : "completed"

  return {
    id: generation.id,
    clientKey: generation.id,
    generationId: generation.id,
    url: generation.url ?? null,
    status,
    prompt: generation.prompt ?? null,
    model: generation.model ?? null,
    aspectRatio: generation.aspect_ratio ?? null,
    referenceImageUrls: generation.reference_image_urls ?? [],
    x: typeof generation.studio_x === "number" ? generation.studio_x : 0,
    y: typeof generation.studio_y === "number" ? generation.studio_y : 0,
    width: size.width,
    height: size.height,
    createdAt: generation.created_at ?? new Date().toISOString(),
  }
}
