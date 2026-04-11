"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Toggle } from "@/components/ui/toggle"
import { Sparkle } from "@phosphor-icons/react"

export interface ImageEnhanceSwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** "page" = full label; "toolbar" = short label, compact */
  variant?: "page" | "toolbar"
  className?: string
  id?: string
}

export function ImageEnhanceSwitch({
  checked,
  onCheckedChange,
  variant = "page",
  className,
  id = "image-enhance-switch",
}: ImageEnhanceSwitchProps) {
  const isToolbar = variant === "toolbar"

  return (
    <Toggle
      id={id}
      pressed={checked}
      onPressedChange={onCheckedChange}
      aria-label="Enhance prompt"
      className={cn(
        "h-9 px-2 rounded-[28px] border border-border bg-muted/30 hover:bg-muted/50",
        "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary/30",
        "data-[state=on]:hover:bg-primary/90 data-[state=on]:hover:text-primary-foreground",
        "aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90",
        isToolbar ? "gap-1.5" : "gap-1.5",
        className
      )}
    >
      <Sparkle className="size-3.5 shrink-0" weight={checked ? "fill" : "regular"} />
      <span className="text-xs font-medium">{isToolbar ? "Enhance" : "Enhance"}</span>
    </Toggle>
  )
}
