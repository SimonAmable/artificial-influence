"use client"

import * as React from "react"
import {
  CursorClick,
  Lasso,
  Rectangle,
  ArrowUpRight,
  PencilSimple,
  TextT,
  Image,
  ArrowCounterClockwise,
  ArrowClockwise,
  ArrowsOut,
  ArrowsIn,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useImageEditor } from "./image-editor-provider"
import { TOOLS } from "@/lib/image-editor/constants"
import type { EditorTool } from "@/lib/image-editor/types"

interface ImageEditorToolbarProps {
  className?: string
  onToggleFullscreen?: () => void
  isFullscreen?: boolean
}

// Map tool IDs to icons
const TOOL_ICONS: Record<EditorTool, React.ElementType> = {
  select: CursorClick,
  lasso: Lasso,
  rectangle: Rectangle,
  arrow: ArrowUpRight,
  brush: PencilSimple,
  text: TextT,
  image: Image,
}

export function ImageEditorToolbar({
  className,
  onToggleFullscreen,
  isFullscreen = false,
}: ImageEditorToolbarProps) {
  const { state, setTool, setMaskMode, undo, redo, canUndo, canRedo } = useImageEditor()
  const { activeTool, maskMode } = state

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 py-1.5",
        "bg-zinc-900/90 border border-white/10 rounded-xl backdrop-blur-md",
        className
      )}
    >
      {/* Tool buttons */}
      {TOOLS.map((tool) => {
        const Icon = TOOL_ICONS[tool.id]
        const isActive = activeTool === tool.id

        return (
          <Button
            key={tool.id}
            variant="ghost"
            size="icon"
            className={cn(
              "h-9 w-9 rounded-lg transition-colors",
              isActive
                ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
            )}
            onClick={() => setTool(isActive ? "select" : tool.id)}
            title={`${tool.label} (${tool.shortcut})`}
          >
            <Icon size={20} weight={isActive ? "fill" : "regular"} />
          </Button>
        )
      })}

      {/* Separator */}
      <div className="w-px h-6 bg-white/10 mx-1" />

      {/* Undo */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-9 w-9 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5",
          !canUndo && "opacity-40 cursor-not-allowed"
        )}
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
      >
        <ArrowCounterClockwise size={20} />
      </Button>

      {/* Redo */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-9 w-9 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5",
          !canRedo && "opacity-40 cursor-not-allowed"
        )}
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
      >
        <ArrowClockwise size={20} />
      </Button>

      {/* Separator */}
      <div className="w-px h-6 bg-white/10 mx-1" />

      {/* Fullscreen */}
      {onToggleFullscreen && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
          onClick={onToggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
        >
          {isFullscreen ? <ArrowsIn size={20} /> : <ArrowsOut size={20} />}
        </Button>
      )}

      {/* Mask mode toggle */}
      {activeTool === "lasso" && (
        <>
          <div className="w-px h-6 bg-white/10 mx-1" />
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 px-3 rounded-lg text-xs",
              maskMode === "add"
                ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
            )}
            onClick={() => setMaskMode("add")}
            title="Paint mask"
          >
            Add Mask
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 px-3 rounded-lg text-xs",
              maskMode === "erase"
                ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
            )}
            onClick={() => setMaskMode("erase")}
            title="Erase mask"
          >
            Erase
          </Button>
        </>
      )}
    </div>
  )
}
