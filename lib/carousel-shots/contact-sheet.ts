import type { CarouselGridSize, CarouselPanelAspectRatio } from "@/lib/carousel-shots/types"

export const CONTACT_SHEET_GUTTER_FRACTION = 0.015

export type ContactSheetLayout = {
  cols: number
  rows: number
  panelWidth: number
  panelHeight: number
  gutterPx: number
  sheetWidth: number
  sheetHeight: number
  aspectRatio: string
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    const remainder = x % y
    x = y
    y = remainder
  }
  return x || 1
}

export function simplifyAspectRatio(width: number, height: number): string {
  const divisor = gcd(width, height)
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`
}

export function getGridDimensions(gridSize: CarouselGridSize): { cols: number; rows: number } {
  const count = gridSize === 4 ? 2 : 3
  return { cols: count, rows: count }
}

function parsePanelAspectRatio(panelAspectRatio: CarouselPanelAspectRatio): {
  width: number
  height: number
} {
  const [widthRaw, heightRaw] = panelAspectRatio.split(":").map(Number)
  if (!widthRaw || !heightRaw) {
    throw new Error(`Invalid panel aspect ratio: ${panelAspectRatio}`)
  }
  return { width: widthRaw, height: heightRaw }
}

export function computePanelPixelSize(
  panelAspectRatio: CarouselPanelAspectRatio,
  targetLongEdge: number,
): { panelWidth: number; panelHeight: number } {
  const { width, height } = parsePanelAspectRatio(panelAspectRatio)
  if (width >= height) {
    const panelWidth = targetLongEdge
    const panelHeight = Math.round((targetLongEdge * height) / width)
    return { panelWidth, panelHeight }
  }

  const panelHeight = targetLongEdge
  const panelWidth = Math.round((targetLongEdge * width) / height)
  return { panelWidth, panelHeight }
}

export function computeContactSheetLayout(options: {
  gridSize: CarouselGridSize
  panelAspectRatio: CarouselPanelAspectRatio
  targetPanelLongEdge?: number
}): ContactSheetLayout {
  const { cols, rows } = getGridDimensions(options.gridSize)
  const targetPanelLongEdge = options.targetPanelLongEdge ?? 1024
  const { panelWidth, panelHeight } = computePanelPixelSize(
    options.panelAspectRatio,
    targetPanelLongEdge,
  )

  const baseSheetWidth = cols * panelWidth
  const baseSheetHeight = rows * panelHeight
  const gutterPx = Math.max(
    2,
    Math.round(Math.min(baseSheetWidth, baseSheetHeight) * CONTACT_SHEET_GUTTER_FRACTION),
  )

  const sheetWidth = baseSheetWidth + (cols - 1) * gutterPx
  const sheetHeight = baseSheetHeight + (rows - 1) * gutterPx

  return {
    cols,
    rows,
    panelWidth,
    panelHeight,
    gutterPx,
    sheetWidth,
    sheetHeight,
    aspectRatio: simplifyAspectRatio(sheetWidth, sheetHeight),
  }
}

export function getTargetPanelLongEdgeForModel(model: string): number {
  if (model === "google/nano-banana-2") return 1365
  if (model === "openai/gpt-image-2") return 1024
  if (model === "bytedance/seedream-5-pro") return 960
  return 1024
}

export function computePanelRects(
  sheetWidth: number,
  sheetHeight: number,
  cols: number,
  rows: number,
  gutterFraction = CONTACT_SHEET_GUTTER_FRACTION,
): Array<{ left: number; top: number; width: number; height: number }> {
  const gutterPx = Math.max(
    3,
    Math.round(Math.min(sheetWidth, sheetHeight) * gutterFraction),
  )
  const panelWidth = Math.floor((sheetWidth - (cols - 1) * gutterPx) / cols)
  const panelHeight = Math.floor((sheetHeight - (rows - 1) * gutterPx) / rows)
  const gutterInset = Math.max(4, Math.ceil(gutterPx * 0.85))
  const outerInset = 2

  const rects: Array<{ left: number; top: number; width: number; height: number }> = []
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const baseLeft = col * (panelWidth + gutterPx)
      const baseTop = row * (panelHeight + gutterPx)
      const insetLeft = col > 0 ? gutterInset : outerInset
      const insetRight = col < cols - 1 ? gutterInset : outerInset
      const insetTop = row > 0 ? gutterInset : outerInset
      const insetBottom = row < rows - 1 ? gutterInset : outerInset

      rects.push({
        left: baseLeft + insetLeft,
        top: baseTop + insetTop,
        width: Math.max(1, panelWidth - insetLeft - insetRight),
        height: Math.max(1, panelHeight - insetTop - insetBottom),
      })
    }
  }

  return rects
}

export function parsePanelAspectRatioNumbers(
  panelAspectRatio: CarouselPanelAspectRatio,
): { width: number; height: number } {
  return parsePanelAspectRatio(panelAspectRatio)
}

export function centerCropRect(
  width: number,
  height: number,
  aspectRatio: CarouselPanelAspectRatio,
): { left: number; top: number; width: number; height: number } {
  const { width: aspectWidth, height: aspectHeight } = parsePanelAspectRatio(aspectRatio)
  const targetAspect = aspectWidth / aspectHeight
  const currentAspect = width / height

  if (Math.abs(currentAspect - targetAspect) < 0.005) {
    return { left: 0, top: 0, width, height }
  }

  if (currentAspect > targetAspect) {
    const cropWidth = Math.round(height * targetAspect)
    return {
      left: Math.floor((width - cropWidth) / 2),
      top: 0,
      width: cropWidth,
      height,
    }
  }

  const cropHeight = Math.round(width / targetAspect)
  return {
    left: 0,
    top: Math.floor((height - cropHeight) / 2),
    width,
    height: cropHeight,
  }
}

export type PanelBorderTrimOptions = {
  luminanceThreshold: number
  minChannel: number
  minContentFraction: number
  edgeSafetyPx: number
}

export const DEFAULT_PANEL_BORDER_TRIM_OPTIONS: PanelBorderTrimOptions = {
  luminanceThreshold: 234,
  minChannel: 226,
  minContentFraction: 0.01,
  edgeSafetyPx: 2,
}

export type ImageBounds = {
  left: number
  top: number
  width: number
  height: number
}

export function isNearWhitePixel(
  r: number,
  g: number,
  b: number,
  options: PanelBorderTrimOptions = DEFAULT_PANEL_BORDER_TRIM_OPTIONS,
): boolean {
  if (r >= options.minChannel && g >= options.minChannel && b >= options.minChannel) {
    return true
  }

  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  return luminance >= options.luminanceThreshold
}

export function findNearWhiteContentBounds(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
  options: PanelBorderTrimOptions = DEFAULT_PANEL_BORDER_TRIM_OPTIONS,
): ImageBounds | null {
  if (!width || !height || channels < 3) {
    return null
  }

  const minRowContent = Math.max(2, Math.floor(width * options.minContentFraction))
  const minColContent = Math.max(2, Math.floor(height * options.minContentFraction))

  const isContentPixel = (x: number, y: number) => {
    const index = (y * width + x) * channels
    return !isNearWhitePixel(data[index]!, data[index + 1]!, data[index + 2]!, options)
  }

  let left = 0
  for (let x = 0; x < width; x += 1) {
    let count = 0
    for (let y = 0; y < height; y += 1) {
      if (isContentPixel(x, y)) {
        count += 1
      }
    }
    if (count >= minColContent) {
      left = x
      break
    }
  }

  let right = width - 1
  for (let x = width - 1; x >= left; x -= 1) {
    let count = 0
    for (let y = 0; y < height; y += 1) {
      if (isContentPixel(x, y)) {
        count += 1
      }
    }
    if (count >= minColContent) {
      right = x
      break
    }
  }

  let top = 0
  for (let y = 0; y < height; y += 1) {
    let count = 0
    for (let x = left; x <= right; x += 1) {
      if (isContentPixel(x, y)) {
        count += 1
      }
    }
    if (count >= minRowContent) {
      top = y
      break
    }
  }

  let bottom = height - 1
  for (let y = height - 1; y >= top; y -= 1) {
    let count = 0
    for (let x = left; x <= right; x += 1) {
      if (isContentPixel(x, y)) {
        count += 1
      }
    }
    if (count >= minRowContent) {
      bottom = y
      break
    }
  }

  const safety = options.edgeSafetyPx
  const trimmedLeft = Math.min(width - 1, left + safety)
  const trimmedTop = Math.min(height - 1, top + safety)
  const trimmedRight = Math.max(trimmedLeft, right - safety)
  const trimmedBottom = Math.max(trimmedTop, bottom - safety)
  const boundsWidth = trimmedRight - trimmedLeft + 1
  const boundsHeight = trimmedBottom - trimmedTop + 1

  if (boundsWidth < 4 || boundsHeight < 4) {
    return null
  }

  return {
    left: trimmedLeft,
    top: trimmedTop,
    width: boundsWidth,
    height: boundsHeight,
  }
}
