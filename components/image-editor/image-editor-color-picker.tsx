"use client"

import * as React from "react"
import { CaretDown, CaretUp } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui/slider"
import { useImageEditor } from "./image-editor-provider"
import { PRESET_COLORS, BRUSH_SIZES } from "@/lib/image-editor/constants"
import type { FabricObject } from "fabric"

interface ImageEditorColorPickerProps {
  className?: string
}

type SelectedKind = "text" | "rectangle" | "arrow" | null

type EditorFabricObject = FabricObject & {
  type?: string
  name?: string
  fill?: string
  stroke?: string
  strokeWidth?: number
  fontSize?: number
  fontFamily?: string
  getObjects?: () => FabricObject[]
  set: (key: string | Record<string, unknown>, value?: unknown) => void
  setCoords?: () => void
}

function getSelectedKind(object: EditorFabricObject | null): SelectedKind {
  if (!object) return null
  if (object.type === "textbox" || object.type === "i-text") return "text"
  if (object.type === "rect") return "rectangle"
  if (object.name === "Arrow") return "arrow"
  return null
}

export function ImageEditorColorPicker({ className }: ImageEditorColorPickerProps) {
  const { state, setBrushColor, setBrushSize, setCanvasAspectRatio, dispatch } =
    useImageEditor()
  const { activeTool, brushSettings, textSettings, shapeSettings, canvasAspectRatio, canvas } =
    state
  const [customColor, setCustomColor] = React.useState(brushSettings.color)
  const [isPropertiesOpen, setIsPropertiesOpen] = React.useState(false)
  const [isCanvasRatioOpen, setIsCanvasRatioOpen] = React.useState(false)
  const [selectedKind, setSelectedKind] = React.useState<SelectedKind>(null)
  const previousToolRef = React.useRef(activeTool)

  React.useEffect(() => {
    setCustomColor(brushSettings.color)
  }, [brushSettings.color])

  React.useEffect(() => {
    if (previousToolRef.current !== activeTool) {
      setIsPropertiesOpen(true)
      previousToolRef.current = activeTool
    }
  }, [activeTool])

  React.useEffect(() => {
    if (!canvas) {
      setSelectedKind(null)
      return
    }

    const syncSelection = () => {
      const activeObject = canvas.getActiveObject() as EditorFabricObject | null
      setSelectedKind(getSelectedKind(activeObject))
    }

    canvas.on("selection:created", syncSelection)
    canvas.on("selection:updated", syncSelection)
    canvas.on("selection:cleared", syncSelection)
    canvas.on("object:modified", syncSelection)
    syncSelection()

    return () => {
      canvas.off("selection:created", syncSelection)
      canvas.off("selection:updated", syncSelection)
      canvas.off("selection:cleared", syncSelection)
      canvas.off("object:modified", syncSelection)
    }
  }, [canvas])

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

  const handleColorChange = (color: string) => {
    setBrushColor(color)
    setCustomColor(color)

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

  const fontOptions = [
    "Inter, sans-serif",
    "Georgia, serif",
    "\"Courier New\", monospace",
  ]

  const showTextControls = activeTool === "text" || selectedKind === "text"
  const showRectangleFill = activeTool === "rectangle" || selectedKind === "rectangle"
  const showShapeControls =
    activeTool === "rectangle" ||
    activeTool === "arrow" ||
    selectedKind === "rectangle" ||
    selectedKind === "arrow"

  return (
    <div className={cn("flex flex-row items-start gap-2", className)}>
      <div className="w-72 bg-zinc-900/90 border border-white/10 rounded-lg backdrop-blur-md">
        <button
          className="w-full h-10 px-3 flex items-center justify-between text-zinc-100"
          onClick={() => setIsPropertiesOpen((prev) => !prev)}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-5 h-5 rounded-full border border-white/20"
              style={{ backgroundColor: brushSettings.color }}
            />
            <div className="text-left min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                Color & Properties
              </div>
              <div className="text-xs text-zinc-200 truncate">
                {brushSettings.color.toUpperCase()} · {brushSettings.size}px ·{" "}
                {Math.round(brushSettings.opacity * 100)}%
              </div>
            </div>
          </div>
          {isPropertiesOpen ? <CaretUp size={14} /> : <CaretDown size={14} />}
        </button>

        {isPropertiesOpen && (
          <div className="p-4 border-t border-white/10">
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
              <Slider
                value={[brushSettings.size]}
                onValueChange={(value) => setBrushSize(value[0])}
                min={1}
                max={100}
                step={1}
                className="w-full"
              />
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

            {showShapeControls && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-zinc-500 uppercase tracking-wider">
                    Stroke Width
                  </label>
                  <span className="text-xs text-zinc-400">
                    {shapeSettings.strokeWidth}px
                  </span>
                </div>
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

            {showTextControls && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-zinc-500 uppercase tracking-wider">
                    Text Size
                  </label>
                  <span className="text-xs text-zinc-400">
                    {textSettings.fontSize}px
                  </span>
                </div>
                <Slider
                  value={[textSettings.fontSize]}
                  onValueChange={(value) => {
                    const size = value[0]
                    dispatch({ type: "SET_TEXT_SIZE", size })
                    applyToActiveObject((object) => {
                      if (getSelectedKind(object) === "text") {
                        object.set("fontSize", size)
                      }
                    })
                  }}
                  min={10}
                  max={96}
                  step={1}
                  className="w-full mb-3"
                />

                <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">
                  Font
                </label>
                <div className="grid grid-cols-1 gap-1">
                  {fontOptions.map((font) => {
                    const isActive = textSettings.fontFamily === font
                    return (
                      <button
                        key={font}
                        className={cn(
                          "h-8 px-2 rounded-md text-xs text-left transition-colors",
                          isActive
                            ? "bg-primary/20 text-primary border border-primary/40"
                            : "bg-zinc-800 text-zinc-300 border border-white/5 hover:bg-zinc-700"
                        )}
                        onClick={() => {
                          dispatch({ type: "SET_TEXT_FONT", fontFamily: font })
                          applyToActiveObject((object) => {
                            if (getSelectedKind(object) === "text") {
                              object.set("fontFamily", font)
                            }
                          })
                        }}
                      >
                        {font}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="w-36 bg-zinc-900/90 border border-white/10 rounded-lg backdrop-blur-md p-2">
        <button
          className="w-full h-8 px-1 flex items-center justify-between text-zinc-100"
          onClick={() => setIsCanvasRatioOpen((prev) => !prev)}
        >
          <div className="text-left min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
              Aspect Ratio
            </div>
            <div className="text-xs font-medium text-zinc-100 truncate">
              {activeAspectRatioLabel}
            </div>
          </div>
          {isCanvasRatioOpen ? <CaretUp size={14} /> : <CaretDown size={14} />}
        </button>

        {isCanvasRatioOpen && (
          <div className="space-y-1 mt-2">
            {aspectRatioOptions.map((option) => {
              const isActive = option.ratio === canvasAspectRatio
              return (
                <button
                  key={option.label}
                  className={cn(
                    "w-full h-7 px-2 rounded-md text-xs text-left transition-colors",
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
