/**
 * Remotion Snapchat reference renderer — do not change box/text layout here.
 * Sync Fabric + FFmpeg paths to snapchat-overlay-style.constants.mjs instead.
 */
import type { CSSProperties } from "react"
import type { TextItem } from "./types"

export function getTextBackgroundMode(item: TextItem): TextItem["backgroundMode"] {
  return item.backgroundMode ?? (item.backgroundColor ? "box" : "none")
}

export function textJustifyContent(
  textAlign: TextItem["textAlign"]
): CSSProperties["justifyContent"] {
  if (textAlign === "left") return "flex-start"
  if (textAlign === "right") return "flex-end"
  return "center"
}

export function textDecorationStyle(item: TextItem): CSSProperties {
  const strokeWidth = Number(item.textStrokeWidth ?? 0)
  const stroke =
    strokeWidth > 0 ? `${strokeWidth}px ${item.textStrokeColor || "#000000"}` : undefined

  return {
    color: item.color,
    fontFamily: item.fontFamily,
    fontSize: item.fontSize,
    fontWeight: item.fontWeight,
    fontStyle: item.fontStyle,
    textAlign: item.textAlign,
    direction: item.textDirection,
    lineHeight: item.lineHeight,
    letterSpacing: item.letterSpacingPx,
    textShadow: item.textShadow || "none",
    textTransform: item.textTransform === "uppercase" ? "uppercase" : "none",
    WebkitTextStroke: stroke,
    paintOrder: stroke ? "stroke fill" : undefined,
  }
}

export function textBackgroundStyle(item: TextItem): CSSProperties | null {
  const backgroundMode = getTextBackgroundMode(item)
  if (!item.backgroundColor || backgroundMode === "none") {
    return null
  }

  return {
    backgroundColor: item.backgroundColor,
    paddingLeft: item.backgroundPaddingX,
    paddingRight: item.backgroundPaddingX,
    paddingTop: item.backgroundPaddingY ?? 0,
    paddingBottom: item.backgroundPaddingY ?? 0,
    borderRadius: item.backgroundRadius,
  }
}
