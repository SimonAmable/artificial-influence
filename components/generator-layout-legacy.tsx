"use client"

import * as React from "react"
import { GeneratorLayout } from "@/components/generator-layout"
import { InputPromptBox } from "@/components/input-prompt-box"
import { ToolShowcaseCard } from "@/components/tool-showcase-card"
import { LayoutMode } from "@/components/layout-toggle"

interface Step {
  mediaPath: string
  title: string
  description: string
  mediaType?: 'image' | 'video'
}

interface GeneratorLayoutLegacyProps {
  // ToolShowcaseCard props
  tool_title?: string
  title?: string
  highlightedTitle?: string
  description?: string
  optional_description?: string
  steps?: Step[]
  learnMoreLink?: string
  icon?: React.ReactNode
  
  // Layout props
  onGenerate?: () => void
  layoutMode?: LayoutMode
}

/**
 * Legacy wrapper for GeneratorLayout that maintains backward compatibility
 * with the old prop-based API. This allows gradual migration to the new
 * composition-based API.
 * 
 * @deprecated Use GeneratorLayout with composition pattern instead
 */
export function GeneratorLayoutLegacy({ 
  tool_title = "",
  title = "",
  highlightedTitle = "",
  description = "",
  optional_description,
  steps = [],
  learnMoreLink,
  icon,
  onGenerate, 
  layoutMode = "column" 
}: GeneratorLayoutLegacyProps) {
  const toolShowcaseProps = {
    tool_title,
    title,
    highlightedTitle,
    description,
    optional_description,
    steps,
    learnMoreLink,
    icon,
  }

  return (
    <GeneratorLayout
      layoutMode={layoutMode}
      promptBox={
        <InputPromptBox
          forceRowLayout={layoutMode === "row"}
          onGenerate={onGenerate || (() => {
            console.log("Generate clicked")
          })}
        />
      }
      showcase={<ToolShowcaseCard {...toolShowcaseProps} />}
    />
  )
}
