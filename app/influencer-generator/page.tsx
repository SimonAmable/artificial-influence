"use client"

import * as React from "react"
import { useLayoutMode } from "@/components/shared/layout/layout-mode-context"
import { ImageEditor } from "@/components/image-editor"
import { cn } from "@/lib/utils"

export default function InfluencerGeneratorPage() {
  const layoutModeContext = useLayoutMode()

  if (!layoutModeContext) {
    throw new Error("InfluencerGeneratorPage must be used within LayoutModeProvider")
  }

  const { layoutMode } = layoutModeContext
  const isRowLayout = layoutMode === "row"

  return (
    <div
      className={cn(
        "h-screen bg-background overflow-hidden flex flex-col",
        isRowLayout ? "p-0" : "p-4 sm:p-6 md:p-12"
      )}
    >
      <div
        className={cn(
          "mx-auto overflow-hidden flex-1 min-h-0 flex flex-col",
          isRowLayout ? "w-full pt-20" : "max-w-7xl pt-12"
        )}
      >
        <div className="h-full flex-1 min-h-0">
          <ImageEditor mode="page" className="h-full" />
        </div>
      </div>
    </div>
  )
}
