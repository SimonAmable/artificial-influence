"use client"

import * as React from "react"
import { CaretDown, CaretUp, CornersOut } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui/slider"
import { BrandFontPicker } from "@/components/brand-kit/brand-font-picker"
import { useImageEditor } from "./image-editor-provider"
import { PRESET_COLORS, BRUSH_SIZES, TEXT_DEFAULTS } from "@/lib/image-editor/constants"
import {
  IMAGE_EDITOR_SYSTEM_FONT_OPTIONS,
  getPrimaryFontFaceName,
  googleFontToFabricCss,
} from "@/lib/image-editor/editor-font-options"
import { loadFont } from "@/lib/google-fonts"
import type { FabricObject, Textbox } from "fabric"
import type { EditorTextAlign } from "@/lib/image-editor/types"
import {
  applyTextStrokeAppearance,
  getEffectiveTextStrokeColor,
  getLogicalTextStrokeWidth,
  type EditorTextboxWithHalo,
} from "@/lib/image-editor/text-stroke-appearance"

interface ImageEditorColorPickerProps {
  className?: string
}

type SelectedKind = "text" | "rectangle" | "arrow" | "image" | null

type EditorFabricObject = FabricObject & {
  type?: string
  name?: string
  id?: string
  text?: string
  textAlign?: string
  fill?: string
  stroke?: string
  strokeWidth?: number
  fontSize?: number
  fontFamily?: string
  isEditing?: boolean
  backgroundColor?: string
  editorTextStrokeWidth?: number
  opacity?: number
  getObjects?: () => FabricObject[]
  set: (key: string | Record<string, unknown>, value?: unknown) => void
  setCoords?: () => void
}

function getSelectedKind(object: EditorFabricObject | null): SelectedKind {
  if (!object) return null
  if (object.type === "activeSelection") return null
  if (object.type === "textbox" || object.type === "i-text") return "text"
  if (object.type === "rect") return "rectangle"
  if (object.name === "Arrow") return "arrow"
  if (object.type === "image") return "image"
  return null
}

