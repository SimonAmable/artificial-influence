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

export function findNeighborPlacement(options: {
  existing: Array<{ x: number; y: number; width: number; height: number }>
  width: number
  height: number
  source: { x: number; y: number; width: number; height: number }
}): { x: number; y: number } {
  const gap = DEFAULT_STUDIO_TILE_GAP
  const candidates = [
    { x: options.source.x + options.source.width + gap, y: options.source.y },
    { x: options.source.x, y: options.source.y + options.source.height + gap },
  ]

  for (const candidate of candidates) {
    const rect = {
      x: candidate.x,
      y: candidate.y,
      width: options.width,
      height: options.height,
    }
    if (!options.existing.some((tile) => rectsOverlap(tile, rect))) {
      return candidate
    }
  }

  return (
    findOpenPlacement({
      existing: options.existing,
      width: options.width,
      height: options.height,
      anchor: options.source,
    })[0] ?? candidates[0]
  )
}

export function packStudioTiles(
  tiles: StudioTile[],
  options?: { maxRowWidth?: number; origin?: { x: number; y: number } },
): StudioTile[] {
  if (tiles.length === 0) return tiles

  const gap = DEFAULT_STUDIO_TILE_GAP
  const maxRowWidth = Math.max(320, options?.maxRowWidth ?? 1200)
  const originX = options?.origin?.x ?? 0
  const originY = options?.origin?.y ?? 0

  const sorted = [...tiles].sort((a, b) => {
    const aTime = Date.parse(a.createdAt) || 0
    const bTime = Date.parse(b.createdAt) || 0
    if (bTime !== aTime) return bTime - aTime
    return a.id.localeCompare(b.id)
  })

  let x = originX
  let y = originY
  let rowHeight = 0
  const packed = new Map<string, StudioTile>()

  for (const tile of sorted) {
    if (x > originX && x + tile.width - originX > maxRowWidth) {
      x = originX
      y += rowHeight + gap
      rowHeight = 0
    }
    packed.set(tile.id, { ...tile, x, y })
    x += tile.width + gap
    rowHeight = Math.max(rowHeight, tile.height)
  }

  return tiles.map((tile) => packed.get(tile.id) ?? tile)
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
  type?: string | null
  aspect_ratio?: string | null
  status?: string | null
  reference_image_urls?: string[] | null
  studio_x?: number | null
  studio_y?: number | null
  studio_width?: number | null
  studio_height?: number | null
  created_at?: string | null
}): StudioTile {
  const kind = generation.type === "video" ? "video" : "image"
  const size = tileSizeForAspectRatio(
    generation.aspect_ratio ?? (kind === "video" ? "16:9" : null),
  )
  const status =
    generation.status === "failed"
      ? "failed"
      : generation.status === "pending" || !generation.url
        ? "pending"
        : "completed"
  const width =
    typeof generation.studio_width === "number" && generation.studio_width > 0
      ? generation.studio_width
      : size.width
  const height =
    typeof generation.studio_height === "number" && generation.studio_height > 0
      ? generation.studio_height
      : size.height

  return {
    id: generation.id,
    clientKey: generation.id,
    generationId: generation.id,
    url: generation.url ?? null,
    kind,
    status,
    prompt: generation.prompt ?? null,
    model: generation.model ?? null,
    aspectRatio: generation.aspect_ratio ?? null,
    referenceImageUrls: generation.reference_image_urls ?? [],
    x: typeof generation.studio_x === "number" ? generation.studio_x : 0,
    y: typeof generation.studio_y === "number" ? generation.studio_y : 0,
    width,
    height,
    createdAt: generation.created_at ?? new Date().toISOString(),
  }
}

/** Keep the oldest tile at the origin; slide later stacked 0,0 tiles into open slots. */
export function relayoutOriginStackedTiles(tiles: StudioTile[]): {
  tiles: StudioTile[]
  moved: StudioTile[]
} {
  const originTiles = tiles.filter((tile) => Math.abs(tile.x) < 4 && Math.abs(tile.y) < 4)
  if (originTiles.length <= 1) {
    return { tiles, moved: [] }
  }

  const sorted = [...originTiles].sort((a, b) => {
    const aTime = Date.parse(a.createdAt) || 0
    const bTime = Date.parse(b.createdAt) || 0
    if (aTime !== bTime) return aTime - bTime
    return a.id.localeCompare(b.id)
  })
  const keepId = sorted[0]?.id
  const toMove = sorted.slice(1)
  const occupied = tiles
    .filter((tile) => tile.id === keepId || Math.abs(tile.x) >= 4 || Math.abs(tile.y) >= 4)
    .map((tile) => ({
      x: tile.x,
      y: tile.y,
      width: tile.width,
      height: tile.height,
    }))

  const moved: StudioTile[] = []
  const movedById = new Map<string, StudioTile>()

  for (const tile of toMove) {
    const [placement] = findOpenPlacement({
      existing: occupied,
      width: tile.width,
      height: tile.height,
    })
    const next = {
      ...tile,
      x: placement?.x ?? tile.x,
      y: placement?.y ?? tile.y,
    }
    occupied.push({
      x: next.x,
      y: next.y,
      width: next.width,
      height: next.height,
    })
    if (next.x !== tile.x || next.y !== tile.y) {
      moved.push(next)
      movedById.set(tile.id, next)
    }
  }

  if (moved.length === 0) {
    return { tiles, moved: [] }
  }

  return {
    tiles: tiles.map((tile) => movedById.get(tile.id) ?? tile),
    moved,
  }
}
