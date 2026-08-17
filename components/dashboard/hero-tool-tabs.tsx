"use client"

import * as React from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

export type HeroToolTabId = "agent" | "image" | "video"

export const HERO_TOOL_TABS: Array<{
  id: HeroToolTabId
  label: string
  iconSrc: string
}> = [
  { id: "agent", label: "Agent", iconSrc: "/3d_icons/agent.png" },
  { id: "image", label: "Image", iconSrc: "/3d_icons/image.png" },
  { id: "video", label: "Video", iconSrc: "/3d_icons/video.png" },
]

interface HeroToolTabsProps {
  value: HeroToolTabId
  onChange: (id: HeroToolTabId) => void
  className?: string
  "aria-label"?: string
}

export function HeroToolTabs({
  value,
  onChange,
  className,
  "aria-label": ariaLabel = "Creation tools",
}: HeroToolTabsProps) {
  return (
    <div
      className={cn(
        "relative z-20 inline-flex flex-wrap items-center justify-center gap-1 rounded-full border p-[3px] backdrop-blur",
        "border-border/65 bg-muted/95",
        "shadow-[inset_0_2px_6px_rgba(0,0,0,0.10),inset_0_1px_2px_rgba(0,0,0,0.06),inset_0_-1px_1px_rgba(255,255,255,0.35)]",
        "dark:border-border/45 dark:bg-muted/55",
        "dark:shadow-[inset_0_2px_12px_rgba(0,0,0,0.55),inset_0_1px_2px_rgba(0,0,0,0.45),inset_0_-1px_0_rgba(255,255,255,0.04)]",
        className,
      )}
      role="tablist"
      aria-label={ariaLabel}
    >
      {HERO_TOOL_TABS.map((tab) => {
        const isActive = value === tab.id

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "inline-flex min-h-8 min-w-[6.5rem] shrink-0 items-center justify-center gap-1.5 rounded-full border border-transparent px-3 py-1 text-center text-sm font-medium transition-[color,box-shadow,border-color,background-color]",
              isActive
                ? "border-border/80 bg-background text-foreground shadow-sm dark:border-border/60 dark:bg-card/90"
                : "text-muted-foreground hover:bg-background/40 hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "relative flex size-5 items-center justify-center transition-transform duration-300 ease-out",
                isActive ? "scale-[2]" : "scale-100",
              )}
            >
              <Image
                src={tab.iconSrc}
                alt=""
                width={20}
                height={20}
                className="h-5 w-5 object-contain"
                aria-hidden
              />
            </span>
            <span>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
