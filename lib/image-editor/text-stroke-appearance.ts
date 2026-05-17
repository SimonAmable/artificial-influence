import { FabricObject, Textbox } from "fabric"

/**
 * When stroke width / font size is at or above this ratio, Fabric's canvas text
 * stroke produces visible miter spikes on serif and glyph corners. Above the
 * threshold we fake the outline with a padded rounded rectangle behind the text.
 */
export const TEXT_STROKE_HALO_RATIO = 0.22

export type EditorTextboxWithHalo = Textbox & {
  editorTextStrokeWidth?: number
}

let haloPatchApplied = false

/**
 * Patches {@link Textbox} so halo mode (see {@link applyTextStrokeAppearance}) draws a
 * rounded rectangle instead of Fabric's default rectangular `backgroundColor`.
 */
export function ensureEditorTextboxHaloPatch(): void {
  if (haloPatchApplied) return
  haloPatchApplied = true

  const fabricObjectProto = FabricObject.prototype as Pick<
    FabricObject,
    "_renderBackground"
  >
  const renderBackgroundDefault = fabricObjectProto._renderBackground

  Textbox.prototype._renderBackground = function (
    this: Textbox,
    ctx: CanvasRenderingContext2D
  ) {
    const self = this as EditorTextboxWithHalo
    const haloW = self.editorTextStrokeWidth

    if (
      typeof haloW === "number" &&
      haloW > 0 &&
      Boolean(self.backgroundColor) &&
      (!self.stroke || (self.strokeWidth ?? 0) === 0)
    ) {
      const dim = self._getNonTransformedDimensions()
      const pad = Number(self.padding ?? 0)
      const x = -dim.x / 2 - pad
      const y = -dim.y / 2 - pad
      const w = dim.x + pad * 2
      const h = dim.y + pad * 2
      const fs = Number(self.fontSize) || 16
      const rr = Math.min(Math.max(6, fs * 0.28), w / 2, h / 2)
      ctx.fillStyle = self.backgroundColor!
      const rctx = ctx as CanvasRenderingContext2D & {
        roundRect?: (x: number, y: number, w: number, h: number, r: number) => void
      }
      if (typeof rctx.roundRect === "function") {
        rctx.beginPath()
        rctx.roundRect(x, y, w, h, rr)
        rctx.fill()
      } else {
        ctx.fillRect(x, y, w, h)
      }
      self._removeShadow(ctx)
      return
    }

    return renderBackgroundDefault.call(this, ctx)
  }
}

export function shouldUseTextStrokeHalo(fontSize: number, strokeWidth: number): boolean {
  if (strokeWidth <= 0) return false
  return strokeWidth / Math.max(fontSize, 1) >= TEXT_STROKE_HALO_RATIO
}

export function getLogicalTextStrokeWidth(object: EditorTextboxWithHalo): number {
  const w = object.editorTextStrokeWidth
  if (typeof w === "number" && w > 0) return Math.round(w)
  return Math.round(Number(object.strokeWidth ?? 0))
}

export function getEffectiveTextStrokeColor(
  object: EditorTextboxWithHalo,
  fallback: string
): string {
  if (object.editorTextStrokeWidth && object.backgroundColor) {
    return String(object.backgroundColor)
  }
  const s = object.stroke
  if (typeof s === "string" && s.length > 0) return s
  return fallback
}

export function applyTextStrokeAppearance(
  text: Textbox,
  strokeWidth: number,
  strokeColor: string
): void {
  ensureEditorTextboxHaloPatch()
  const fontSize = Number(text.fontSize) || 16
  const tb = text as EditorTextboxWithHalo

  if (strokeWidth <= 0) {
    tb.set({
      stroke: "",
      strokeWidth: 0,
      editorTextStrokeWidth: undefined,
      backgroundColor: "",
      padding: 0,
      paintFirst: "fill",
    })
    return
  }

  if (shouldUseTextStrokeHalo(fontSize, strokeWidth)) {
    tb.set({
      editorTextStrokeWidth: strokeWidth,
      stroke: "",
      strokeWidth: 0,
      backgroundColor: strokeColor,
      padding: strokeWidth,
      paintFirst: "fill",
    })
  } else {
    tb.set({
      editorTextStrokeWidth: undefined,
      stroke: strokeColor,
      strokeWidth: strokeWidth,
      backgroundColor: "",
      padding: 0,
      paintFirst: "stroke",
      strokeLineJoin: "round",
      strokeMiterLimit: 2,
    })
  }
}
