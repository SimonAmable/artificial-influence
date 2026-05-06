"use client"

import * as React from "react"
import Image from "next/image"
import { isAiMonochromeIconPath } from "@/lib/constants/ai-vendor-icons"
import { getModelIconPath } from "@/lib/utils/model-icons"
import { cn } from "@/lib/utils"

/** Shown when no vendor icon exists for a model (same asset as `custom/character-swap`). */
const FALLBACK_ICON_PATH = "/logo.svg"

interface ModelIconProps {
  identifier: string
  size?: number
  className?: string
  srcOverride?: string
}

export function ModelIcon({ identifier, size = 16, className, srcOverride }: ModelIconProps) {
  const iconPath = srcOverride ?? getModelIconPath(identifier)
  
  if (!iconPath) {
    return (
      <Image
        src={FALLBACK_ICON_PATH}
        alt=""
        width={size}
        height={size}
        className={cn(
          "object-contain",
          isAiMonochromeIconPath(FALLBACK_ICON_PATH) && "brightness-0 dark:invert",
          className
        )}

        aria-hidden
      />
    )
  }

  const needsDarkContrast = isAiMonochromeIconPath(iconPath)

  return (
    <Image
      src={iconPath}
      alt={`${identifier} icon`}
      width={size}
      height={size}
      className={cn(
        "object-contain",
        needsDarkContrast && "brightness-0 dark:invert",
        className
      )}

    />
  )
}
