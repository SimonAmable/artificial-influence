"use client"

import * as React from "react"
import { HexColorPicker } from "react-colorful"
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
import type { EditorItem } from "@/lib/video-editor/types"
import { cn } from "@/lib/utils"

export function InspectorPanel({ className }: { className?: string }) {
  const { project, dispatch } = useVideoEditor()
  const selectedId = project.selectedItemIds[0]
  const selected = selectedId ? findItemInProject(project, selectedId)?.item : null

  if (!selected) {
    const dimKey = `${project.settings.width}×${project.settings.height}`
    const presetMatch = COMPOSITION_ASPECT_PRESETS.find(
      (p) => p.width === project.settings.width && p.height === project.settings.height
    )

    return (
      <div className={cn("space-y-4 overflow-y-auto p-3", className)}>
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">Composition</h3>
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Frame preset</Label>
            <Select
              value={presetMatch ? `${presetMatch.width}x${presetMatch.height}` : "__custom__"}
              onValueChange={(v) => {
                if (v === "__custom__") return
                const [w, h] = v.split("x").map(Number)
                if (!w || !h) return
                dispatch({
                  type: "SET_SETTINGS",
                  settings: { width: w, height: h },
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
                {COMPOSITION_ASPECT_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={`${p.width}x${p.height}`} className="text-xs">
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Default 16:9 1080p. New clips use “contain” to fit inside the frame.
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
            <Input
              type="number"
              value={project.settings.durationInFrames}
              onChange={(e) =>
                dispatch({
                  type: "SET_SETTINGS",
                  settings: { durationInFrames: Number(e.target.value) || 1 },
                })
              }
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4 overflow-y-auto p-3", className)}>
      <h3 className="text-xs font-semibold uppercase text-muted-foreground">Item</h3>
      <LayoutSection item={selected} dispatch={dispatch} />
      {selected.type === "text" && <TextSection item={selected} dispatch={dispatch} />}
      {(selected.type === "video" || selected.type === "audio") && (
        <MediaSection item={selected} dispatch={dispatch} />
      )}
      {selected.type === "solid" && (
        <div>
          <Label className="text-xs">Fill</Label>
          <HexColorPicker
            color={selected.fill}
            onChange={(fill) => dispatch({ type: "UPDATE_ITEM", itemId: selected.id, patch: { fill } })}
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
              dispatch({ type: "UPDATE_ITEM", itemId: item.id, patch: { width: Number(e.target.value) } })
            }
          />
        </div>
        <div>
          <Label className="text-xs">H</Label>
          <Input
            type="number"
            value={Math.round(item.height)}
            onChange={(e) =>
              dispatch({ type: "UPDATE_ITEM", itemId: item.id, patch: { height: Number(e.target.value) } })
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
          onValueChange={([v]) => dispatch({ type: "UPDATE_ITEM", itemId: item.id, patch: { opacity: v } })}
        />
      </div>
      <div>
        <Label className="text-xs">Rotation</Label>
        <Input
          type="number"
          value={item.rotation}
          onChange={(e) =>
            dispatch({ type: "UPDATE_ITEM", itemId: item.id, patch: { rotation: Number(e.target.value) } })
          }
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="keep-aspect"
          checked={item.keepAspectRatio}
          onChange={(e) =>
            dispatch({ type: "UPDATE_ITEM", itemId: item.id, patch: { keepAspectRatio: e.target.checked } })
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

function TextSection({
  item,
  dispatch,
}: {
  item: Extract<EditorItem, { type: "text" }>
  dispatch: ReturnType<typeof useVideoEditor>["dispatch"]
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs">Text</Label>
        <textarea
          className="w-full min-h-[80px] rounded-md border border-input bg-background px-2 py-1 text-sm"
          value={item.text}
          onChange={(e) =>
            dispatch({ type: "UPDATE_ITEM", itemId: item.id, patch: { text: e.target.value } })
          }
        />
      </div>
      <div>
        <Label className="text-xs">Font family</Label>
        <Input
          value={item.fontFamily}
          onChange={(e) =>
            dispatch({ type: "UPDATE_ITEM", itemId: item.id, patch: { fontFamily: e.target.value } })
          }
        />
      </div>
      <div>
        <Label className="text-xs">Font size</Label>
        <Input
          type="number"
          value={item.fontSize}
          onChange={(e) =>
            dispatch({ type: "UPDATE_ITEM", itemId: item.id, patch: { fontSize: Number(e.target.value) } })
          }
        />
      </div>
      <div>
        <Label className="text-xs">Color</Label>
        <HexColorPicker
          color={item.color}
          onChange={(color) => dispatch({ type: "UPDATE_ITEM", itemId: item.id, patch: { color } })}
          className="mt-1 w-full"
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
          onValueChange={([v]) => dispatch({ type: "UPDATE_ITEM", itemId: item.id, patch: { volume: v } })}
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
        <p className="text-[10px] text-muted-foreground truncate" title={item.fileName}>
          {item.fileName}
        </p>
      )}
    </div>
  )
}
