import { TIKTOK_ORIGINAL_OVERLAY } from "@/lib/slideshows/overlay-text-style"
import {
  isSnapchatClassicPreset,
  SNAPCHAT_STYLE_PRESET_ID,
  snapchatBarStyleForWidth,
} from "@/lib/video-editor/snapchat-overlay-style"
import type { ImageEditorTextStylePresetId, TextSettings } from "./types"

export type { ImageEditorTextStylePresetId }

export const IMAGE_EDITOR_REFERENCE_WIDTH = 1080

export type ImageEditorTextStylePreset = {
  id: ImageEditorTextStylePresetId
  label: string
  description: string
}

export const IMAGE_EDITOR_TEXT_STYLE_PRESETS: readonly ImageEditorTextStylePreset[] = [
  {
    id: "original",
    label: "Original",
    description: "White TikTok-style stroke text with no background.",
  },
  {
    id: SNAPCHAT_STYLE_PRESET_ID,
    label: "Snapchat Bar",
    description: "Public Sans on a translucent full-width caption bar.",
  },
]

export function imageEditorFontSizeForWidth(width: number, baseAt1080: number) {
  return Math.max(10, Math.round((width / IMAGE_EDITOR_REFERENCE_WIDTH) * baseAt1080))
}

export function strokeWidthForImageEditorFontSize(fontSize: number) {
  return Math.max(
    2,
    Math.round(
      (fontSize / TIKTOK_ORIGINAL_OVERLAY.baseFontSize) * TIKTOK_ORIGINAL_OVERLAY.baseStrokeWidth
    )
  )
}

export type ImageEditorTextPresetSettings = Pick<
  TextSettings,
  "stylePresetId" | "fontFamily" | "fontSize" | "textAlign" | "textStrokeWidth" | "textStrokeColor"
> & {
  textFill: string
  fontWeight: string
  lineHeight?: number
  backgroundColor?: string
  backgroundPaddingX?: number
  backgroundPaddingY?: number
}

export function normalizeImageEditorTextStylePresetId(
  presetId: string | null | undefined
): ImageEditorTextStylePresetId {
  if (isSnapchatClassicPreset(presetId)) {
    return SNAPCHAT_STYLE_PRESET_ID
  }
  return "original"
}

export function isImageEditorSnapchatPreset(
  presetId: string | null | undefined
): presetId is typeof SNAPCHAT_STYLE_PRESET_ID {
  return isSnapchatClassicPreset(presetId)
}

export function textPresetSettingsForCanvas(
  presetId: ImageEditorTextStylePresetId | string,
  canvasWidth: number
): ImageEditorTextPresetSettings {
  const normalized = normalizeImageEditorTextStylePresetId(presetId)

  if (normalized === SNAPCHAT_STYLE_PRESET_ID) {
    const snap = snapchatBarStyleForWidth(canvasWidth)
    return {
      stylePresetId: snap.stylePresetId,
      fontFamily: snap.fontFamily,
      fontSize: snap.fontSize,
      textAlign: snap.textAlign,
      textStrokeWidth: snap.textStrokeWidth,
      textStrokeColor: snap.textStrokeColor,
      textFill: snap.textFill,
      fontWeight: snap.fontWeight,
      lineHeight: snap.lineHeight,
      backgroundColor: snap.backgroundColor,
      backgroundPaddingX: snap.backgroundPaddingX,
      backgroundPaddingY: snap.backgroundPaddingY,
    }
  }

  const fontSize = imageEditorFontSizeForWidth(
    canvasWidth,
    TIKTOK_ORIGINAL_OVERLAY.baseFontSize
  )
  return {
    stylePresetId: normalized,
    fontFamily: TIKTOK_ORIGINAL_OVERLAY.fontFamily,
    fontSize,
    textAlign: "center",
    textStrokeWidth: strokeWidthForImageEditorFontSize(fontSize),
    textStrokeColor: TIKTOK_ORIGINAL_OVERLAY.stroke,
    textFill: TIKTOK_ORIGINAL_OVERLAY.fill,
    fontWeight: String(TIKTOK_ORIGINAL_OVERLAY.fontWeight),
  }
}
