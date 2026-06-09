import type { Textbox } from "fabric"
import {
  SNAPCHAT_REFERENCE_LINE_HEIGHT,
  SNAPCHAT_REFERENCE_PADDING_X,
  SNAPCHAT_REFERENCE_PADDING_Y,
  snapchatPaddingForWidth,
} from "@/lib/video-editor/snapchat-overlay-style"

type SnapchatBarTextbox = Textbox & {
  editorTextBarPaddingX?: number
  editorTextBarPaddingY?: number
  editorTextBarFullWidth?: number
}

function snapchatCanvasWidthForTextbox(text: Textbox): number {
  const tb = text as SnapchatBarTextbox
  const canvasW = Number(text.canvas?.width ?? 0)
  const stored = Number(tb.editorTextBarFullWidth ?? 0)
  return Math.max(canvasW, stored, Number(text.width ?? 0))
}

/** Fabric glyph metrics — tighter than CSS flex box math, matches rendered text. */
export function snapchatBarMetricsForTextbox(text: Textbox, canvasWidthOverride?: number) {
  const tb = text as SnapchatBarTextbox
  const fontSize = Number(text.fontSize) || 16
  const lineHeight = Number(text.lineHeight) || SNAPCHAT_REFERENCE_LINE_HEIGHT
  const canvasWidth = canvasWidthOverride ?? snapchatCanvasWidthForTextbox(text)
  const scaledPadding = snapchatPaddingForWidth(canvasWidth)
  const padX = tb.editorTextBarPaddingX ?? scaledPadding.x ?? SNAPCHAT_REFERENCE_PADDING_X
  const padY = tb.editorTextBarPaddingY ?? scaledPadding.y ?? SNAPCHAT_REFERENCE_PADDING_Y
  const contentHeight = Math.max(1, text.calcTextHeight())
  const outerHeight = Math.ceil(contentHeight + padY * 2)

  return {
    fontSize,
    lineHeight,
    padX,
    padY,
    canvasWidth,
    contentWidth: Math.max(1, canvasWidth - padX * 2),
    contentHeight,
    outerHeight,
  }
}
