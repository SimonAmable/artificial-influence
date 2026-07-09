"use client"

import { HISTORY_TOOLS, HISTORY_TYPES } from "@/components/library/history/constants"
import type { GenerationType } from "@/components/library/history/types"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"

type HistoryFilterOptionsProps = {
  historyType: GenerationType
  onHistoryTypeChange: (type: GenerationType) => void
  historyTool: string
  onHistoryToolChange: (tool: string) => void
  columnCount: number
  onColumnCountChange: (value: number) => void
  showColumnSlider?: boolean
}

export function HistoryFilterOptions({
  historyType,
  onHistoryTypeChange,
  historyTool,
  onHistoryToolChange,
  columnCount,
  onColumnCountChange,
  showColumnSlider = false,
}: HistoryFilterOptionsProps) {
  return (
    <div className="space-y-4 p-4 text-foreground">
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Media Type
        </label>
        <div className="flex flex-wrap gap-1.5">
          {HISTORY_TYPES.map((type) => (
            <Button
              key={type}
              variant={historyType === type ? "default" : "outline"}
              size="sm"
              onClick={() => onHistoryTypeChange(type)}
              className="h-8 rounded-full px-3 py-1 text-xs capitalize"
            >
              {type}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Created with Tool
        </label>
        <div className="flex max-h-[160px] flex-wrap gap-1.5 overflow-y-auto pr-1">
          {HISTORY_TOOLS.map((tool) => (
            <Button
              key={tool.value}
              variant={historyTool === tool.value ? "default" : "outline"}
              size="sm"
              onClick={() => onHistoryToolChange(tool.value)}
              className="h-8 rounded-full px-3 py-1 text-xs"
            >
              {tool.label}
            </Button>
          ))}
        </div>
      </div>

      {showColumnSlider ? (
        <div className="space-y-2 border-t border-border/50 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Grid Columns
            </span>
            <span className="text-sm font-medium text-primary">{columnCount}</span>
          </div>
          <Slider
            value={[columnCount]}
            onValueChange={(value) => onColumnCountChange(value[0])}
            min={2}
            max={6}
            step={1}
            className="py-2"
          />
        </div>
      ) : null}
    </div>
  )
}
