"use client"

import * as React from "react"
import { Faders } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { useImageEditor } from "./image-editor-provider"
import {
  detectFilterPreset,
  hasActiveFilters,
  IMAGE_FILTER_PRESETS,
} from "@/lib/image-editor/filter-utils"
import type { ImageFilterPresetId, ImageFilterSettings } from "@/lib/image-editor/types"

interface ImageEditorFiltersPopoverProps {
  className?: string
  disabled?: boolean
}

type FilterKey = keyof ImageFilterSettings

const FILTER_CONTROLS: {
  key: FilterKey
  label: string
  min: number
  max: number
}[] = [
  { key: "grain", label: "Grain", min: 0, max: 100 },
  { key: "brightness", label: "Brightness", min: -50, max: 50 },
  { key: "contrast", label: "Contrast", min: -50, max: 50 },
  { key: "saturation", label: "Saturation", min: -50, max: 50 },
  { key: "warmth", label: "Warmth", min: -50, max: 50 },
]

function FilterSliderRow({
  label,
  value,
  min,
  max,
  onChange,
  onCommit,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  onCommit: (value: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs tabular-nums text-foreground">{value}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={([next]) => onChange(next)}
        onValueCommit={([next]) => onCommit(next)}
        aria-label={label}
      />
    </div>
  )
}

export function ImageEditorFiltersPopover({
  className,
  disabled = false,
}: ImageEditorFiltersPopoverProps) {
  const { state, setFilterSettings, resetFilterSettings } = useImageEditor()
  const { filterSettings } = state
  const filtersActive = hasActiveFilters(filterSettings)
  const [open, setOpen] = React.useState(false)

  const updateSetting = React.useCallback(
    (key: FilterKey, value: number) => {
      setFilterSettings({ ...filterSettings, [key]: value })
    },
    [filterSettings, setFilterSettings]
  )

  const commitSetting = React.useCallback(
    (key: FilterKey, value: number) => {
      setFilterSettings({ ...filterSettings, [key]: value }, { saveHistory: true })
    },
    [filterSettings, setFilterSettings]
  )

  const applyPreset = React.useCallback(
    (presetId: ImageFilterPresetId) => {
      const preset = IMAGE_FILTER_PRESETS[presetId]
      setFilterSettings(preset, { saveHistory: true })
    },
    [setFilterSettings]
  )

  const handleReset = React.useCallback(() => {
    resetFilterSettings({ saveHistory: true })
  }, [resetFilterSettings])

  const selectedPreset = detectFilterPreset(filterSettings)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className={cn(
            "relative shrink-0 min-h-10 min-w-10 sm:h-9 sm:w-9 rounded-md sm:rounded-lg transition-colors touch-manipulation",
            open
              ? "bg-primary/20 text-primary ring-1 ring-primary/40"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
            "rounded-lg border border-border bg-card/90 backdrop-blur-md shadow-sm sm:rounded-xl",
            className
          )}
          aria-label="Image filters"
        >
          <Faders size={20} weight={open ? "fill" : "regular"} />
          {filtersActive ? (
            <span
              className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary"
              aria-hidden
            />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="w-[min(92vw,280px)] space-y-4 p-4"
      >
        {disabled ? (
          <p className="text-sm text-muted-foreground">
            Load an image to adjust filters.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Preset</Label>
              <Select
                value={selectedPreset}
                onValueChange={(value) =>
                  applyPreset(value as ImageFilterPresetId)
                }
              >
                <SelectTrigger className="h-9 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="subtle-film">Subtle film</SelectItem>
                  <SelectItem value="warm-vintage">Warm vintage</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {FILTER_CONTROLS.map((control) => (
              <FilterSliderRow
                key={control.key}
                label={control.label}
                value={filterSettings[control.key]}
                min={control.min}
                max={control.max}
                onChange={(value) => updateSetting(control.key, value)}
                onCommit={(value) => commitSetting(control.key, value)}
              />
            ))}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-full text-xs"
              disabled={!filtersActive}
              onClick={handleReset}
            >
              Reset filters
            </Button>

            <p className="text-[10px] leading-snug text-muted-foreground">
              Your last used settings apply to new images.
            </p>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
