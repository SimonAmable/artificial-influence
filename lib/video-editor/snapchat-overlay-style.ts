import {
  isSnapchatClassicPreset,
  SNAPCHAT_ASS_FONT_NAME,
  SNAPCHAT_CSS_FONT_STACK,
  SNAPCHAT_LEGACY_IMAGE_EDITOR_PRESET_ID,
  SNAPCHAT_REFERENCE_FONT_SIZE,
  SNAPCHAT_REFERENCE_FONT_WEIGHT,
  SNAPCHAT_REFERENCE_LINE_HEIGHT,
  SNAPCHAT_REFERENCE_PADDING_X,
  SNAPCHAT_REFERENCE_PADDING_Y,
  SNAPCHAT_REFERENCE_WIDTH,
  SNAPCHAT_STYLE_PRESET_ID,
  snapchatFontSizeForWidth,
} from "./snapchat-overlay-style.constants.mjs"
import type { TextItem } from "./types"

export {
  isSnapchatClassicPreset,
  SNAPCHAT_ASS_FONT_NAME,
  SNAPCHAT_CSS_FONT_STACK,
  SNAPCHAT_LEGACY_IMAGE_EDITOR_PRESET_ID,
  SNAPCHAT_REFERENCE_FONT_SIZE,
  SNAPCHAT_REFERENCE_FONT_WEIGHT,
  SNAPCHAT_REFERENCE_LINE_HEIGHT,
  SNAPCHAT_REFERENCE_PADDING_X,
  SNAPCHAT_REFERENCE_PADDING_Y,
  SNAPCHAT_REFERENCE_WIDTH,
  SNAPCHAT_STYLE_PRESET_ID,
  estimateSnapchatWrappedLineCount,
  snapchatBarContentHeight,
  snapchatBarHeightForLineCount,
  snapchatFontSizeForWidth,
  snapchatPaddingForWidth,
}

export type SnapchatBarStyleSettings = {
  stylePresetId: typeof SNAPCHAT_STYLE_PRESET_ID
  fontFamily: string
  fontWeight: string
  fontSize: number
  textAlign: "center"
  lineHeight: number
  textFill: string
  textStrokeWidth: 0
  textStrokeColor: string
  backgroundColor: string
  backgroundPaddingX: number
  backgroundPaddingY: number
}

export function normalizeSnapchatStylePresetId(
  stylePresetId: string | null | undefined
): typeof SNAPCHAT_STYLE_PRESET_ID | null {
  return isSnapchatClassicPreset(stylePresetId) ? SNAPCHAT_STYLE_PRESET_ID : null
}

export const SNAPCHAT_CLASSIC_TEXT_PATCH: Partial<TextItem> = {
  stylePresetId: SNAPCHAT_STYLE_PRESET_ID,
  fontFamily: SNAPCHAT_CSS_FONT_STACK,
  fontWeight: SNAPCHAT_REFERENCE_FONT_WEIGHT,
  fontStyle: "normal",
  fontSize: SNAPCHAT_REFERENCE_FONT_SIZE,
  textAlign: "center",
  lineHeight: SNAPCHAT_REFERENCE_LINE_HEIGHT,
  letterSpacingPx: 0,
  color: "#ffffff",
  backgroundColor: "rgba(0,0,0,0.5)",
  backgroundMode: "box",
  backgroundPaddingX: SNAPCHAT_REFERENCE_PADDING_X,
  backgroundPaddingY: SNAPCHAT_REFERENCE_PADDING_Y,
  backgroundRadius: 0,
  textStrokeColor: "#000000",
  textStrokeWidth: 0,
  textShadow: "none",
  textTransform: "none",
}

export function snapchatPaddingForWidth(width: number) {
  const scale = width / SNAPCHAT_REFERENCE_WIDTH
  return {
    x: Math.round(SNAPCHAT_REFERENCE_PADDING_X * scale),
    y: Math.round(SNAPCHAT_REFERENCE_PADDING_Y * scale),
  }
}

/** Image-editor / export scaling — Remotion uses {@link SNAPCHAT_CLASSIC_TEXT_PATCH} directly. */
export function snapchatBarStyleForWidth(width: number): SnapchatBarStyleSettings {
  const fontSize = snapchatFontSizeForWidth(width)
  const padding = snapchatPaddingForWidth(width)
  return {
    stylePresetId: SNAPCHAT_STYLE_PRESET_ID,
    fontFamily: String(SNAPCHAT_CLASSIC_TEXT_PATCH.fontFamily),
    fontWeight: String(SNAPCHAT_CLASSIC_TEXT_PATCH.fontWeight),
    fontSize,
    textAlign: "center",
    lineHeight: Number(SNAPCHAT_CLASSIC_TEXT_PATCH.lineHeight),
    textFill: String(SNAPCHAT_CLASSIC_TEXT_PATCH.color),
    textStrokeWidth: 0,
    textStrokeColor: String(SNAPCHAT_CLASSIC_TEXT_PATCH.textStrokeColor),
    backgroundColor: String(SNAPCHAT_CLASSIC_TEXT_PATCH.backgroundColor),
    backgroundPaddingX: padding.x,
    backgroundPaddingY: padding.y,
  }
}

/** Remotion flex content block height (fontSize × lineHeight × lines). */
export function snapchatBarContentHeight(
  fontSize: number,
  lineHeight: number,
  lineCount = 1
): number {
  return fontSize * lineHeight * Math.max(1, lineCount)
}

/** Matches Remotion box height: content block + vertical padding. */
export function snapchatBarHeightForLineCount(
  fontSize: number,
  lineHeight: number,
  padY: number,
  lineCount = 1
): number {
  return Math.ceil(snapchatBarContentHeight(fontSize, lineHeight, lineCount) + padY * 2)
}

/** Same wrap estimate used for Remotion overlay item sizing. */
export function estimateSnapchatWrappedLineCount(
  text: string,
  fontSize: number,
  contentWidth: number
): number {
  const plainLines = Math.max(1, text.split(/\r?\n/).length)
  const averageCharWidth = Math.max(1, fontSize * 0.56)
  const charsPerLine = Math.max(12, Math.floor(contentWidth / averageCharWidth))
  const estimatedLines = Math.max(plainLines, Math.ceil(text.length / charsPerLine))
  return estimatedLines
}
