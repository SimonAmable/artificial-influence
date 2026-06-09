"use client"

import * as React from "react"
import { HexColorPicker } from "react-colorful"
import { AlignCenter, AlignLeft, AlignRight, Ghost } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { useVideoEditor } from "@/components/video-editor/video-editor-provider"
import { COMPOSITION_ASPECT_PRESETS } from "@/lib/video-editor/composition-presets"
import { FEATURE_FLAGS } from "@/lib/video-editor/feature-flags"
import { findItemInProject } from "@/lib/video-editor/project-helpers"
import {
  getTextBackgroundMode,
  textBackgroundStyle,
  textDecorationStyle,
} from "@/lib/video-editor/text-rendering"
import {
  estimateSnapchatWrappedLineCount,
  snapchatBarHeightForLineCount,
  snapchatFontSizeForWidth,
} from "@/lib/video-editor/snapchat-overlay-style"
import {
  TEXT_STYLE_PRESETS,
  TIKTOK_TEXT_COLORS,
  findTextStylePreset,
} from "@/lib/video-editor/text-style-presets"
import type { EditorItem, EditorProject } from "@/lib/video-editor/types"
import { cn } from "@/lib/utils"

export function InspectorPanel({ className }: { className?: string }) {
  const { project, dispatch } = useVideoEditor()
  const selectedId = project.selectedItemIds[0]
  const selected = selectedId ? findItemInProject(project, selectedId)?.item : null

  if (!selected) {
    const dimKey = `${project.settings.width}x${project.settings.height}`
    const presetMatch = COMPOSITION_ASPECT_PRESETS.find(
      (preset) =>
        preset.width === project.settings.width && preset.height === project.settings.height
    )

    return (
      <div className={cn("space-y-4 overflow-y-auto p-3", className)}>
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">Composition</h3>
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Frame preset</Label>
            <Select
              value={presetMatch ? `${presetMatch.width}x${presetMatch.height}` : "__custom__"}
              onValueChange={(value) => {
                if (value === "__custom__") return
                const [width, height] = value.split("x").map(Number)
                if (!width || !height) return
                dispatch({
                  type: "SET_SETTINGS",
                  settings: { width, height },
                })
              }}
            >
              <SelectTrigger className="mt-1 h-8 text-xs">
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                {!presetMatch && (
                  <SelectItem value="__custom__" className="text-xs text-muted-foreground">
                    Custom ({dimKey})
                  </SelectItem>
                )}
                {COMPOSITION_ASPECT_PRESETS.map((preset) => (
                  <SelectItem
                    key={preset.id}
                    value={`${preset.width}x${preset.height}`}
                    className="text-xs"
                  >
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Default 9:16 vertical. New clips use contain and the timeline auto-fits your media.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Width</Label>
              <Input
                type="number"
                value={project.settings.width}
                onChange={(e) =>
                  dispatch({
                    type: "SET_SETTINGS",
                    settings: { width: Number(e.target.value) || 1 },
                  })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Height</Label>
              <Input
                type="number"
                value={project.settings.height}
                onChange={(e) =>
                  dispatch({
                    type: "SET_SETTINGS",
                    settings: { height: Number(e.target.value) || 1 },
                  })
                }
              />
            </div>
          </div>
          {FEATURE_FLAGS.FEATURE_SWAP_COMPOSITION_DIMENSIONS_BUTTON && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() =>
                dispatch({
                  type: "SET_SETTINGS",
                  settings: {
                    width: project.settings.height,
                    height: project.settings.width,
                  },
                })
              }
            >
              Swap dimensions
            </Button>
          )}
          <div>
            <Label className="text-xs">FPS</Label>
            <Input
              type="number"
              value={project.settings.fps}
              onChange={(e) =>
                dispatch({
                  type: "SET_SETTINGS",
                  settings: { fps: Number(e.target.value) || 1 },
                })
              }
            />
          </div>
          <div>
            <Label className="text-xs">Duration (frames)</Label>
            <Input type="number" value={project.settings.durationInFrames} readOnly />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Duration is derived from the furthest clip end.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4 overflow-y-auto p-3", className)}>
      <h3 className="text-xs font-semibold uppercase text-muted-foreground">Item</h3>
      <LayoutSection item={selected} dispatch={dispatch} />
      {selected.type === "text" && (
        <TextSection item={selected} project={project} dispatch={dispatch} />
      )}
      {(selected.type === "video" || selected.type === "audio") && (
        <MediaSection item={selected} dispatch={dispatch} />
      )}
      {selected.type === "solid" && (
        <div>
          <Label className="text-xs">Fill</Label>
          <HexColorPicker
            color={selected.fill}
            onChange={(fill) =>
              dispatch({ type: "UPDATE_ITEM", itemId: selected.id, patch: { fill } })
            }
            className="mt-1 w-full"
          />
        </div>
      )}
    </div>
  )
}

function LayoutSection({
  item,
  dispatch,
}: {
  item: EditorItem
  dispatch: ReturnType<typeof useVideoEditor>["dispatch"]
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">X</Label>
          <Input
            type="number"
            value={Math.round(item.x)}
            onChange={(e) =>
              dispatch({ type: "UPDATE_ITEM", itemId: item.id, patch: { x: Number(e.target.value) } })
            }
          />
        </div>
        <div>
          <Label className="text-xs">Y</Label>
          <Input
            type="number"
            value={Math.round(item.y)}
            onChange={(e) =>
              dispatch({ type: "UPDATE_ITEM", itemId: item.id, patch: { y: Number(e.target.value) } })
            }
          />
        </div>
        <div>
          <Label className="text-xs">W</Label>
          <Input
            type="number"
            value={Math.round(item.width)}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_ITEM",
                itemId: item.id,
                patch: { width: Number(e.target.value) },
              })
            }
          />
        </div>
        <div>
          <Label className="text-xs">H</Label>
          <Input
            type="number"
            value={Math.round(item.height)}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_ITEM",
                itemId: item.id,
                patch: { height: Number(e.target.value) },
              })
            }
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Opacity</Label>
        <Slider
          value={[item.opacity]}
          min={0}
          max={1}
          step={0.01}
          onValueChange={([value]) =>
            dispatch({ type: "UPDATE_ITEM", itemId: item.id, patch: { opacity: value } })
          }
        />
      </div>
      <div>
        <Label className="text-xs">Rotation</Label>
        <Input
          type="number"
          value={item.rotation}
          onChange={(e) =>
            dispatch({
              type: "UPDATE_ITEM",
              itemId: item.id,
              patch: { rotation: Number(e.target.value) },
            })
          }
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="keep-aspect"
          checked={item.keepAspectRatio}
          onChange={(e) =>
            dispatch({
              type: "UPDATE_ITEM",
              itemId: item.id,
              patch: { keepAspectRatio: e.target.checked },
            })
          }
          className="rounded border border-input"
        />
        <Label htmlFor="keep-aspect" className="text-xs font-normal">
          Lock aspect ratio (canvas resize; Shift overrides)
        </Label>
      </div>
    </div>
  )
}

