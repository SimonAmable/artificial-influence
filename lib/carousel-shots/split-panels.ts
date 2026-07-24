import sharp from "sharp"

import {
  centerCropRect,
  computePanelRects,
  CONTACT_SHEET_GUTTER_FRACTION,
  findNearWhiteContentBounds,
  getGridDimensions,
} from "@/lib/carousel-shots/contact-sheet"
import type { CarouselGridSize, CarouselPanelAspectRatio } from "@/lib/carousel-shots/types"

const TRIM_THRESHOLD = 22
const TRIM_BACKGROUND = { r: 255, g: 255, b: 255 } as const

export type SplitContactSheetResult = {
  panels: Buffer[]
  panelWidth: number
  panelHeight: number
}

export type SplitContactSheetOptions = {
  gutterFraction?: number
  targetPanelWidth?: number
  targetPanelHeight?: number
}

type PanelRect = { left: number; top: number; width: number; height: number }

async function trimNearWhiteBorders(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer)
      .trim({
        threshold: TRIM_THRESHOLD,
        background: TRIM_BACKGROUND,
      })
      .png()
      .toBuffer()
  } catch {
    return buffer
  }
}

async function trimPanelBorders(buffer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const bounds = findNearWhiteContentBounds(data, info.width, info.height, info.channels)

  if (!bounds) {
    return buffer
  }

  return sharp(buffer).extract(bounds).png().toBuffer()
}

async function cropPanelToAspectRatio(
  buffer: Buffer,
  aspectRatio: CarouselPanelAspectRatio,
): Promise<Buffer> {
  const image = sharp(buffer)
  const metadata = await image.metadata()
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0

  if (!width || !height) {
    return buffer
  }

  const crop = centerCropRect(width, height, aspectRatio)
  return image.extract(crop).png().toBuffer()
}

async function resizePanelToTarget(
  buffer: Buffer,
  targetPanelWidth?: number,
  targetPanelHeight?: number,
): Promise<Buffer> {
  if (!targetPanelWidth || !targetPanelHeight) {
    return buffer
  }

  return sharp(buffer)
    .resize(targetPanelWidth, targetPanelHeight, { fit: "fill" })
    .png()
    .toBuffer()
}

async function processPanel(
  imageBuffer: Buffer,
  rect: PanelRect,
  aspectRatio: CarouselPanelAspectRatio,
  options: SplitContactSheetOptions,
): Promise<Buffer> {
  const extracted = await sharp(imageBuffer).extract(rect).png().toBuffer()
  const scanned = await trimPanelBorders(extracted)
  const trimmed = await trimNearWhiteBorders(scanned)
  const cropped = await cropPanelToAspectRatio(trimmed, aspectRatio)
  return resizePanelToTarget(cropped, options.targetPanelWidth, options.targetPanelHeight)
}

export async function splitContactSheet(
  imageBuffer: Buffer,
  gridSize: CarouselGridSize,
  aspectRatio: CarouselPanelAspectRatio,
  options: SplitContactSheetOptions = {},
): Promise<SplitContactSheetResult> {
  const gutterFraction = options.gutterFraction ?? CONTACT_SHEET_GUTTER_FRACTION
  const { cols, rows } = getGridDimensions(gridSize)
  const metadata = await sharp(imageBuffer).metadata()
  const sheetWidth = metadata.width
  const sheetHeight = metadata.height

  if (!sheetWidth || !sheetHeight) {
    throw new Error("Contact sheet image is missing dimensions")
  }

  const rects = computePanelRects(sheetWidth, sheetHeight, cols, rows, gutterFraction)
  const panels = await Promise.all(
    rects.map((rect) => processPanel(imageBuffer, rect, aspectRatio, options)),
  )

  const firstPanelMeta = await sharp(panels[0] ?? imageBuffer).metadata()

  return {
    panels,
    panelWidth: firstPanelMeta.width ?? 0,
    panelHeight: firstPanelMeta.height ?? 0,
  }
}
