"use client"

import * as React from "react"
import { CornersOut } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useImageEditor } from "./image-editor-provider"

const ASPECT_RATIO_OPTIONS = [
  { label: "Auto", value: "auto", ratio: null as number | null },
  { label: "1:1", value: "1:1", ratio: 1 },
  { label: "4:3", value: "4:3", ratio: 4 / 3 },
  { label: "3:2", value: "3:2", ratio: 3 / 2 },
  { label: "16:9", value: "16:9", ratio: 16 / 9 },
  { label: "9:16", value: "9:16", ratio: 9 / 16 },
] as const

function ratioToValue(ratio: number | null): string {
  const match = ASPECT_RATIO_OPTIONS.find((option) => option.ratio === ratio)
  return match?.value ?? "auto"
}

export function ImageEditorCanvasAspectControl({
  className,
  disabled = false,
}: {
  className?: string
  disabled?: boolean
}) {
  const { state, setCanvasAspectRatio } = useImageEditor()
  const value = ratioToValue(state.canvasAspectRatio)

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const option = ASPECT_RATIO_OPTIONS.find((item) => item.value === next)
        setCanvasAspectRatio(option?.ratio ?? null)
      }}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn("h-7 w-fit min-w-0 gap-1.5 px-2 text-xs", className)}
        aria-label="Canvas aspect ratio"
      >
        <CornersOut size={14} className="shrink-0 text-muted-foreground" aria-hidden />
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" side="top" sideOffset={4}>
        {ASPECT_RATIO_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