function findMainVisualItem(project: EditorProject, textItem: Extract<EditorItem, { type: "text" }>) {
  const visuals = project.tracks
    .filter((track) => !track.hidden)
    .flatMap((track) => track.items)
    .filter((candidate) => {
      if (
        candidate.type !== "image" &&
        candidate.type !== "video" &&
        candidate.type !== "gif"
      ) {
        return false
      }
      const textEnd = textItem.from + textItem.durationInFrames
      const candidateEnd = candidate.from + candidate.durationInFrames
      return textItem.from < candidateEnd && candidate.from < textEnd
    })

  return visuals.sort((a, b) => b.width * b.height - a.width * a.height)[0] ?? null
}

function TextSection({
  item,
  project,
  dispatch,
}: {
  item: Extract<EditorItem, { type: "text" }>
  project: EditorProject
  dispatch: ReturnType<typeof useVideoEditor>["dispatch"]
}) {
  const [colorTarget, setColorTarget] = React.useState<"text" | "stroke">("text")
  const measureRef = React.useRef<HTMLDivElement>(null)
  const activePreset = findTextStylePreset(item.stylePresetId)
  const backgroundMode = getTextBackgroundMode(item)
  const backgroundStyle = textBackgroundStyle(item)
  const decorationStyle = textDecorationStyle(item)

  React.useLayoutEffect(() => {
    if (!item.text.trim()) {
      return
    }

    const el = measureRef.current
    if (!el) {
      return
    }

    const measuredHeight = Math.ceil(el.scrollHeight)
    const strokeBuffer = item.textStrokeWidth > 0 ? Math.ceil(item.textStrokeWidth * 0.75) : 0
    const nextHeight = Math.max(item.height, measuredHeight + Math.max(8, strokeBuffer))

    if (nextHeight <= item.height + 1) {
      return
    }

    const maxY = Math.max(0, project.settings.height - nextHeight)
    const centeredY = item.y - (nextHeight - item.height) / 2

    dispatch({
      type: "UPDATE_ITEM",
      itemId: item.id,
      patch: {
        height: nextHeight,
        y: Math.min(Math.max(0, centeredY), maxY),
      },
    })
  }, [dispatch, item, project.settings.height])

  const placeVertically = (anchor: "top" | "center" | "bottom") => {
    const visualFrame = findMainVisualItem(project, item)
    const frame = visualFrame ?? {
      x: 0,
      y: 0,
      width: project.settings.width,
      height: project.settings.height,
    }
    const fraction = anchor === "top" ? 0.25 : anchor === "bottom" ? 0.75 : 0.5
    const y = frame.y + frame.height * fraction - item.height / 2
    const maxY = Math.max(0, project.settings.height - item.height)

    dispatch({
      type: "UPDATE_ITEM",
      itemId: item.id,
      patch: { y: Math.min(Math.max(0, y), maxY) },
    })
  }

  const applyPreset = (preset: (typeof TEXT_STYLE_PRESETS)[number]) => {
    const fontSize =
      preset.id === "snapchat-classic"
        ? snapchatFontSizeForWidth(project.settings.width)
        : Number(preset.patch.fontSize ?? item.fontSize)
    const lineHeight = Number(preset.patch.lineHeight ?? item.lineHeight)
    const padX = Number(preset.patch.backgroundPaddingX ?? item.backgroundPaddingX ?? 0)
    const padY = Number(preset.patch.backgroundPaddingY ?? item.backgroundPaddingY ?? 0)
    const minHeight = Math.ceil(fontSize * lineHeight * 2.35 + padY * 2)
    const snap = preset.id === "snapchat-classic"
    const visualFrame = snap ? findMainVisualItem(project, item) : null
    const nextWidth = snap
      ? visualFrame?.width ?? project.settings.width
      : Math.max(item.width, Math.min(project.settings.width * 0.84, 860))
    const snapLineCount = snap
      ? estimateSnapchatWrappedLineCount(
          item.text,
          fontSize,
          Math.max(1, nextWidth - padX * 2)
        )
      : 1
    const nextHeight = snap
      ? snapchatBarHeightForLineCount(fontSize, lineHeight, padY, snapLineCount)
      : Math.max(item.height, minHeight)
    const nextY = snap ? item.y + (item.height - nextHeight) / 2 : item.y

    dispatch({
      type: "UPDATE_ITEM",
      itemId: item.id,
      patch: {
        ...preset.patch,
        x: snap
          ? (visualFrame?.x ?? 0)
          : Math.min(item.x, Math.max(0, project.settings.width - nextWidth)),
        y: snap ? Math.max(0, nextY) : item.y,
        width: nextWidth,
        height: nextHeight,
        keepAspectRatio: false,
      },
    })
  }

  return (
    <div className="space-y-4">
      <div
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none absolute -left-[99999px] top-0"
        style={{
          width: item.width,
          visibility: "hidden",
          whiteSpace: "pre-wrap",
          overflow: "visible",
          ...decorationStyle,
          ...(backgroundMode === "box" && backgroundStyle ? backgroundStyle : null),
        }}
      >
        {backgroundMode === "line" && backgroundStyle ? (
          <span
            style={{
              ...backgroundStyle,
              boxDecorationBreak: "clone",
              WebkitBoxDecorationBreak: "clone",
            }}
          >
            {item.text}
          </span>
        ) : (
          item.text
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Preset</Label>
          {activePreset ? (
            <span className="truncate text-[10px] text-muted-foreground">{activePreset.label}</span>
          ) : null}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {TEXT_STYLE_PRESETS.map((preset) => {
            const selected = item.stylePresetId === preset.id
            const isSnapchat = preset.id === "snapchat-classic"
            return (
              <Button
                key={preset.id}
                type="button"
                variant={selected ? "default" : "outline"}
                className={cn(
                  "h-12 min-w-0 rounded-md px-1.5 py-1 text-[10px]",
                  selected ? "" : "bg-background",
                  isSnapchat && !selected ? "border-[#fffc00]/70 bg-[#fffc00] text-black hover:bg-[#fffc00]/90" : ""
                )}
                title={preset.description}
                onClick={() => applyPreset(preset)}
              >
                <span className="flex min-w-0 flex-col items-center gap-1">
                  {isSnapchat ? (
                    <Ghost className="h-4 w-4" />
                  ) : (
                    <span
                      className="text-[13px] font-black leading-none"
                      style={{
                        fontFamily: preset.patch.fontFamily,
                        WebkitTextStroke:
                          (preset.patch.textStrokeWidth ?? 0) > 0
                            ? `1px ${preset.patch.textStrokeColor ?? "#000000"}`
                            : undefined,
                      }}
                    >
                      T
                    </span>
                  )}
                  <span className="w-full truncate text-center leading-none">{preset.label.replace("TikTok ", "").replace("Snapchat ", "")}</span>
                </span>
              </Button>
            )
          })}
        </div>
      </div>
      <div>
        <Label className="text-xs">Text</Label>
        <textarea
          className="min-h-[80px] w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          value={item.text}
          onChange={(e) =>
            dispatch({ type: "UPDATE_ITEM", itemId: item.id, patch: { text: e.target.value } })
          }
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Color</Label>
          <div className="grid grid-cols-2 overflow-hidden rounded-md border border-input">
            {[
              { value: "text" as const, label: "Text" },
              { value: "stroke" as const, label: "Stroke" },
            ].map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={cn(
                  "h-7 px-2 text-[10px] text-muted-foreground transition-colors",
                  colorTarget === value ? "bg-muted text-foreground" : "hover:bg-muted/60"
                )}
                onClick={() => setColorTarget(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {TIKTOK_TEXT_COLORS.map((color) => {
            const selectedColor = colorTarget === "text" ? item.color : item.textStrokeColor
            const selected = selectedColor.toLowerCase() === color
            return (
            <button
              key={color}
              type="button"
              aria-label={`Set ${colorTarget} color ${color}`}
              className={cn(
                "h-7 w-7 rounded-full border-[3px] border-black/40 shadow-sm ring-offset-background",
                selected ? "ring-2 ring-primary ring-offset-2" : ""
              )}
              style={{ backgroundColor: color }}
              onClick={() =>
                dispatch({
                  type: "UPDATE_ITEM",
                  itemId: item.id,
                  patch:
                    colorTarget === "text"
                      ? { color, stylePresetId: null }
                      : {
                          textStrokeColor: color,
                          textStrokeWidth: item.textStrokeWidth > 0 ? item.textStrokeWidth : 6,
                          stylePresetId: null,
                        },
                })
              }
            />
            )
          })}
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Alignment</Label>
          <div className="grid grid-cols-3 overflow-hidden rounded-md border border-input">
            {[
              { value: "left" as const, icon: AlignLeft, label: "Align left" },
              { value: "center" as const, icon: AlignCenter, label: "Align center" },
              { value: "right" as const, icon: AlignRight, label: "Align right" },
            ].map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                type="button"
                aria-label={label}
                className={cn(
                  "flex h-8 w-10 items-center justify-center text-muted-foreground transition-colors",
                  item.textAlign === value ? "bg-muted text-foreground" : "hover:bg-muted/60"
                )}
                onClick={() =>
                  dispatch({
                    type: "UPDATE_ITEM",
                    itemId: item.id,
                    patch: { textAlign: value, stylePresetId: null },
                  })
                }
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Placement</Label>
          <div className="grid grid-cols-3 overflow-hidden rounded-md border border-input">
            {[
              { value: "top" as const, label: "Top" },
              { value: "center" as const, label: "Center" },
              { value: "bottom" as const, label: "Bottom" },
            ].map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className="h-8 px-2 text-[10px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                onClick={() => placeVertically(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Size</Label>
          <Input
            type="number"
            value={item.fontSize}
            className="h-8 w-20"
            onChange={(e) =>
              dispatch({
                type: "UPDATE_ITEM",
                itemId: item.id,
                patch: { fontSize: Number(e.target.value), stylePresetId: null },
              })
            }
          />
        </div>
        <Slider
          value={[item.fontSize]}
          min={18}
          max={140}
          step={1}
          onValueChange={([fontSize]) =>
            dispatch({
              type: "UPDATE_ITEM",
              itemId: item.id,
              patch: { fontSize, stylePresetId: null },
            })
          }
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Stroke</Label>
          <Input
            type="number"
            value={item.textStrokeWidth}
            className="h-8 w-20"
            onChange={(e) =>
              dispatch({
                type: "UPDATE_ITEM",
                itemId: item.id,
                patch: { textStrokeWidth: Number(e.target.value), stylePresetId: null },
              })
            }
          />
        </div>
        <Slider
          value={[item.textStrokeWidth]}
          min={0}
          max={14}
          step={1}
          onValueChange={([textStrokeWidth]) =>
            dispatch({
              type: "UPDATE_ITEM",
              itemId: item.id,
              patch: { textStrokeWidth, stylePresetId: null },
            })
          }
        />
      </div>
    </div>
  )
}

function MediaSection({
  item,
  dispatch,
}: {
  item: Extract<EditorItem, { type: "video" }> | Extract<EditorItem, { type: "audio" }>
  dispatch: ReturnType<typeof useVideoEditor>["dispatch"]
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs">Volume</Label>
        <Slider
          value={[item.volume]}
          min={0}
          max={1}
          step={0.01}
          onValueChange={([value]) =>
            dispatch({ type: "UPDATE_ITEM", itemId: item.id, patch: { volume: value } })
          }
        />
      </div>
      <div>
        <Label className="text-xs">Playback rate</Label>
        <Input
          type="number"
          step={0.05}
          min={0.25}
          max={5}
          value={item.playbackRate}
          onChange={(e) =>
            dispatch({
              type: "UPDATE_ITEM",
              itemId: item.id,
              patch: { playbackRate: Number(e.target.value) || 1 },
            })
          }
        />
      </div>
      {item.fileName && (
        <p className="truncate text-[10px] text-muted-foreground" title={item.fileName}>
          {item.fileName}
        </p>
      )}
    </div>
  )
}