function normColor(c: string | undefined | null): string {
  if (c == null || c === "") return ""
  const t = String(c).trim().toLowerCase()
  if (t.startsWith("#") && t.length === 4) {
    return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`
  }
  return t
}

/** `#rrggbb` for `<input type="color">` (Fabric may use short hex or `rgb()`). */
function fillToHex6ForColorInput(fill: string | undefined | null): string {
  const raw = String(fill ?? "").trim()
  if (!raw) return "#ffffff"
  const lower = raw.toLowerCase()
  if (lower.startsWith("#")) {
    if (/^#[0-9a-f]{6}$/.test(lower)) return lower
    if (/^#[0-9a-f]{3}$/.test(lower)) {
      return `#${lower[1]}${lower[1]}${lower[2]}${lower[2]}${lower[3]}${lower[3]}`
    }
  }
  const m = raw.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i)
  if (m) {
    const toHex = (n: string) =>
      Math.min(255, Math.max(0, parseInt(n, 10)))
        .toString(16)
        .padStart(2, "0")
    return `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`
  }
  return "#ffffff"
}

function parseTextAlign(v: string | undefined): EditorTextAlign {
  if (v === "center" || v === "right") return v
  return "left"
}

function TextAlignPreview({ kind }: { kind: EditorTextAlign }) {
  const rows = [14, 10, 12]
  return (
    <span
      className="inline-flex h-[14px] w-[18px] flex-col justify-center gap-[3px] text-zinc-400"
      aria-hidden
    >
      {rows.map((w, i) => (
        <span
          key={i}
          className="h-[3px] shrink-0 rounded-full bg-current"
          style={{
            width: w,
            marginLeft:
              kind === "center" ? (18 - w) / 2 : kind === "right" ? 18 - w : 0,
          }}
        />
      ))}
    </span>
  )
}

export function ImageEditorColorPicker({ className }: ImageEditorColorPickerProps) {
  const { state, setBrushColor, setBrushSize, setCanvasAspectRatio, dispatch, saveToHistory } =
    useImageEditor()
  const { activeTool, brushSettings, textSettings, shapeSettings, canvasAspectRatio, canvas } =
    state
  const [customColor, setCustomColor] = React.useState(brushSettings.color)
  const [isPropertiesOpen, setIsPropertiesOpen] = React.useState(false)
  const [isCanvasRatioOpen, setIsCanvasRatioOpen] = React.useState(false)
  const [selectedKind, setSelectedKind] = React.useState<SelectedKind>(null)
  const [activeTextFontFamily, setActiveTextFontFamily] =
    React.useState<string | null>(null)
  const [textDraft, setTextDraft] = React.useState("")
  const [textControlSnap, setTextControlSnap] = React.useState<{
    fontSize: number
    textStrokeWidth: number
    textAlign: EditorTextAlign
    fill: string
  } | null>(null)
  const [imageOpacitySnap, setImageOpacitySnap] = React.useState<number | null>(
    null
  )

  React.useEffect(() => {
    if (!canvas) {
      setSelectedKind(null)
      setActiveTextFontFamily(null)
      setTextDraft("")
      setTextControlSnap(null)
      setImageOpacitySnap(null)
      return
    }

    const syncSelection = () => {
      const activeObject = canvas.getActiveObject() as EditorFabricObject | null
      const kind = getSelectedKind(activeObject)
      setSelectedKind(kind)
      if (kind === "text" && activeObject?.fontFamily) {
        setActiveTextFontFamily(String(activeObject.fontFamily))
      } else {
        setActiveTextFontFamily(null)
      }

      if (kind === "text" && activeObject) {
        if (!activeObject.isEditing) {
          setTextDraft(String(activeObject.text ?? ""))
        }
        setTextControlSnap({
          fontSize: Math.round(
            Number(activeObject.fontSize ?? TEXT_DEFAULTS.fontSize)
          ),
          textStrokeWidth: getLogicalTextStrokeWidth(
            activeObject as EditorTextboxWithHalo
          ),
          textAlign: parseTextAlign(activeObject.textAlign),
          fill: String(activeObject.fill ?? TEXT_DEFAULTS.fill),
        })
        setCustomColor(
          fillToHex6ForColorInput(String(activeObject.fill ?? TEXT_DEFAULTS.fill))
        )
      } else {
        setTextDraft("")
        setTextControlSnap(null)
        if (activeTool === "text") {
          setCustomColor(fillToHex6ForColorInput(brushSettings.color))
        }
      }

      if (kind === "image" && activeObject) {
        const o = Number(activeObject.opacity)
        setImageOpacitySnap(Number.isFinite(o) ? Math.min(1, Math.max(0, o)) : 1)
      } else {
        setImageOpacitySnap(null)
      }
    }

    canvas.on("selection:created", syncSelection)
    canvas.on("selection:updated", syncSelection)
    canvas.on("selection:cleared", syncSelection)
    canvas.on("object:modified", syncSelection)
    canvas.on("text:changed", syncSelection)
    syncSelection()

    return () => {
      canvas.off("selection:created", syncSelection)
      canvas.off("selection:updated", syncSelection)
      canvas.off("selection:cleared", syncSelection)
      canvas.off("object:modified", syncSelection)
      canvas.off("text:changed", syncSelection)
    }
  }, [canvas, activeTool, brushSettings.color])

  const applyToActiveObject = React.useCallback(
    (updater: (object: EditorFabricObject) => void) => {
      if (!canvas) return
      const object = canvas.getActiveObject() as EditorFabricObject | null
      if (!object) return

      updater(object)
      object.setCoords?.()
      canvas.requestRenderAll()
    },
    [canvas]
  )

  const applyFontFamily = React.useCallback(
    async (fontFamilyCss: string) => {
      dispatch({ type: "SET_TEXT_FONT", fontFamily: fontFamilyCss })
      applyToActiveObject((object) => {
        if (getSelectedKind(object) === "text") {
          object.set("fontFamily", fontFamilyCss)
        }
      })

      const faceName = getPrimaryFontFaceName(fontFamilyCss)
      const px = Math.max(textSettings.fontSize, 14)
      try {
        await document.fonts.load(`400 ${px}px "${faceName}"`)
      } catch {
        try {
          await document.fonts.load(`400 ${px}px ${faceName}`)
        } catch {
          // system fonts or unavailable faces
        }
      }
      try {
        await document.fonts.ready
      } catch {
        //
      }

      canvas?.requestRenderAll()

      const active = canvas?.getActiveObject() as EditorFabricObject | null
      if (canvas && active && getSelectedKind(active) === "text") {
        applyTextStrokeAppearance(
          active as Textbox,
          getLogicalTextStrokeWidth(active as EditorTextboxWithHalo),
          getEffectiveTextStrokeColor(
            active as EditorTextboxWithHalo,
            textSettings.textStrokeColor
          )
        )
        active.setCoords?.()
        canvas.requestRenderAll()
      }
    },
    [applyToActiveObject, canvas, dispatch, textSettings.fontSize, textSettings.textStrokeColor]
  )

  const applyToActiveText = React.useCallback(
    (fn: (object: EditorFabricObject) => void) => {
      if (!canvas) return
      const object = canvas.getActiveObject() as EditorFabricObject | null
      if (!object || getSelectedKind(object) !== "text") return
      fn(object)
      object.setCoords?.()
      canvas.requestRenderAll()
    },
    [canvas]
  )

  const applyToActiveImage = React.useCallback(
    (fn: (object: EditorFabricObject) => void) => {
      if (!canvas) return
      const object = canvas.getActiveObject() as EditorFabricObject | null
      if (!object || getSelectedKind(object) !== "image") return
      fn(object)
      object.setCoords?.()
      canvas.requestRenderAll()
    },
    [canvas]
  )

  const handleColorChange = (color: string) => {
    setBrushColor(color)
    setCustomColor(color)

    if (canvas) {
      const activeObject = canvas.getActiveObject() as EditorFabricObject | null
      if (activeObject && getSelectedKind(activeObject) === "text") {
        setTextControlSnap((prev) => {
          const base = prev ?? {
            fontSize: textSettings.fontSize,
            textStrokeWidth: textSettings.textStrokeWidth,
            textAlign: textSettings.textAlign,
            fill: TEXT_DEFAULTS.fill,
          }
          return { ...base, fill: color }
        })
      }
    }

    applyToActiveObject((object) => {
      const kind = getSelectedKind(object)
      if (kind === "text") {
        object.set("fill", color)
      } else if (kind === "rectangle") {
        object.set("stroke", color)
        if (shapeSettings.rectangleFilled) {
          object.set("fill", color)
        }
      } else if (kind === "arrow") {
        const children = object.getObjects?.() ?? []
        children.forEach((child) => {
          const line = child as EditorFabricObject
          line.set("stroke", color)
        })
      }
    })
  }

  const handleCustomColorInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleColorChange(e.target.value)
  }

  const aspectRatioOptions = [
    { label: "Auto", ratio: null as number | null },
    { label: "1:1", ratio: 1 },
    { label: "4:3", ratio: 4 / 3 },
    { label: "3:2", ratio: 3 / 2 },
    { label: "16:9", ratio: 16 / 9 },
    { label: "9:16", ratio: 9 / 16 },
  ]

  const activeAspectRatioLabel =
    aspectRatioOptions.find((option) => option.ratio === canvasAspectRatio)?.label ||
    "Auto"

  /** Colors at the top apply to brush and shapes; hidden for text- and image-focused panels. */
  const showTopColorPickers =
    selectedKind !== "text" &&
    selectedKind !== "image" &&
    !(selectedKind === null && (activeTool === "text" || activeTool === "image"))

  const showBrushTuning =
    selectedKind === null &&
    (activeTool === "brush" || activeTool === "lasso")

  const showShapeStrokeWidth =
    selectedKind === "rectangle" ||
    selectedKind === "arrow" ||
    (selectedKind === null &&
      (activeTool === "rectangle" || activeTool === "arrow"))

  const showRectangleFill =
    selectedKind === "rectangle" ||
    (selectedKind === null && activeTool === "rectangle")

  const showTextSection =
    selectedKind === "text" ||
    (selectedKind === null && activeTool === "text")

  React.useEffect(() => {
    if (
      showTopColorPickers ||
      (showTextSection && selectedKind !== "text")
    ) {
      setCustomColor(fillToHex6ForColorInput(brushSettings.color))
    }
  }, [
    brushSettings.color,
    selectedKind,
    showTextSection,
    showTopColorPickers,
  ])

  const showImageOpacity = selectedKind === "image"

  const hasPropertiesBody =
    showTopColorPickers ||
    showBrushTuning ||
    showShapeStrokeWidth ||
    showRectangleFill ||
    showImageOpacity ||
    showTextSection

  const pickerResolvedFontFamily = activeTextFontFamily ?? textSettings.fontFamily

  const displayTextFill = textControlSnap?.fill ?? brushSettings.color
  const displayTextSize = textControlSnap?.fontSize ?? textSettings.fontSize
  const displayTextStroke =
    textControlSnap?.textStrokeWidth ?? textSettings.textStrokeWidth
  const displayTextAlign = textControlSnap?.textAlign ?? textSettings.textAlign
  const isTextTarget = selectedKind === "text"

  const displayImageOpacity = imageOpacitySnap ?? 1

  const brushSummary = `${brushSettings.size}px`

  const propertiesTriggerSummary =
    selectedKind === "text"
      ? `${displayTextSize}px · text`
      : selectedKind === "rectangle" || selectedKind === "arrow"
        ? `stroke ${shapeSettings.strokeWidth}px`
        : selectedKind === "image"
          ? `Opacity ${Math.round(displayImageOpacity * 100)}%`
          : brushSummary

  const triggerSwatchColor =
    selectedKind === "text" ? displayTextFill : brushSettings.color

  return (
    <div
      className={cn(
        "flex h-8 min-h-8 flex-row items-center gap-1.5 sm:gap-2",
        className
      )}
    >
      <div className="relative min-h-8 min-w-0 max-w-[min(100%,11rem)] shrink sm:max-w-[13rem]">
        <button
          type="button"
          className="flex h-8 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-white/10 bg-zinc-900/90 px-2 text-zinc-100 backdrop-blur-md"
          onClick={() => setIsPropertiesOpen((prev) => !prev)}
          aria-expanded={isPropertiesOpen}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <div
              className="h-[18px] w-[18px] shrink-0 rounded-full border border-white/20"
              style={{ backgroundColor: triggerSwatchColor }}
              aria-hidden
            />
            <span className="truncate text-[11px] leading-tight text-zinc-200 tabular-nums">
              {propertiesTriggerSummary}
            </span>
          </div>
          {isPropertiesOpen ? <CaretUp size={12} /> : <CaretDown size={12} />}
        </button>

        {isPropertiesOpen && (
          <div className="absolute left-0 top-[calc(100%+6px)] z-40 max-h-[min(70vh,28rem)] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto overflow-x-hidden rounded-lg border border-white/10 bg-zinc-900/95 p-4 shadow-xl backdrop-blur-md">
            {showTopColorPickers && (
              <>
                <div className="mb-4">
                  <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">
                    Preset Colors
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        className={cn(
                          "w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110",
                          brushSettings.color === color
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-white/10"
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => handleColorChange(color)}
                      />
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">
                    Custom Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customColor}
                      onChange={handleCustomColorInput}
                      className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
                    />
                    <input
                      type="text"
                      value={customColor}
                      onChange={handleCustomColorInput}
                      className="flex-1 h-9 px-3 bg-zinc-800 border border-white/10 rounded-lg text-sm text-zinc-300 uppercase"
                      placeholder="#ffffff"
                    />
                  </div>
                </div>
              </>
            )}

            {showBrushTuning && (
              <>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-zinc-500 uppercase tracking-wider">
                      Brush Size
                    </label>
                    <span className="text-xs text-zinc-400">{brushSettings.size}px</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    {BRUSH_SIZES.map((size) => (
                      <button
                        key={size}
                        className={cn(
                          "flex-1 h-8 rounded-md text-xs transition-colors",
                          brushSettings.size === size
                            ? "bg-primary/20 text-primary border border-primary/40"
                            : "bg-zinc-800 text-zinc-400 border border-white/5 hover:bg-zinc-700"
                        )}
                        onClick={() => setBrushSize(size)}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                  <div className="py-2">
                    <Slider
                      value={[brushSettings.size]}
                      onValueChange={(value) => setBrushSize(value[0])}
                      min={1}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-zinc-500 uppercase tracking-wider">
                      Opacity
                    </label>
                    <span className="text-xs text-zinc-400">
                      {Math.round(brushSettings.opacity * 100)}%
                    </span>
                  </div>
                  <div className="py-2">
                    <Slider
                      value={[brushSettings.opacity]}
                      onValueChange={(value) =>
                        dispatch({ type: "SET_BRUSH_OPACITY", opacity: value[0] })
                      }
                      min={0.1}
                      max={1}
                      step={0.05}
                      className="w-full"
                    />
                  </div>
                </div>
              </>
            )}

            {showShapeStrokeWidth && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-zinc-500 uppercase tracking-wider">
                    Stroke Width
                  </label>
                  <span className="text-xs text-zinc-400">
                    {shapeSettings.strokeWidth}px
                  </span>
                </div>
                <div className="py-2">
                  <Slider
                    value={[shapeSettings.strokeWidth]}
                    onValueChange={(value) => {
                      const width = value[0]
                      dispatch({ type: "SET_SHAPE_STROKE_WIDTH", width })
                      applyToActiveObject((object) => {
                        const kind = getSelectedKind(object)
                        if (kind === "rectangle") {
                          object.set("strokeWidth", width)
                        } else if (kind === "arrow") {
                          const children = object.getObjects?.() ?? []
                          children.forEach((child) => {
                            const line = child as EditorFabricObject
                            line.set("strokeWidth", width)
                          })
                        }
                      })
                    }}
                    min={1}
                    max={20}
                    step={1}
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {showRectangleFill && (
              <div className="mb-4">
                <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">
                  Rectangle Fill
                </label>
                <div className="flex items-center gap-2">
                  <button
                    className={cn(
                      "h-8 px-3 rounded-md text-xs transition-colors",
                      shapeSettings.rectangleFilled
                        ? "bg-primary/20 text-primary border border-primary/40"
                        : "bg-zinc-800 text-zinc-400 border border-white/5 hover:bg-zinc-700"
                    )}
                    onClick={() => {
                      dispatch({ type: "SET_RECTANGLE_FILLED", filled: true })
                      applyToActiveObject((object) => {
                        if (getSelectedKind(object) === "rectangle") {
                          object.set("fill", brushSettings.color)
                        }
                      })
                    }}
                  >
                    Fill
                  </button>
                  <button
                    className={cn(
                      "h-8 px-3 rounded-md text-xs transition-colors",
                      !shapeSettings.rectangleFilled
                        ? "bg-primary/20 text-primary border border-primary/40"
                        : "bg-zinc-800 text-zinc-400 border border-white/5 hover:bg-zinc-700"
                    )}
                    onClick={() => {
                      dispatch({ type: "SET_RECTANGLE_FILLED", filled: false })
                      applyToActiveObject((object) => {
                        if (getSelectedKind(object) === "rectangle") {
                          object.set("fill", "transparent")
                        }
                      })
                    }}
                  >
                    No Fill
                  </button>
                </div>
              </div>
            )}

            {showImageOpacity && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-zinc-500 uppercase tracking-wider">
                    Image opacity
                  </label>
                  <span className="text-xs text-zinc-400 tabular-nums">
                    {Math.round(displayImageOpacity * 100)}%
                  </span>
                </div>
                <div className="py-2">
                  <Slider
                    value={[displayImageOpacity]}
                    onValueChange={(value) => {
                      const opacity = value[0]
                      setImageOpacitySnap(opacity)
                      applyToActiveImage((object) => {
                        object.set("opacity", opacity)
                      })
                    }}
                    min={0.05}
                    max={1}
                    step={0.05}
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {showTextSection && (
              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">
                  Text
                </label>
                {isTextTarget ? (
                  <textarea
                    id="editor-properties-text-body"
                    value={textDraft}
                    rows={3}
                    className="mb-4 min-h-[72px] w-full resize-y rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus-visible:ring-2 focus-visible:ring-primary/35"
                    placeholder="Type here…"
                    onChange={(e) => {
                      const v = e.target.value
                      setTextDraft(v)
                      applyToActiveText((object) => {
                        object.set("text", v)
                      })
                    }}
                    onBlur={() => saveToHistory()}
                  />
                ) : (
                  <p className="mb-4 rounded-lg border border-dashed border-white/10 bg-zinc-800/50 px-3 py-2 text-xs leading-relaxed text-zinc-500">
                    Select a text box or place text on the canvas, then edit here.
                  </p>
                )}

                <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">
                  Text color
                </label>
                <div className="mb-4 grid grid-cols-5 gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={`text-fill-${color}`}
                      type="button"
                      className={cn(
                        "h-8 w-8 rounded-lg border-2 transition-transform hover:scale-110",
                        normColor(displayTextFill) === normColor(color)
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-white/10"
                      )}
                      style={{ backgroundColor: color }}
                      title={color}
                      aria-label={`Text color ${color}`}
                      aria-pressed={normColor(displayTextFill) === normColor(color)}
                      onClick={() => handleColorChange(color)}
                    />
                  ))}
                </div>

                <div className="mb-4">
                  <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">
                    Custom text color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={fillToHex6ForColorInput(customColor)}
                      onChange={handleCustomColorInput}
                      className="h-10 w-10 cursor-pointer rounded-lg border-0 bg-transparent"
                    />
                    <input
                      type="text"
                      value={customColor}
                      onChange={handleCustomColorInput}
                      className="h-9 flex-1 rounded-lg border border-white/10 bg-zinc-800 px-3 text-sm uppercase text-zinc-300"
                      placeholder="#ffffff"
                      aria-label="Text color hex value"
                    />
                  </div>
                </div>

                <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">
                  Alignment
                </label>
                <div className="mb-4 flex gap-1 rounded-lg border border-white/5 bg-zinc-800/80 p-1">
                  {(["left", "center", "right"] as const).map((align) => {
                    const active = displayTextAlign === align
                    return (
                      <button
                        key={align}
                        type="button"
                        aria-label={`Align ${align}`}
                        aria-pressed={active}
                        className={cn(
                          "flex flex-1 items-center justify-center rounded-md py-2 text-xs transition-colors",
                          active
                            ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                            : "text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                        )}
                        onClick={() => {
                          dispatch({ type: "SET_TEXT_ALIGN", textAlign: align })
                          if (isTextTarget) {
                            setTextControlSnap((prev) => {
                              const base =
                                prev ?? {
                                  fontSize: textSettings.fontSize,
                                  textStrokeWidth: textSettings.textStrokeWidth,
                                  textAlign: textSettings.textAlign,
                                  fill: TEXT_DEFAULTS.fill,
                                }
                              return { ...base, textAlign: align }
                            })
                          }
                          applyToActiveText((object) => {
                            object.set("textAlign", align)
                          })
                        }}
                      >
                        <TextAlignPreview kind={align} />
                      </button>
                    )
                  })}
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-zinc-500 uppercase tracking-wider">
                      Text size
                    </label>
                    <span className="text-xs text-zinc-400 tabular-nums">
                      {displayTextSize}px
                    </span>
                  </div>
                  <div className="py-2">
                    <Slider
                      value={[displayTextSize]}
                      onValueChange={(value) => {
                        const size = value[0]
                        dispatch({ type: "SET_TEXT_SIZE", size })
                        if (isTextTarget) {
                          setTextControlSnap((prev) => {
                            const base =
                              prev ?? {
                                fontSize: textSettings.fontSize,
                                textStrokeWidth: textSettings.textStrokeWidth,
                                textAlign: textSettings.textAlign,
                                fill: TEXT_DEFAULTS.fill,
                              }
                            return { ...base, fontSize: size }
                          })
                        }
                        applyToActiveText((object) => {
                          object.set("fontSize", size)
                          applyTextStrokeAppearance(
                            object as Textbox,
                            getLogicalTextStrokeWidth(object as EditorTextboxWithHalo),
                            getEffectiveTextStrokeColor(
                              object as EditorTextboxWithHalo,
                              textSettings.textStrokeColor
                            )
                          )
                        })
                      }}
                      min={10}
                      max={96}
                      step={1}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-zinc-500 uppercase tracking-wider">
                      Text stroke
                    </label>
                    <span className="text-xs text-zinc-400 tabular-nums">
                      {displayTextStroke}px
                    </span>
                  </div>
                  <div className="py-2">
                    <Slider
                      value={[displayTextStroke]}
                      onValueChange={(value) => {
                        const width = value[0]
                        dispatch({ type: "SET_TEXT_STROKE_WIDTH", width })
                        if (isTextTarget) {
                          setTextControlSnap((prev) => {
                            const base =
                              prev ?? {
                                fontSize: textSettings.fontSize,
                                textStrokeWidth: textSettings.textStrokeWidth,
                                textAlign: textSettings.textAlign,
                                fill: TEXT_DEFAULTS.fill,
                              }
                            return { ...base, textStrokeWidth: width }
                          })
                        }
                        applyToActiveText((object) => {
                          applyTextStrokeAppearance(
                            object as Textbox,
                            width,
                            textSettings.textStrokeColor
                          )
                        })
                      }}
                      min={0}
                      max={20}
                      step={1}
                      className="w-full"
                    />
                  </div>
                </div>

                <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">
                  Font
                </label>
                <BrandFontPicker
                  className="h-11 border-zinc-700 bg-zinc-950/50 font-normal text-zinc-100 hover:bg-zinc-900"
                  value={
                    getPrimaryFontFaceName(pickerResolvedFontFamily).trim() || undefined
                  }
                  systemFontOptions={IMAGE_EDITOR_SYSTEM_FONT_OPTIONS}
                  onChange={(family, googleFont, systemFontCss) => {
                    if (googleFont) {
                      const css = googleFontToFabricCss(googleFont)
                      void loadFont(googleFont.family)
                        .catch(() => undefined)
                        .then(() => void applyFontFamily(css))
                    } else if (systemFontCss) {
                      void applyFontFamily(systemFontCss)
                    } else {
                      void applyFontFamily(`"${family}", sans-serif`)
                    }
                  }}
                />
              </div>
            )}
            {!hasPropertiesBody && (
              <p className="text-xs leading-relaxed text-zinc-500">
                Select something on the canvas or switch tools to see relevant
                options.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="relative h-8 shrink-0">
        <button
          type="button"
          className="flex h-8 min-w-0 max-w-[7.5rem] items-center justify-between gap-1.5 rounded-lg border border-white/10 bg-zinc-900/90 px-2 text-zinc-100 backdrop-blur-md sm:max-w-[8.5rem]"
          onClick={() => setIsCanvasRatioOpen((prev) => !prev)}
          aria-expanded={isCanvasRatioOpen}
        >
          <span className="flex min-w-0 items-center gap-1">
            <CornersOut
              size={14}
              className="shrink-0 text-zinc-400"
              aria-hidden
            />
            <span className="truncate text-[11px] font-medium text-zinc-100">
              {activeAspectRatioLabel}
            </span>
          </span>
          {isCanvasRatioOpen ? <CaretUp size={12} /> : <CaretDown size={12} />}
        </button>

        {isCanvasRatioOpen && (
          <div className="absolute left-0 top-[calc(100%+6px)] z-40 flex min-w-full flex-col gap-1 rounded-lg border border-white/10 bg-zinc-900/95 p-1.5 shadow-xl backdrop-blur-md">
            {aspectRatioOptions.map((option) => {
              const isActive = option.ratio === canvasAspectRatio
              return (
                <button
                  key={option.label}
                  className={cn(
                    "h-7 whitespace-nowrap px-2 rounded-md text-xs text-left transition-colors",
                    isActive
                      ? "bg-primary/20 text-primary border border-primary/40"
                      : "bg-zinc-800 text-zinc-300 border border-white/5 hover:bg-zinc-700"
                  )}
                  onClick={() => setCanvasAspectRatio(option.ratio)}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
