"use client"

import * as React from "react"
import type { LayoutMode } from "@/components/shared/layout/layout-toggle"
import { cn } from "@/lib/utils"

interface GeneratorLayoutProps {
  layoutMode?: LayoutMode
  children: React.ReactNode
  className?: string
}

/**
 * GeneratorLayout - A simple container that controls flex direction based on layout mode.
 * Only responsible for toggling between row and column layouts.
 * Positioning and sizing should be handled by the parent component.
 */
export function GeneratorLayout({ 
  layoutMode = "column",
  children,
  className
}: GeneratorLayoutProps) {
  const isRowLayout = layoutMode === "row"
  
  return (
    <div 
      className={cn(
        "w-full",
        isRowLayout ? "flex flex-col" : "flex flex-col lg:flex-row",
        className
      )}
    >
      {children}
    </div>
  )
}
