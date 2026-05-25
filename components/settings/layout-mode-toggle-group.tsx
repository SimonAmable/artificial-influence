"use client"

import { Columns, Rows } from "@phosphor-icons/react"

import { LayoutMode } from "@/components/shared/layout/layout-toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type LayoutModeToggleGroupProps = {
  layoutMode: LayoutMode
  onLayoutModeChange: (mode: LayoutMode) => void
  className?: string
}

export function LayoutModeToggleGroup({
  layoutMode,
  onLayoutModeChange,
  className,
}: LayoutModeToggleGroupProps) {
  return (
    <ToggleGroup
      type="single"
      value={layoutMode}
      onValueChange={(value) => {
        if (!value) return
        onLayoutModeChange(value as LayoutMode)
      }}
      variant="outline"
      size="sm"
      className={className ?? "flex w-full"}
      aria-label="UI layout"
    >
      <ToggleGroupItem
        value="column"
        aria-label="Column layout"
        title="Column layout"
        className="h-8 flex-1 gap-1.5 rounded-full px-2 text-xs"
      >
        <Columns className="size-4" weight="bold" />
        <span>Column</span>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="row"
        aria-label="Row layout"
        title="Row layout"
        className="h-8 flex-1 gap-1.5 rounded-full px-2 text-xs"
      >
        <Rows className="size-4" weight="bold" />
        <span>Row</span>
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
