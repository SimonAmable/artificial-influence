"use client"

import * as React from "react"
import { Check, X } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CROP_ASPECT_PRESETS,
  type CropAspectPresetId,
} from "@/lib/image-editor/crop-aspect-options"

interface ImageEditorCropBarProps {
  className?: string
  isApplying?: boolean
  canApply?: boolean
  aspectPreset: CropAspectPresetId
  onAspectPresetChange: (preset: CropAspectPresetId) => void
  onCancel: () => void
  onApply: () => void
}

export function ImageEditorCropBar({
  className,
  isApplying = false,
  canApply = true,
  aspectPreset,
  onAspectPresetChange,
  onCancel,
  onApply,
}: ImageEditorCropBarProps) {
  return (
    <div
      className={cn(
        "flex w-full max-w-2xl shrink-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-card/90 px-2 py-1.5 shadow-sm backdrop-blur-md sm:flex-nowrap sm:rounded-xl sm:px-3",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Select
          value={aspectPreset}
          onValueChange={(value) =>
            onAspectPresetChange(value as CropAspectPresetId)
          }
        >
          <SelectTrigger className="h-8 w-[7.5rem] shrink-0 text-xs sm:w-32">
            <SelectValue placeholder="Aspect" />
          </SelectTrigger>
          <SelectContent>
            {CROP_ASPECT_PRESETS.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="hidden min-w-0 text-xs text-muted-foreground sm:block">
          Drag handles to resize · hold Shift to lock aspect
        </p>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5"
          onClick={onCancel}
          disabled={isApplying}
        >
          <X size={16} />
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5"
          onClick={onApply}
          disabled={isApplying || !canApply}
        >
          <Check size={16} weight="bold" />
          {isApplying ? "Applying…" : "Apply"}
        </Button>
      </div>
    </div>
  )
}
