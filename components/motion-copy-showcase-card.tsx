"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Sparkle } from "@phosphor-icons/react"

interface MotionCopyStep {
  mediaPath: string
  title: string
  description: string
  mediaType?: 'image' | 'video'
}

interface MotionCopyShowcaseCardProps {
  className?: string
  tool_title?: string
  title: string
  highlightedTitle: string
  description: string
  optional_description?: string
  steps?: MotionCopyStep[]
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
  
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
  const videoExtensions = ['mp4', 'webm', 'mov', 'avi', 'mkv']
  
  if (extension && videoExtensions.includes(extension)) {
    return 'video'
  }
  
  // Default to image if extension is image type or unknown
  return 'image'
}

export function MotionCopyShowcaseCard({
  className,
  tool_title,
  title,
  highlightedTitle,
  description,
  optional_description,
  steps = [],
  learnMoreLink = "#",
  icon,
}: MotionCopyShowcaseCardProps) {
  return (
    <Card className={cn("w-full min-h-full flex flex-col motion-copy-showcase-card border-none shadow-none bg-transparent py-0 overflow-visible", className)}>
      <CardContent className="flex flex-col gap-4 p-4 md:p-4 pb-10 md:pb-16 justify-start motion-copy-showcase-content overflow-visible">
        {/* Header with Badge */}
        {tool_title && (
          <div className="flex items-center justify-center shrink-0 motion-copy-showcase-badge-container">
            <Badge variant="outline" className="text-xs md:text-sm font-semibold px-2 md:px-3 py-1 h-auto motion-copy-showcase-badge">
              {icon || <Sparkle className="size-4 md:size-5" />}
              <span className="ml-1 md:ml-2 motion-copy-showcase-badge-text">{tool_title}</span>
            </Badge>
          </div>
        )}

        {/* Main Title */}
        <div className="space-y-1.5 md:space-y-2 text-center shrink-0 motion-copy-showcase-title-container max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-balance leading-[1.1] motion-copy-showcase-title">
            {title}{" "}
            <span className="text-primary motion-copy-showcase-title-highlight">{highlightedTitle}</span>
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto px-4 text-balance motion-copy-showcase-description">
            {description}
          </p>
          {optional_description && (
            <a
              href={learnMoreLink}
              className="text-sm md:text-base text-primary/80 hover:text-primary transition-colors inline-block font-medium motion-copy-showcase-optional-link"
            >
              {optional_description}
            </a>
          )}
        </div>

        {/* Steps Section */}
        {steps.length > 0 && (
          <div className="flex flex-col shrink-0 space-y-3 md:space-y-4 mt-2 md:mt-4 motion-copy-showcase-steps-container">
            {/* Only show heading if more than one step */}
            {steps.length > 1 && (
              <h3 className="text-xs md:text-sm font-bold text-center shrink-0 tracking-[0.2em] uppercase text-muted-foreground motion-copy-showcase-steps-heading">
                GENERATE IN{" "}
                <span className="text-primary motion-copy-showcase-steps-heading-highlight">{steps.length} EASY STEPS</span>
              </h3>
            )} 
            <div className={cn(
              "grid gap-4 md:gap-4 w-full motion-copy-showcase-steps-grid",
              steps.length === 1 ? "grid-cols-1 max-w-5xl mx-auto" : 
              "grid-cols-3"
            )}>
              {steps.map((step, index) => {
                const stepNumber = index + 1
                const mediaType = detectMediaType(step.mediaPath, step.mediaType)
                const isSingleStep = steps.length === 1
                
                return (
                  <div key={index} className="relative flex flex-col min-h-0 motion-copy-showcase-step">
                    {/* Conditionally render Card wrapper only if more than one step */}
                    {isSingleStep ? (
                      <div className="flex flex-col h-full min-w-0 motion-copy-showcase-step-single">
                        <div className="shrink-0 motion-copy-showcase-step-media-container shadow-2xl rounded-2xl overflow-hidden border border-border/50 bg-black/5 dark:bg-white/5">
                          {mediaType === 'video' ? (
                            <div className="w-full motion-copy-showcase-step-video-wrapper">
                              <video
                                src={step.mediaPath}
                                className="w-full h-auto block motion-copy-showcase-step-video"
                                loop
                                muted
                                autoPlay
                                playsInline
                              />
                            </div>
                          ) : (
                            <div className="w-full motion-copy-showcase-step-image-wrapper">
                              <img
                                src={step.mediaPath}
                                alt={step.title}
                                className="w-full h-auto block motion-copy-showcase-step-image"
                              />
                            </div>
                          )}
                        </div>
                        {(step.title || step.description) && (
                          <div className="pt-3 md:pt-4 space-y-1 text-center shrink-0 motion-copy-showcase-step-text">
                            {step.title && (
                              <h4 className="font-bold text-lg md:text-xl lg:text-2xl uppercase tracking-wider motion-copy-showcase-step-title">
                                {step.title}
                              </h4>
                            )}
                            {step.description && (
                              <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto motion-copy-showcase-step-description">
                                {step.description}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Card className="flex flex-col h-auto min-h-full relative motion-copy-showcase-step-card border-border/50 transition-all hover:shadow-xl hover:border-primary/20 bg-card/50 backdrop-blur-sm py-0 overflow-visible">
                        {/* Step Number - Positioned at top-left of Card */}
                        <div className="absolute top-3 left-3 z-10 motion-copy-showcase-step-number-container">
                          <div className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-lg border-2 border-background motion-copy-showcase-step-number">
                            {stepNumber}
                          </div>
                        </div>
                        <CardContent className="p-0 flex flex-col min-h-full motion-copy-showcase-step-card-content overflow-visible">
                          <div className="shrink-0 motion-copy-showcase-step-media-wrapper overflow-hidden bg-black/5 dark:bg-white/5 aspect-video flex items-center justify-center rounded-t-2xl">
                            {mediaType === 'video' ? (
                              <video
                                src={step.mediaPath}
                                className="max-w-full max-h-full object-contain block motion-copy-showcase-step-video"
                                loop
                                muted
                                autoPlay
                                playsInline
                              />
                            ) : (
                              <img
                                src={step.mediaPath}
                                alt={step.title}
                                className="max-w-full max-h-full object-contain block motion-copy-showcase-step-image"
                              />
                            )}
                          </div>
                          <div className="p-2.5 md:p-3 pb-4 md:pb-5 space-y-1 text-center flex-1 flex flex-col justify-start motion-copy-showcase-step-text">
                            <h4 className="font-bold text-sm md:text-base lg:text-lg uppercase tracking-widest motion-copy-showcase-step-title">
                              {step.title}
                            </h4>
                            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed motion-copy-showcase-step-description">
                              {step.description}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
