import type { Canvas as FabricCanvas, Textbox } from "fabric"
import {
  applyTextStylePresetToTextbox,
  type EditorTextboxWithPreset,
} from "@/lib/image-editor/apply-text-style-preset"
import {
  isImageEditorSnapchatPreset,
  normalizeImageEditorTextStylePresetId,
} from "@/lib/image-editor/text-style-presets"
import {
  applyTextStrokeAppearance,
  ensureEditorTextboxHaloPatch,
  getEffectiveTextStrokeColor,
  getLogicalTextStrokeWidth,
  type EditorTextboxWithHalo,
} from "@/lib/image-editor/text-stroke-appearance"
import {
  applyBaseImageFilters,
  readFilterSettingsFromCanvas,
} from "@/lib/image-editor/filter-utils"

/**
 * Serializes the current canvas state to JSON string
 */
export function serializeCanvas(canvas: FabricCanvas): string {
  const canvasWithCustomSerializer = canvas as FabricCanvas & {
    toJSON: (propertiesToInclude?: string[]) => unknown
  }
  return JSON.stringify(
    canvasWithCustomSerializer.toJSON([
      "id",
      "name",
      "layerId",
      "editorTextStrokeWidth",
      "editorTextStylePresetId",
      "editorTextBarMode",
      "editorTextBarPaddingX",
      "editorTextBarPaddingY",
      "editorTextBarFullWidth",
      "editorFilterSettings",
    ])
  )
}

/**
 * Restores canvas from a JSON string
 */
export async function deserializeCanvas(
  canvas: FabricCanvas,
  state: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const json = JSON.parse(state)
      ensureEditorTextboxHaloPatch()
      canvas.loadFromJSON(json).then(() => {
        canvas.forEachObject((obj) => {
          if (obj.type !== "textbox" && obj.type !== "i-text") return
          const t = obj as Textbox
          const presetId = normalizeImageEditorTextStylePresetId(
            (t as EditorTextboxWithPreset).editorTextStylePresetId
          )
          if (isImageEditorSnapchatPreset(presetId) || presetId === "original") {
            applyTextStylePresetToTextbox(t, presetId, canvas.width ?? 800)
            return
          }
          const logical = getLogicalTextStrokeWidth(t as EditorTextboxWithHalo)
          if (logical <= 0) return
          const color = getEffectiveTextStrokeColor(
            t as EditorTextboxWithHalo,
            "#000000"
          )
          applyTextStrokeAppearance(t, logical, color)
        })
        const filterSettings = readFilterSettingsFromCanvas(canvas)
        applyBaseImageFilters(canvas, filterSettings)
        canvas.renderAll()
        resolve()
      }).catch(reject)
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Creates a thumbnail from canvas
 */
export function createThumbnail(
  canvas: FabricCanvas,
  maxWidth: number = 80,
  maxHeight: number = 60
): string {
  const multiplier = Math.min(
    maxWidth / canvas.width!,
    maxHeight / canvas.height!
  )
  return canvas.toDataURL({
    format: "png",
    quality: 0.7,
    multiplier,
  })
}
