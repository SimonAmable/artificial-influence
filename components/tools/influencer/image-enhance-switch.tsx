"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import { Sparkle } from "@phosphor-icons/react"
import { influencerControlPillClassName } from "./animated-control-item"

export interface ImageEnhanceSwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Reserved for layout variants. */
  variant?: "page" | "toolbar"
  className?: string
  id?: string
}

export function ImageEnhanceSwitch({
  checked,
  onCheckedChange,
  variant: _variant = "page",
  className,
  id = "image-enhance-switch",
}: ImageEnhanceSwitchProps) {
  return (
    <div
      className={cn(
        influencerControlPillClassName,
        "flex items-center gap-1.5 px-2",
        className,
      )}
    >
      <Sparkle
        className={cn(
          "size-3.5 shrink-0",
          checked ? "text-primary" : "text-muted-foreground",
        )}
        weight={checked ? "fill" : "regular"}
      />
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label="Enhance prompt"
        className="h-4 w-7 shrink-0 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=unchecked]:bg-muted [&>span]:size-3 [&>span]:shadow-sm [&>span]:data-[state=checked]:translate-x-3"
      />
    </div>
  )
}
