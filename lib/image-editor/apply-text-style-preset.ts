import type { Textbox } from "fabric"
import {
  applyTextBarAppearance,
  applyTextStrokeAppearance,
  type EditorTextboxWithHalo,
} from "@/lib/image-editor/text-stroke-appearance"
import {
  isImageEditorSnapchatPreset,
  normalizeImageEditorTextStylePresetId,
  type ImageEditorTextStylePresetId,
  textPresetSettingsForCanvas,
} from "@/lib/image-editor/text-style-presets"
import { snapchatBarMetricsForTextbox } from "@/lib/image-editor/snapchat-bar-layout"
import {
  SNAPCHAT_REFERENCE_PADDING_Y,
  SNAPCHAT_STYLE_PRESET_ID,
} from "@/lib/video-editor/snapchat-overlay-style"

export type EditorTextboxWithPreset = EditorTextboxWithHalo & {
  editorTextStylePresetId?: ImageEditorTextStylePresetId
}

export function layoutSnapchatBarTextbox(text: Textbox, canvasWidth: number) {
  const currentTop = Number(text.top ?? 0)
  const metrics = snapchatBarMetricsForTextbox(text, canvasWidth)
  const padX = metrics.padX

  text.set({
    width: Math.max(40, canvasWidth - padX * 2),
    left: canvasWidth / 2,
    originX: "center",
    originY: "center",
    top: currentTop,
    textAlign: "center",
    editorTextBarFullWidth: canvasWidth,
    height: metrics.outerHeight,
  } as Record<string, unknown>)
  text.setCoords()
}

export function syncSnapchatBarTextboxLayout(text: Textbox, canvasWidth: number) {
  const tb = text as EditorTextboxWithPreset
  if (!isImageEditorSnapchatPreset(tb.editorTextStylePresetId)) {
    return
  }

  layoutSnapchatBarTextbox(text, canvasWidth)
  if (text.initialized) {
    text.initDimensions()
  } else {
    text.set({ height: snapchatBarMetricsForTextbox(text).outerHeight, padding: 0 })
  }
  text.setCoords()
}

export function applyTextStylePresetToTextbox(
  text: Textbox,
  presetId: ImageEditorTextStylePresetId | string,
  canvasWidth: number
) {
  const normalizedPresetId = normalizeImageEditorTextStylePresetId(presetId)
  const settings = textPresetSettingsForCanvas(normalizedPresetId, canvasWidth)
  const tb = text as EditorTextboxWithPreset
  tb.editorTextStylePresetId = normalizedPresetId

  text.set({
    fill: settings.textFill,
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    textAlign: settings.textAlign,
    fontWeight: settings.fontWeight,
    lineHeight: settings.lineHeight ?? text.lineHeight,
  })

  if (isImageEditorSnapchatPreset(normalizedPresetId)) {
    applyTextBarAppearance(text, settings.backgroundColor ?? "rgba(0,0,0,0.5)", {
      x: settings.backgroundPaddingX ?? 16,
      y: settings.backgroundPaddingY ?? SNAPCHAT_REFERENCE_PADDING_Y,
    })
    syncSnapchatBarTextboxLayout(text, canvasWidth)
    return settings
  }

  applyTextBarAppearance(text, "", 0)
  applyTextStrokeAppearance(text, settings.textStrokeWidth, settings.textStrokeColor)
  return settings
}

export { SNAPCHAT_STYLE_PRESET_ID }
