"use client"

import * as React from "react"
import { Lasso, Eraser, ArrowsOut, ArrowsIn } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useImageEditor } from "./image-editor-provider"

interface ImageEditorToolbarProps {
  className?: string
  onToggleFullscreen?: () => void
  isFullscreen?: boolean
}

export function ImageEditorToolbar({
  className,
  onToggleFullscreen,
  isFullscreen = false,
}: ImageEditorToolbarProps) {
  const { state, setTool, setMaskMode } = useImageEditor()
  const { activeTool, maskMode } = state

  const maskActive = activeTool === "lasso" && maskMode === "add"
  const eraseActive = activeTool === "lasso" && maskMode === "erase"

  const activateMask = () => {
    setTool("lasso")
    setMaskMode("add")
  }

  const activateErase = () => {
    setTool("lasso")
    setMaskMode("erase")
  }

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 sm:gap-1 px-1.5 py-1 sm:px-2 sm:py-1.5",
        "bg-card/90 border border-border rounded-lg sm:rounded-xl backdrop-blur-md shadow-sm",
        className
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7 sm:h-9 sm:w-9 rounded-md sm:rounded-lg transition-colors",
          maskActive
            ? "bg-primary/20 text-primary ring-1 ring-primary/40"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
        )}
        onClick={activateMask}
        title="Mask (L)"
      >
        <Lasso size={18} weight={maskActive ? "fill" : "regular"} />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7 sm:h-9 sm:w-9 rounded-md sm:rounded-lg transition-colors",
          eraseActive
            ? "bg-primary/20 text-primary ring-1 ring-primary/40"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
        )}
        onClick={activateErase}
        title="Erase mask"
      >
        <Eraser size={18} weight={eraseActive ? "fill" : "regular"} />
      </Button>

      {onToggleFullscreen && (
        <>
          <div className="w-px h-4 sm:h-6 bg-border mx-0.5 sm:mx-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-9 sm:w-9 rounded-md sm:rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50"
            onClick={onToggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
          >
            {isFullscreen ? <ArrowsIn size={18} /> : <ArrowsOut size={18} />}
          </Button>
        </>
      )}
    </div>
  )
}
