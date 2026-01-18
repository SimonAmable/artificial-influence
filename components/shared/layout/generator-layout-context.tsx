"use client"

import * as React from "react"
import { LayoutMode } from "@/components/shared/layout/layout-toggle"

interface GeneratorLayoutContextValue {
  layoutMode: LayoutMode
  isRowLayout: boolean
  isColumnLayout: boolean
  promptBoxClasses: string
  showcaseClasses: string
  promptBoxContainerClasses: string
  showcaseContainerClasses: string
}

const GeneratorLayoutContext = React.createContext<GeneratorLayoutContextValue | null>(null)

interface GeneratorLayoutProviderProps {
  layoutMode: LayoutMode
  children: React.ReactNode
}

export function GeneratorLayoutProvider({ layoutMode, children }: GeneratorLayoutProviderProps) {
  const isRowLayout = layoutMode === "row"
  const isColumnLayout = layoutMode === "column"

  // Column layout classes
  const columnPromptBoxClasses = "hidden lg:block lg:sticky lg:top-6 h-fit"
  const columnShowcaseClasses = "h-[80vh]"
  const columnPromptBoxContainerClasses = "flex justify-center"
  const columnShowcaseContainerClasses = "w-full pb-[400px] lg:pb-0"
  
  // Row layout classes
  const rowPromptBoxClasses = "fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6"
  const rowShowcaseClasses = "w-full max-w-6xl h-full max-h-[70vh]"
  const rowPromptBoxContainerClasses = "max-w-7xl mx-auto flex justify-center"
  const rowShowcaseContainerClasses = "flex-1 flex items-center justify-center pb-0"

  const value: GeneratorLayoutContextValue = {
    layoutMode,
    isRowLayout,
    isColumnLayout,
    promptBoxClasses: isRowLayout ? rowPromptBoxClasses : columnPromptBoxClasses,
    showcaseClasses: isRowLayout ? rowShowcaseClasses : columnShowcaseClasses,
    promptBoxContainerClasses: isRowLayout ? rowPromptBoxContainerClasses : columnPromptBoxContainerClasses,
    showcaseContainerClasses: isRowLayout ? rowShowcaseContainerClasses : columnShowcaseContainerClasses,
  }

  return (
    <GeneratorLayoutContext.Provider value={value}>
      {children}
    </GeneratorLayoutContext.Provider>
  )
}

export function useGeneratorLayout(): GeneratorLayoutContextValue {
  const context = React.useContext(GeneratorLayoutContext)
  if (!context) {
    throw new Error("useGeneratorLayout must be used within GeneratorLayoutProvider")
  }
  return context
}
