"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Sparkle } from "@phosphor-icons/react"
import { useLayoutMode } from "@/components/shared/layout/layout-mode-context"

interface InfluencerStep {
  mediaPath: string
  title: string
  description: string
  mediaType?: 'image' | 'video'
}

interface InfluencerShowcaseCardProps {
  className?: string
  tool_title?: string
  title: string
  highlightedTitle: string
  description: string
  optional_description?: string
  steps?: InfluencerStep[]
  learnMoreLink?: string
  icon?: React.ReactNode
}

/**
 * Detects media type from file extension
 * Returns 'image' or 'video', defaults to 'image' if type cannot be determined
 */
function detectMediaType(mediaPath: string, explicitType?: 'image' | 'video'): 'image' | 'video' {
  if (explicitType) {
    return explicitType
  }

  const extension = mediaPath.split('.').pop()?.toLowerCase()
  
  const videoExtensions = ['mp4', 'webm', 'mov', 'avi', 'mkv']
  
  if (extension && videoExtensions.includes(extension)) {
    return 'video'
  }
  
  // Default to image if extension is image type or unknown
  return 'image'
}

export function InfluencerShowcaseCard({
  className,
  tool_title,
  title,
  highlightedTitle,
  description,
  optional_description,
  steps = [],
  learnMoreLink = "#",
  icon,
}: InfluencerShowcaseCardProps) {
  const layoutModeContext = useLayoutMode()
  const isRowLayout = layoutModeContext?.layoutMode === "row"
  
  const content = (
    <>
      {/* Header with Badge */}
      {tool_title && (
        <div className="flex items-center justify-center shrink-0 influencer-showcase-badge-container">
          <Badge variant="outline" className="text-xs md:text-sm font-semibold px-2 md:px-3 py-1 h-auto influencer-showcase-badge">
            {icon || <Sparkle className="size-4 md:size-5" />}
            <span className="ml-1 md:ml-2 influencer-showcase-badge-text">{tool_title}</span>
          </Badge>
        </div>
      )}

      {/* Main Title */}
      <div className="space-y-1.5 md:space-y-2 text-center shrink-0 influencer-showcase-title-container max-w-4xl mx-auto">
        <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-balance leading-[1.1] influencer-showcase-title">
          {title}{" "}
          <span className="text-primary influencer-showcase-title-highlight">{highlightedTitle}</span>
        </h1>
        <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto px-4 text-balance influencer-showcase-description">
          {description}
        </p>
        {optional_description && (
          <a
            href={learnMoreLink}
            className="text-sm md:text-base text-primary/80 hover:text-primary transition-colors inline-block font-medium influencer-showcase-optional-link"
          >
            {optional_description}
          </a>
        )}
      </div>

      {/* Single Centered Image Showcase */}
      {steps.length > 0 && (
        <div className="flex flex-col shrink-0 mt-2 md:mt-4 influencer-showcase-steps-container">
          <div className="flex items-center justify-center w-full mx-auto influencer-showcase-steps-grid">
            {(() => {
              const firstStep = steps[0]
              const mediaType = detectMediaType(firstStep.mediaPath, firstStep.mediaType)
              
              return (
                <div className="relative flex flex-col min-h-0 influencer-showcase-step w-2/3 md:w-1/4">
                  <div className="flex flex-col h-full min-w-0 influencer-showcase-step-single">
                    <div className="shrink-0 influencer-showcase-step-media-container overflow-hidden">
                      {mediaType === 'video' ? (
                        <div className="w-full influencer-showcase-step-video-wrapper">
                          <video
                            src={firstStep.mediaPath}
                            className="w-full h-auto block influencer-showcase-step-video"
                            loop
                            muted
                            autoPlay
                            playsInline
                          />
                        </div>
                      ) : (
                        <div className="w-full influencer-showcase-step-image-wrapper">
                          <img
                            src={firstStep.mediaPath}
                            alt={firstStep.title || "Showcase image"}
                            className="w-full h-auto block influencer-showcase-step-image"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </>
  )

  // Use Card wrapper only in column layout, plain div in row layout
  if (isRowLayout) {
    return (
      <div className={cn("w-full min-h-full flex flex-col influencer-showcase-card overflow-visible", className)}>
        <div className="flex flex-col gap-4 p-4 md:p-4 pb-10 md:pb-16 justify-start influencer-showcase-content overflow-visible">
          {content}
        </div>
      </div>
    )
  }

  return (
    <Card className={cn("w-full min-h-full flex flex-col influencer-showcase-card border-none shadow-none bg-transparent py-0 overflow-visible", className)}>
      <CardContent className="flex flex-col gap-4 p-4 md:p-4 pb-10 md:pb-16 justify-start influencer-showcase-content overflow-visible">
        {content}
      </CardContent>
    </Card>
  )
}
