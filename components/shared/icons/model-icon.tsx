"use client"

import * as React from "react"
import Image from "next/image"
import { Robot } from "@phosphor-icons/react"
import { getModelIconPath } from "@/lib/utils/model-icons"
import { cn } from "@/lib/utils"

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
  
  return (
    <Image
      src={iconPath}
      alt={`${identifier} icon`}
      width={size}
      height={size}
      className={cn("object-contain", className)}
      unoptimized // SVG files don't need optimization
    />
  )
}
