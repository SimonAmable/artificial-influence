"use client"

import * as React from "react"
import Image from "next/image"
import { Robot } from "@phosphor-icons/react"
import { getModelIconPath } from "@/lib/utils/model-icons"
import { cn } from "@/lib/utils"

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
    // Fallback to generic robot icon if no mapping exists
    return (
      <Robot 
        size={size} 
        className={cn("text-muted-foreground", className)}
        weight="regular"
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
