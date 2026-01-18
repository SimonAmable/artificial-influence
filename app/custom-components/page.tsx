"use client"

import * as React from "react"
import { GeneratorLayout } from "@/components/shared/layout/generator-layout"
import { InputPromptBox } from "@/components/shared/dynamic-deprecated/input-prompt-box"
import { ToolShowcaseCard } from "@/components/shared/dynamic-deprecated/tool-showcase-card"
import { useLayoutMode } from "@/components/shared/layout/layout-mode-context"

export default function CustomComponentsPage() {
  const layoutModeContext = useLayoutMode()
  
  if (!layoutModeContext) {
    throw new Error("CustomComponentsPage must be used within LayoutModeProvider")
  }
  
  const { layoutMode } = layoutModeContext

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        <GeneratorLayout layoutMode={layoutMode}>
          <InputPromptBox
            forceRowLayout={layoutMode === "row"}
            onGenerate={() => {
              console.log("Generate clicked")
            }}
          />
          <ToolShowcaseCard
            title="Custom Components"
            highlightedTitle="Generator"
            description="Generate custom components with ease."
          />
        </GeneratorLayout>
      </div>
    </div>
  )
}
