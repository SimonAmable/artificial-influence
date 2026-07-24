"use client"

import * as React from "react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const GRID_COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
}

export const segmentedTabsListClassName = cn(
  "grid !h-auto min-h-10 gap-0.5 rounded-4xl p-0.5",
  "border border-border/65 bg-muted/95",
  "shadow-[inset_0_2px_6px_rgba(0,0,0,0.10),inset_0_1px_2px_rgba(0,0,0,0.06),inset_0_-1px_1px_rgba(255,255,255,0.35)]",
  "dark:border-border/45 dark:bg-muted/55",
  "dark:shadow-[inset_0_2px_12px_rgba(0,0,0,0.55),inset_0_1px_2px_rgba(0,0,0,0.45),inset_0_-1px_0_rgba(255,255,255,0.04)]",
)

export const segmentedTabsTriggerClassName =
  "flex min-h-8 w-full min-w-0 shrink-0 items-center justify-center rounded-2xl border border-transparent px-1.5 py-1.5 text-center text-xs font-medium text-muted-foreground transition-[color,box-shadow,border-color,background-color] hover:text-foreground data-active:border-border/80 data-active:bg-background data-active:text-foreground data-active:shadow-sm dark:data-active:border-border/60 dark:data-active:bg-card/90 sm:px-3 sm:text-sm"

type PillToggleGroupProps<T extends string> = {
  "aria-label"?: string
  className?: string
  fullWidth?: boolean
  onValueChange: (value: T) => void
  options: ReadonlyArray<{ label: React.ReactNode; value: T }>
  value: T
}

export function PillToggleGroup<T extends string>({
  "aria-label": ariaLabel,
  className,
  fullWidth = true,
  onValueChange,
  options,
  value,
}: PillToggleGroupProps<T>) {
  const cols = GRID_COLS[options.length] ?? "grid-cols-2"

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        if (next) {
          onValueChange(next as T)
        }
      }}
      className={cn(fullWidth ? "w-full" : "w-fit", className)}
      aria-label={ariaLabel}
    >
      <TabsList variant="default" className={cn(segmentedTabsListClassName, cols, fullWidth ? "w-full" : "w-fit")}>
        {options.map((option) => (
          <TabsTrigger key={option.value} value={option.value} className={segmentedTabsTriggerClassName}>
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
