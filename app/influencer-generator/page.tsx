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
        "h-screen w-full min-w-0 bg-background overflow-hidden flex flex-col",
        isRowLayout ? "p-0" : "p-2 sm:p-4 md:p-6"
      )}
    >
      <div
        className={cn(
          "w-full min-w-0 overflow-hidden flex-1 min-h-0 flex flex-col flex-1",
          isRowLayout ? "pt-[50px]" : "pt-16 sm:pt-20"
        )}
      >
        <div className="h-full w-full min-w-0 flex-1 min-h-0">
          <ImageEditor mode="page" className="h-full w-full min-w-0" />
        </div>
      </div>
    </div>
  )
}
