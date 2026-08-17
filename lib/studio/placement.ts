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

type StudioRect = { x: number; y: number; width: number; height: number }

const DEFAULT_STUDIO_ROW_WIDTH = 1440

function placementKey(x: number, y: number): string {
  return `${Math.round(x)}:${Math.round(y)}`
}

function rectCollides(occupied: StudioRect[], rect: StudioRect): boolean {
  return occupied.some((tile) => rectsOverlap(tile, rect))
}

function appendToLowestRow(
  occupied: StudioRect[],
  width: number,
  height: number,
  gap: number,
): { x: number; y: number } {
  const seed = occupied.reduce((lowest, tile) => (tile.y >= lowest.y ? tile : lowest))
  const rowSlop = Math.max(32, seed.height * 0.35)
  const rowTiles = occupied.filter((tile) => Math.abs(tile.y - seed.y) <= rowSlop)
  const rowY = Math.min(...rowTiles.map((tile) => tile.y))
  const rowLeft = Math.min(...rowTiles.map((tile) => tile.x))
  const rowRight = Math.max(...rowTiles.map((tile) => tile.x + tile.width))
  const rowBottom = Math.max(...rowTiles.map((tile) => tile.y + tile.height))

  if (rowRight + gap + width - rowLeft <= DEFAULT_STUDIO_ROW_WIDTH) {
    return { x: rowRight + gap, y: rowY }
  }

  return { x: rowLeft, y: rowBottom + gap }
}

function findSingleOpenPlacement(options: {
  occupied: StudioRect[]
  width: number
  height: number
  anchor?: StudioRect | null
}): { x: number; y: number } {
  const { occupied, width, height, anchor } = options
  const gap = DEFAULT_STUDIO_TILE_GAP

  if (occupied.length === 0) {
    return { x: 0, y: 0 }
  }

  const candidates: Array<{ x: number; y: number; rank: number }> = []
  const push = (x: number, y: number, rank: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    candidates.push({ x, y, rank })
  }

  if (anchor) {
    push(anchor.x + anchor.width + gap, anchor.y, 0)
    push(anchor.x, anchor.y + anchor.height + gap, 1)
  } else {
    const rowAppend = appendToLowestRow(occupied, width, height, gap)
    push(rowAppend.x, rowAppend.y, 0)
  }

  const sorted = [...occupied].sort((a, b) => a.y - b.y || a.x - b.x)
  for (const tile of sorted) {
    push(tile.x + tile.width + gap, tile.y, 2)
    push(tile.x, tile.y + tile.height + gap, 3)
  }

  const minX = Math.min(0, ...occupied.map((tile) => tile.x))
  const maxBottom = Math.max(...occupied.map((tile) => tile.y + tile.height))
  const maxRight = Math.max(...occupied.map((tile) => tile.x + tile.width))
  push(minX, maxBottom + gap, 4)
  push(maxRight + gap, Math.min(...occupied.map((tile) => tile.y)), 5)

  const colWidth = Math.max(width, 96)
  const rowHeight = Math.max(height, DEFAULT_STUDIO_TILE_HEIGHT)
  const startY = Math.min(0, ...occupied.map((tile) => tile.y))
  for (let row = 0; row < 48; row += 1) {
    for (let col = 0; col < 16; col += 1) {
      push(minX + col * (colWidth + gap), startY + row * (rowHeight + gap), 20 + row)
    }
  }

  candidates.sort((a, b) => a.rank - b.rank || a.y - b.y || a.x - b.x)

  const seen = new Set<string>()
  for (const candidate of candidates) {
    const key = placementKey(candidate.x, candidate.y)
    if (seen.has(key)) continue
    seen.add(key)
    if (!rectCollides(occupied, { x: candidate.x, y: candidate.y, width, height })) {
      return { x: candidate.x, y: candidate.y }
    }
  }

  return { x: minX, y: maxBottom + gap }
}

export function findOpenPlacement(options: {
  existing: Array<{ x: number; y: number; width: number; height: number }>
  width: number
  height: number
  anchor?: { x: number; y: number; width: number; height: number } | null
  count?: number
}): Array<{ x: number; y: number }> {
  const count = Math.max(1, options.count ?? 1)
  const occupied: StudioRect[] = options.existing.map((tile) => ({ ...tile }))
  const placements: Array<{ x: number; y: number }> = []

  for (let index = 0; index < count; index += 1) {
    const placement = findSingleOpenPlacement({
      occupied,
      width: options.width,
      height: options.height,
      anchor: index === 0 ? options.anchor ?? null : null,
    })
    placements.push(placement)
    occupied.push({
      x: placement.x,
      y: placement.y,
      width: options.width,
      height: options.height,
    })
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

/** Move newer tiles that land on top of existing ones into the next open slot. */
export function relayoutOriginStackedTiles(
  tiles: StudioTile[],
  options?: { createdAfter?: number },
): {
  tiles: StudioTile[]
  moved: StudioTile[]
} {
  const createdAfter = options?.createdAfter ?? 0
  const sorted = [...tiles].sort((a, b) => {
    const aTime = Date.parse(a.createdAt) || 0
    const bTime = Date.parse(b.createdAt) || 0
    if (aTime !== bTime) return aTime - bTime
    return a.id.localeCompare(b.id)
  })

  const placed: StudioTile[] = []
  const moved: StudioTile[] = []
  const movedById = new Map<string, StudioTile>()

  for (const tile of sorted) {
    const overlaps = placed.some((existing) => rectsOverlap(existing, tile))
    const createdAt = Date.parse(tile.createdAt)
    const canMove =
      !createdAfter || (Number.isFinite(createdAt) && createdAt >= createdAfter)

    if (!overlaps || !canMove) {
      placed.push(tile)
      continue
    }

    const [placement] = findOpenPlacement({
      existing: placed.map((item) => ({
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
      })),
      width: tile.width,
      height: tile.height,
    })
    const next = {
      ...tile,
      x: placement?.x ?? tile.x,
      y: placement?.y ?? tile.y,
    }
    placed.push(next)
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
