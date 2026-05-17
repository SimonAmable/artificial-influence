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
  /** Inpaint tab uses "Mask"; full editor uses "Mask" for lasso vs "Stroke" for brush */
  sizeLabel = "Brush",
  /** aria / slider label */
  sliderAriaLabel,
}: {
  className?: string
  inline?: boolean
  sizeLabel?: "Brush" | "Mask" | "Stroke"
  sliderAriaLabel?: string
}) {
  const { state, setBrushSize } = useImageEditor()
  const size = state.brushSettings.size

  const aria =
    sliderAriaLabel ??
    (sizeLabel === "Mask"
      ? "Mask brush size"
      : sizeLabel === "Stroke"
        ? "Paint brush size"
        : "Brush size")

  return (
    <div
      className={cn(
        "flex items-center border border-border bg-card/90 backdrop-blur-md",
        inline
          ? "gap-2 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl min-w-0 flex-1 max-w-[min(100%,18rem)] sm:max-w-xs"
          : "gap-3 rounded-xl px-3 py-2.5 shadow-lg min-w-[200px] max-w-[280px] sm:min-w-[240px] sm:max-w-[320px]",
        className
      )}
    >
      <span className="text-xs font-medium text-muted-foreground shrink-0">
        {sizeLabel}
      </span>
      <Slider
        value={[size]}
        min={MIN}
        max={MAX}
        step={1}
        onValueChange={([v]) => setBrushSize(v)}
        className="flex-1 py-1"
        aria-label={aria}
      />
      <span className="text-xs tabular-nums text-foreground w-9 text-right shrink-0">
        {size}px
      </span>
    </div>
  )
}
