"use client"

import * as React from "react"
import { MagnifyingGlass, SlidersHorizontal } from "@phosphor-icons/react"

import { HistoryFilterOptions } from "@/components/library/history/history-filters"
import type { GenerationType, HistorySource } from "@/components/library/history/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Slider } from "@/components/ui/slider"

type HistorySearchToolbarProps = {
  search: string
  onSearchChange: (value: string) => void
  historyType: GenerationType
  onHistoryTypeChange: (type: GenerationType) => void
  historySource: HistorySource
  onHistorySourceChange: (source: HistorySource) => void
  historyTool: string
  onHistoryToolChange: (tool: string) => void
  columnCount: number
  onColumnCountChange: (value: number) => void
}

export function HistorySearchToolbar({
  search,
  onSearchChange,
  historyType,
  onHistoryTypeChange,
  historySource,
  onHistorySourceChange,
  historyTool,
  onHistoryToolChange,
  columnCount,
  onColumnCountChange,
}: HistorySearchToolbarProps) {
  const [popoverOpen, setPopoverOpen] = React.useState(false)
  const [sheetOpen, setSheetOpen] = React.useState(false)

  const filterProps = {
    historyType,
    onHistoryTypeChange,
    historySource,
    onHistorySourceChange,
    historyTool,
    onHistoryToolChange,
    columnCount,
    onColumnCountChange,
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="relative min-w-0 flex-1 md:max-w-sm lg:max-w-md">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search..."
            className="h-9 rounded-full border-border/50 bg-muted/40 pl-9 transition-all focus:bg-background"
          />
        </div>

        <div className="hidden sm:block">
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full border-border/50 bg-muted/40 hover:bg-muted"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 border-border/60 bg-card p-0 shadow-lg">
              <HistoryFilterOptions {...filterProps} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="block sm:hidden">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full border-border/50 bg-muted/40 hover:bg-muted"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="max-h-[85vh] rounded-t-3xl border-t border-border/60 bg-card p-2 pb-6"
            >
              <SheetHeader className="px-4 pb-1 pt-3">
                <SheetTitle className="text-left text-lg font-semibold">Filters</SheetTitle>
              </SheetHeader>
              <HistoryFilterOptions {...filterProps} showColumnSlider />
            </SheetContent>
          </Sheet>
        </div>

        <div className="hidden items-center gap-2 border-l border-border/40 pl-3 lg:flex">
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            Columns: <span className="font-medium text-primary">{columnCount}</span>
          </span>
          <Slider
            value={[columnCount]}
            onValueChange={(value) => onColumnCountChange(value[0])}
            min={2}
            max={6}
            step={1}
            className="w-20"
          />
        </div>
      </div>
    </div>
  )
}
