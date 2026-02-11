"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

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
    <div
      className={cn(
        "flex items-center gap-1.5",
        isToolbar ? "gap-2 px-1" : "h-7 px-2 py-[18px] rounded-[28px] border border-border bg-muted/30",
        className
      )}
    >
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={isToolbar ? undefined : "scale-90"}
      />
      <Label
        htmlFor={id}
        className={cn("text-xs cursor-pointer whitespace-nowrap", isToolbar && "text-zinc-400")}
      >
        {isToolbar ? (
          "Enhance"
        ) : (
          <span className="hidden md:inline">Enhance Prompt</span>
        )}
      </Label>
    </div>
  )
}
