"use client"

import * as React from "react"
import Image from "next/image"
import { getModelIconPath } from "@/lib/utils/model-icons"
import { cn } from "@/lib/utils"

/** Shown when no vendor icon exists for a model (same asset as `custom/character-swap`). */
const FALLBACK_ICON_PATH = "/logo.svg"

// Icons that are monochrome black and need inversion in dark mode
const DARK_MODE_INVERT_ICONS = new Set([
  "/ai_icons/grok.svg",
  "/ai_icons/openai.svg",
])

interface ModelIconProps {
  identifier: string
  size?: number
  className?: string
}

export function ModelIcon({ identifier, size = 16, className }: ModelIconProps) {
  const iconPath = getModelIconPath(identifier)
  
  if (!iconPath) {
    return (
      <Image
        src={FALLBACK_ICON_PATH}
        alt=""
        width={size}
        height={size}
        className={cn("object-contain dark:invert", className)}
        unoptimized
        aria-hidden
      />
    )
  }
  
  const needsInvert = DARK_MODE_INVERT_ICONS.has(iconPath)

  return (
    <Image
      src={iconPath}
      alt={`${identifier} icon`}
      width={size}
      height={size}
      className={cn("object-contain", needsInvert && "dark:invert", className)}
      unoptimized
    />
  )
}
