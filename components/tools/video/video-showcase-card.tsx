"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Sparkle } from "@phosphor-icons/react"
import { useLayoutMode } from "@/components/shared/layout/layout-mode-context"

interface VideoShowcaseStep {
  mediaPath: string
  title: string
  description: string
  mediaType?: 'image' | 'video'
}

interface VideoShowcaseCardProps {
  className?: string
  tool_title?: string
  title: string
  highlightedTitle: string
  description: string
  optional_description?: string
  steps?: VideoShowcaseStep[]
  learnMoreLink?: string
  icon?: React.ReactNode
}

function detectMediaType(mediaPath: string, explicitType?: 'image' | 'video'): 'image' | 'video' {
  if (explicitType) {
    return explicitType
  }

  const extension = mediaPath.split('.').pop()?.toLowerCase()
  const videoExtensions = ['mp4', 'webm', 'mov', 'avi', 'mkv']
  
  if (extension && videoExtensions.includes(extension)) {
    return 'video'
  }
  
  return 'image'
}

export function VideoShowcaseCard({
  className,
  tool_title,
  title,
  highlightedTitle,
  description,
  optional_description,
  steps = [],
  learnMoreLink = "#",
  icon,
}: VideoShowcaseCardProps) {
  const layoutModeContext = useLayoutMode()
  const isRowLayout = layoutModeContext?.layoutMode === "row"
  
  const content = (
    <>
      {/* Header with Badge */}
      {tool_title && (
        <div className="flex items-center justify-center shrink-0">
          <Badge variant="outline" className="text-xs md:text-sm font-semibold px-2 md:px-3 py-1 h-auto">
            {icon || <Sparkle className="size-4 md:size-5" />}
            <span className="ml-1 md:ml-2">{tool_title}</span>
          </Badge>
        </div>
      )}

      {/* Main Title */}
      <div className="space-y-1.5 md:space-y-2 text-center shrink-0 max-w-4xl mx-auto">
        <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-balance leading-[1.1]">
          {title}{" "}
          <span className="text-primary">{highlightedTitle}</span>
        </h1>
        <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto px-4 text-balance">
          {description}
        </p>
        {optional_description && (
          <a
            href={learnMoreLink}
            className="text-sm md:text-base text-primary/80 hover:text-primary transition-colors inline-block font-medium"
          >
            {optional_description}
          </a>
        )}
      </div>

      {/* Steps Section */}
      {steps.length > 0 && (
        <div className="flex flex-col shrink-0 space-y-3 md:space-y-4 mt-0">
          {/* Mobile: Show last step as media only */}
          {steps.length >= 1 && (
            <div className="md:hidden w-full max-h-[400px]">
              <Card className="overflow-hidden bg-muted/50 border-none h-full">
                <CardContent className="p-0">
                  {detectMediaType(steps[steps.length - 1].mediaPath, steps[steps.length - 1].mediaType) === 'video' ? (
                    <video
                      src={steps[steps.length - 1].mediaPath}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-auto max-h-[400px] object-contain rounded-lg"
                    />
                  ) : (
                    <img
                      src={steps[steps.length - 1].mediaPath}
                      alt={steps[steps.length - 1].title}
                      className="w-full h-auto max-h-[400px] object-contain rounded-lg"
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Desktop: single media only (no step text) or grid of steps */}
          <div className="hidden md:block w-full max-w-6xl mx-auto">
            {steps.length === 1 ? (
              <Card className="overflow-hidden bg-muted/50 border-none max-h-[400px]">
                <CardContent className="p-0">
                  {detectMediaType(steps[0].mediaPath, steps[0].mediaType) === 'video' ? (
                    <video
                      src={steps[0].mediaPath}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-auto max-h-[400px] object-contain rounded-lg"
                    />
                  ) : (
                    <img
                      src={steps[0].mediaPath}
                      alt={steps[0].title || "Showcase"}
                      className="w-full h-auto max-h-[400px] object-contain rounded-lg"
                    />
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
                {steps.map((step, index) => {
                  const mediaType = detectMediaType(step.mediaPath, step.mediaType)
                  return (
                    <Card
                      key={index}
                      className="overflow-hidden bg-muted/50 border-none"
                    >
                      <CardContent className="p-3 md:p-4 space-y-2 md:space-y-3">
                        <div className="aspect-video rounded-lg overflow-hidden bg-background/50">
                          {mediaType === 'video' ? (
                            <video
                              src={step.mediaPath}
                              autoPlay
                              loop
                              muted
                              playsInline
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <img
                              src={step.mediaPath}
                              alt={step.title}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="space-y-1">
                          <h3 className="font-semibold text-xs md:text-sm tracking-tight">
                            {step.title}
                          </h3>
                          <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                            {step.description}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )

  if (isRowLayout) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-start gap-6 md:gap-8 lg:gap-10 w-full h-full pt-0 pb-0 px-6 md:px-12 lg:px-16 overflow-y-auto",
        className
      )}>
        {content}
      </div>
    )
  }

  return (
    <Card className={cn("w-full h-full flex flex-col", className)}>
      <CardContent className="flex flex-col items-center justify-center flex-1 gap-6 md:gap-8 lg:gap-10 pt-0 pb-0 px-6 md:px-12 lg:px-16 overflow-y-auto">
        {content}
      </CardContent>
    </Card>
  )
}
