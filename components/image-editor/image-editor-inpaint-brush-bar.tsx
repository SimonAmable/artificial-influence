"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui/slider"
import { useImageEditor } from "./image-editor-provider"

const MIN = 4
const MAX = 80

export function ImageEditorInpaintBrushBar({
  className,
  /** Sits beside the toolbar: same chrome height, no shadow */
  inline = false,
}: {
  className?: string
  inline?: boolean
}) {
  const { state, setBrushSize } = useImageEditor()
  const size = state.brushSettings.size

  return (
    <div
      className={cn(
        "flex items-center border border-white/10 bg-zinc-900/90 backdrop-blur-md",
        inline
          ? "gap-2 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl min-w-0 flex-1 max-w-[min(100%,18rem)] sm:max-w-xs"
          : "gap-3 rounded-xl px-3 py-2.5 shadow-lg min-w-[200px] max-w-[280px] sm:min-w-[240px] sm:max-w-[320px]",
        className
      )}
    >
      <span className="text-xs font-medium text-zinc-400 shrink-0">Brush</span>
      <Slider
        value={[size]}
        min={MIN}
        max={MAX}
        step={1}
        onValueChange={([v]) => setBrushSize(v)}
        className="flex-1 py-1"
        aria-label="Mask brush size"
      />
      <span className="text-xs tabular-nums text-zinc-300 w-9 text-right shrink-0">
        {size}px
      </span>
    </div>
  )
}
