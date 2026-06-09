import { FabricObject, Textbox } from "fabric"
import { snapchatBarMetricsForTextbox } from "@/lib/image-editor/snapchat-bar-layout"

/**
 * When stroke width / font size is at or above this ratio, Fabric's canvas text
 * stroke produces visible miter spikes on serif and glyph corners. Above the
 * threshold we fake the outline with a padded rounded rectangle behind the text.
 */
export const TEXT_STROKE_HALO_RATIO = 0.22

export type EditorTextboxWithHalo = Textbox & {
  editorTextStrokeWidth?: number
  editorTextBarMode?: boolean
  editorTextBarPaddingX?: number
  editorTextBarPaddingY?: number
  editorTextBarFullWidth?: number
}

export type TextBarPadding = number | { x: number; y: number }

let haloPatchApplied = false

const EDITOR_TEXTBOX_CUSTOM_PROPS = [
  "editorTextStrokeWidth",
  "editorTextBarMode",
  "editorTextBarPaddingX",
  "editorTextBarPaddingY",
  "editorTextBarFullWidth",
] as const

function registerEditorTextboxCustomProps(): void {
  const existing = new Set(FabricObject.customProperties ?? [])
  for (const prop of EDITOR_TEXTBOX_CUSTOM_PROPS) {
    existing.add(prop)
  }
  FabricObject.customProperties = [...existing]
}

/**
 * Patches {@link Textbox} so halo mode (see {@link applyTextStrokeAppearance}) draws a
 * rounded rectangle instead of Fabric's default rectangular `backgroundColor`.
 */
export function ensureEditorTextboxHaloPatch(): void {
  if (haloPatchApplied) return
  haloPatchApplied = true
  registerEditorTextboxCustomProps()

  const fabricObjectProto = FabricObject.prototype as Pick<
    FabricObject,
    "_renderBackground"
  >
  const renderBackgroundDefault = fabricObjectProto._renderBackground
  const textboxTopOffsetDefault = Textbox.prototype._getTopOffset
  const textboxInitDimensionsDefault = Textbox.prototype.initDimensions

  Textbox.prototype._getTopOffset = function (this: Textbox) {
    const self = this as EditorTextboxWithHalo
    if (self.editorTextBarMode) {
      return -snapchatBarMetricsForTextbox(this).contentHeight / 2
    }
    return textboxTopOffsetDefault.call(this)
  }

  Textbox.prototype.initDimensions = function (this: Textbox) {
    const self = this as EditorTextboxWithHalo
    const barMode = self.editorTextBarMode
    textboxInitDimensionsDefault.call(this)
    if (barMode) {
      this.height = snapchatBarMetricsForTextbox(this).outerHeight
    }
  }

  Textbox.prototype._renderBackground = function (
    this: Textbox,
    ctx: CanvasRenderingContext2D
  ) {
    const self = this as EditorTextboxWithHalo
    const haloW = self.editorTextStrokeWidth

    if (self.editorTextBarMode && self.backgroundColor) {
      const metrics = snapchatBarMetricsForTextbox(this)
      const barWidth = metrics.canvasWidth
      const barHeight = metrics.outerHeight
      ctx.fillStyle = self.backgroundColor
      ctx.fillRect(-barWidth / 2, -barHeight / 2, barWidth, barHeight)
      self._removeShadow(ctx)
      return
    }

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

export function applyTextBarAppearance(
  text: Textbox,
  backgroundColor: string,
  padding: TextBarPadding
): void {
  ensureEditorTextboxHaloPatch()
  const tb = text as EditorTextboxWithHalo
  const hasBar = Boolean(backgroundColor)
  const paddingX = typeof padding === "number" ? padding : padding.x
  const paddingY = typeof padding === "number" ? padding : padding.y
  tb.set({
    editorTextStrokeWidth: undefined,
    editorTextBarMode: hasBar,
    editorTextBarPaddingX: hasBar ? paddingX : undefined,
    editorTextBarPaddingY: hasBar ? paddingY : undefined,
    stroke: "",
    strokeWidth: 0,
    backgroundColor: hasBar ? backgroundColor : "",
    padding: 0,
    paintFirst: "fill",
  })
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
      editorTextBarMode: false,
      backgroundColor: "",
      padding: 0,
      paintFirst: "fill",
    })
    return
  }

  if (shouldUseTextStrokeHalo(fontSize, strokeWidth)) {
    tb.set({
      editorTextStrokeWidth: strokeWidth,
      editorTextBarMode: false,
      stroke: "",
      strokeWidth: 0,
      backgroundColor: strokeColor,
      padding: strokeWidth,
      paintFirst: "fill",
    })
  } else {
    tb.set({
      editorTextStrokeWidth: undefined,
      editorTextBarMode: false,
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
