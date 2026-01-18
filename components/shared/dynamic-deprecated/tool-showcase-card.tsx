"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Sparkle } from "@phosphor-icons/react"

interface Step {
  mediaPath: string
  title: string
  description: string
  mediaType?: 'image' | 'video'
}

interface ToolShowcaseCardProps {
  className?: string
  tool_title?: string
  title: string
  highlightedTitle: string
  description: string
  optional_description?: string
  steps?: Step[]
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

export function ToolShowcaseCard({
  className,
  tool_title,
  title,
  highlightedTitle,
  description,
  optional_description,
  steps = [],
  learnMoreLink = "#",
  icon,
}: ToolShowcaseCardProps) {
  return (
    <Card className={cn("w-full h-full flex flex-col", className)}>
      <CardContent className="flex flex-col gap-[clamp(0.25rem,0.75vh,0.5rem)] p-[clamp(0.375rem,1vh,0.625rem)] min-h-0 flex-1 overflow-hidden justify-start">
        {/* Header with Badge */}
        {tool_title && (
          <div className="flex items-center justify-center shrink-0">
            <Badge variant="outline" className="text-[clamp(0.6875rem,1.1vw,0.875rem)] font-semibold px-[clamp(0.5rem,0.875vw,0.75rem)] py-[clamp(0.1875rem,0.5vh,0.3125rem)] h-auto">
              {icon || <Sparkle className="size-[clamp(0.8125rem,1.4vw,1rem)]" />}
              <span className="ml-[clamp(0.25rem,0.5vw,0.5rem)]">{tool_title}</span>
            </Badge>
          </div>
        )}

        {/* Main Title */}
        <div className="space-y-[clamp(0.1875rem,0.5vh,0.375rem)] text-center shrink-0">
          <h1 className="text-[clamp(1.25rem,3.5vw,2.5rem)] font-bold leading-tight">
            {title}{" "}
            <span className="text-primary">{highlightedTitle}</span>
          </h1>
          <p className="text-muted-foreground text-[clamp(0.6875rem,1.1vw,1rem)] max-w-2xl mx-auto px-2 leading-tight">
            {description}
          </p>
          {optional_description && (
            <a
              href={learnMoreLink}
              className="text-[clamp(0.6875rem,1vw,0.875rem)] text-muted-foreground hover:text-foreground transition-colors inline-block"
            >
              {optional_description}
            </a>
          )}
        </div>

        {/* Steps Section */}
        {steps.length > 0 && (
          <div className="flex flex-col shrink-0 space-y-[clamp(0.25rem,0.75vh,0.5rem)]">
            {/* Only show heading if more than one step */}
            {steps.length > 1 && (
              <h3 className="text-[clamp(0.75rem,1.4vw,0.9375rem)] font-bold text-center shrink-0 leading-tight">
                GENERATE IN{" "}
                <span className="text-primary">{steps.length} EASY STEPS</span>
              </h3>
            )}
            <div className="flex flex-col md:flex-row md:justify-center md:flex-wrap gap-[clamp(0.375rem,1vh,0.5rem)] shrink-0 overflow-hidden md:overflow-y-auto">
              {steps.map((step, index) => {
                const stepNumber = index + 1
                const mediaType = detectMediaType(step.mediaPath, step.mediaType)
                const isSingleStep = steps.length === 1
                
                return (
                  <div key={index} className="relative flex flex-col min-h-0 md:flex-[1_1_0] md:min-w-0 md:max-w-[calc(50%-0.125rem)] lg:max-w-[calc(33.333%-0.25rem)] lg:flex-[0_0_calc(33.333%-0.25rem)]">
                    {/* Conditionally render Card wrapper only if more than one step */}
                    {isSingleStep ? (
                      <div className="flex flex-col h-fit min-w-0">
                        <div className="shrink-0">
                          {mediaType === 'video' ? (
                                                        // <div className="overflow-hidden rounded-lg w-full h-[clamp(3.5rem,9vh,6.5rem)] md:h-[clamp(5.5rem,12vh,9rem)]">
                            <div className="overflow-hidden rounded-lg w-full h-[clamp(6rem,15vh,12rem)] md:h-[clamp(10rem,20vh,18rem)]">
                              <video
                                src={step.mediaPath}
                                className="w-full h-full object-contain block rounded-lg"
                                loop
                                muted
                                autoPlay
                                playsInline
                              />
                            </div>
                          ) : (
                            <div className="overflow-hidden rounded-lg w-full h-[clamp(6rem,15vh,12rem)] md:h-[clamp(10rem,20vh,18rem)]">
                              <img
                                src={step.mediaPath}
                                alt={step.title}
                                className="w-full h-full object-contain block rounded-lg"
                              />
                            </div>
                          )}
                        </div>
                        {(step.title || step.description) && (
                          <div className="pt-[clamp(0.125rem,0.3vh,0.25rem)] space-y-[clamp(0.0625rem,0.25vh,0.125rem)] text-center shrink-0">
                            {step.title && (
                              <h4 className="font-semibold text-[clamp(0.625rem,1.2vw,0.75rem)] md:text-[clamp(0.75rem,1.5vw,0.875rem)] uppercase tracking-wide leading-tight">
                                {step.title}
                              </h4>
                            )}
                            {step.description && (
                              <p className="text-[clamp(0.625rem,1.1vw,0.75rem)] md:text-[clamp(0.75rem,1.3vw,0.875rem)] text-muted-foreground leading-tight">
                                {step.description}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Card className="overflow-visible flex flex-col flex-none h-fit min-w-0 relative">
                        {/* Step Number - Positioned at top-left of Card */}
                        <div className="absolute top-0.5 left-0.5 z-10">
                          <div className="bg-primary text-primary-foreground size-[clamp(1.5rem,3.5vw,2rem)] rounded-md flex items-center justify-center font-bold text-[clamp(0.6875rem,1.6vw,0.875rem)] shadow-lg">
                            {stepNumber}
                          </div>
                        </div>
                        <CardContent className="p-0 flex flex-col h-fit min-w-0">
                          <div className="pt-[clamp(0.125rem,0.4vh,0.25rem)] px-[clamp(0.125rem,0.4vh,0.25rem)] shrink-0">
                            {mediaType === 'video' ? (
                              <div className="overflow-hidden rounded-lg w-full h-[clamp(6rem,15vh,12rem)] md:h-[clamp(10rem,20vh,18rem)]">
                                <video
                                  src={step.mediaPath}
                                  className="w-full h-full object-contain block rounded-lg"
                                  loop
                                  muted
                                  autoPlay
                                  playsInline
                                />
                              </div>
                            ) : (
                              <div className="overflow-hidden rounded-lg w-full h-[clamp(6rem,15vh,12rem)] md:h-[clamp(10rem,20vh,18rem)]">
                                <img
                                  src={step.mediaPath}
                                  alt={step.title}
                                  className="w-full h-full object-contain block rounded-lg"
                                />
                              </div>
                            )}
                          </div>
                          <div className="px-[clamp(0.125rem,0.4vh,0.25rem)] pb-[clamp(0.125rem,0.4vh,0.25rem)] pt-[clamp(0.125rem,0.3vh,0.25rem)] space-y-[clamp(0.0625rem,0.25vh,0.125rem)] text-center shrink-0">
                            <h4 className="font-semibold text-[clamp(0.625rem,1.2vw,0.75rem)] md:text-[clamp(0.75rem,1.5vw,0.875rem)] uppercase tracking-wide leading-tight">
                              {step.title}
                            </h4>
                            <p className="text-[clamp(0.625rem,1.1vw,0.75rem)] md:text-[clamp(0.75rem,1.3vw,0.875rem)] text-muted-foreground leading-tight">
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
