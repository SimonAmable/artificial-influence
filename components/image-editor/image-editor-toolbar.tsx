"use client"

import * as React from "react"
import {
  ArrowUpRight,
  ArrowsIn,
  ArrowsOut,
  ChatCircle,
  Cursor,
  Eraser,
  Image as ImageIcon,
  PaintBrush,
  Rectangle,
  TextT,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useImageEditor } from "./image-editor-provider"
import type { EditorTool } from "@/lib/image-editor/types"
import { TOOLS } from "@/lib/image-editor/constants"

interface ImageEditorToolbarProps {
  className?: string
  onToggleFullscreen?: () => void
  isFullscreen?: boolean
  extendedTools?: boolean
  /**
   * Full image-editor surface: first icon collapses the bottom generate prompt
   * bar so the canvas has more room.
   */
  showGenerateBarToggle?: boolean
  /** When true, the generate prompt bar is visible (pressed = expanded). */
  generateBarOpen?: boolean
  onToggleGenerateBar?: () => void
  /** Inpaint mask surface: paint vs erase mask icons before fullscreen. */
  showMaskModeToggle?: boolean
}

function toolMeta(id: EditorTool): { label: string; shortcut: string } | null {
  const entry = TOOLS.find((tool) => tool.id === id)
  if (!entry) return null
  return { label: entry.label, shortcut: entry.shortcut }
}

type PaletteTool = Exclude<EditorTool, "lasso">

function ToolGlyph({
  tool,
  active,
  size,
}: {
  tool: PaletteTool
  active: boolean
  size: number
}) {
  const w = active ? ("fill" as const) : ("regular" as const)
  switch (tool) {
    case "select":
      return <Cursor size={size} weight={w} />
    case "rectangle":
      return <Rectangle size={size} weight={w} />
    case "arrow":
      return <ArrowUpRight size={size} weight={w} />
    case "brush":
      return <PaintBrush size={size} weight={w} />
    case "text":
      return <TextT size={size} weight={w} />
    case "image":
      return <ImageIcon size={size} weight={w} />
    default: {
      const _never: never = tool
      return _never
    }
  }
}

export function ImageEditorToolbar({
  className,
  onToggleFullscreen,
  isFullscreen = false,
  extendedTools = false,
  showGenerateBarToggle = false,
  generateBarOpen = false,
  onToggleGenerateBar,
  showMaskModeToggle = false,
}: ImageEditorToolbarProps) {
  const { state, setTool, setMaskMode } = useImageEditor()
  const { activeTool, maskMode } = state

  const glyphSize = 20

  const toolButtonClasses = ({
    pressed,
    extra,
  }: {
    pressed: boolean
    extra?: string
  }) =>
    cn(
      "shrink-0 min-h-10 min-w-10 sm:h-9 sm:w-9 rounded-md sm:rounded-lg transition-colors touch-manipulation",
      pressed
        ? "bg-primary/20 text-primary ring-1 ring-primary/40"
        : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
      extra
    )

  const divider = (
    <div
      className="h-6 w-px shrink-0 bg-border mx-0.5 sm:mx-1"
      aria-hidden
      role="separator"
    />
  )

  const generateBarToggleButton = showGenerateBarToggle ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={toolButtonClasses({ pressed: generateBarOpen })}
      onClick={() => onToggleGenerateBar?.()}
      title={
        generateBarOpen
          ? "Hide generate prompt (more canvas)"
          : "Show generate prompt"
      }
      aria-label={
        generateBarOpen
          ? "Hide generate prompt bar"
          : "Show generate prompt bar"
      }
      aria-pressed={generateBarOpen}
    >
      <ChatCircle size={glyphSize} />
    </Button>
  ) : null

  const maskModeButtons = showMaskModeToggle ? (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={toolButtonClasses({ pressed: maskMode === "add" })}
        onClick={() => setMaskMode("add")}
        title="Paint mask (add)"
        aria-label="Paint mask"
        aria-pressed={maskMode === "add"}
      >
        <PaintBrush size={glyphSize} weight={maskMode === "add" ? "fill" : "regular"} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={toolButtonClasses({ pressed: maskMode === "erase" })}
        onClick={() => setMaskMode("erase")}
        title="Erase mask"
        aria-label="Erase mask"
        aria-pressed={maskMode === "erase"}
      >
        <Eraser size={glyphSize} weight={maskMode === "erase" ? "fill" : "regular"} />
      </Button>
    </>
  ) : null

  if (!extendedTools) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center gap-0.5 px-1.5 py-1 sm:gap-1 sm:px-2 sm:py-1.5",
          "rounded-lg border border-border bg-card/90 backdrop-blur-md shadow-sm sm:rounded-xl",
          className
        )}
      >
        {generateBarToggleButton}

        {showGenerateBarToggle && showMaskModeToggle ? divider : null}

        {maskModeButtons}

        {(showGenerateBarToggle || showMaskModeToggle) && onToggleFullscreen
          ? divider
          : null}

        {onToggleFullscreen && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={toolButtonClasses({ pressed: false })}
            onClick={onToggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
            aria-label={
              isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
            }
          >
            {isFullscreen ? (
              <ArrowsIn size={glyphSize} />
            ) : (
              <ArrowsOut size={glyphSize} />
            )}
          </Button>
        )}
      </div>
    )
  }

  type PaletteTool =
    | "select"
    | "brush"
    | "rectangle"
    | "arrow"
    | "text"
    | "image"

  const paletteButton = (paletteId: PaletteTool) => {
    const pressed = activeTool === paletteId
    const meta = toolMeta(paletteId)!
    const label =
      paletteId === "image"
        ? `Add image… (${meta.shortcut})`
        : `${meta.label} (${meta.shortcut})`

    return (
      <Button
        type="button"
        key={paletteId}
        variant="ghost"
        size="icon"
        className={toolButtonClasses({ pressed })}
        onClick={() => setTool(paletteId)}
        title={label}
        aria-label={
          paletteId === "image"
            ? "Add reference image from file"
            : label
        }
        aria-pressed={paletteId === "image" ? undefined : pressed}
      >
        <ToolGlyph
          tool={paletteId}
          active={pressed && paletteId !== "image"}
          size={glyphSize}
        />
      </Button>
    )
  }

  return (
    <div
      className={cn(
        "flex max-w-[min(100%,42rem)] min-w-0 shrink-0 items-stretch rounded-lg border border-border bg-card/90 shadow-sm backdrop-blur-md sm:rounded-xl",
        className
      )}
    >
      <div
        className={cn(
          "mobile-nav-scrollless flex flex-nowrap items-center gap-0.5 overflow-x-auto overflow-y-hidden px-1 py-1 sm:gap-1 sm:px-1.5 sm:py-1.5 touch-pan-x [-webkit-overflow-scrolling:touch]"
        )}
      >
        {paletteButton("select")}
        {divider}
        {paletteButton("brush")}
        {divider}
        {paletteButton("rectangle")}
        {paletteButton("arrow")}
        {divider}
        {paletteButton("text")}
        {paletteButton("image")}

        {showMaskModeToggle ? (
          <>
            {divider}
            {maskModeButtons}
          </>
        ) : null}

        {showGenerateBarToggle || onToggleFullscreen ? (
          <>
            {divider}
            {generateBarToggleButton}
            {onToggleFullscreen ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(toolButtonClasses({ pressed: false }), "snap-start")}
                onClick={onToggleFullscreen}
                title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
                aria-label={
                  isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                }
              >
                {isFullscreen ? (
                  <ArrowsIn size={glyphSize} />
                ) : (
                  <ArrowsOut size={glyphSize} />
                )}
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
