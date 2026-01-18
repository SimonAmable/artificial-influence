"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Sparkle, Waveform, Play, Pause, SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react"
import { useLayoutMode } from "@/components/shared/layout/layout-mode-context"
import { Button } from "@/components/ui/button"

interface LipsyncStep {
  mediaPath: string
  title: string
  description: string
  mediaType?: 'image' | 'video' | 'audio'
}

interface LipsyncShowcaseCardProps {
  className?: string
  tool_title?: string
  title: string
  highlightedTitle: string
  description: string
  optional_description?: string
  steps?: LipsyncStep[]
  learnMoreLink?: string
  icon?: React.ReactNode
}

/**
 * Detects media type from file extension
 * Returns 'image', 'video', or 'audio', defaults to 'image' if type cannot be determined
 */
function detectMediaType(mediaPath: string, explicitType?: 'image' | 'video' | 'audio'): 'image' | 'video' | 'audio' {
  if (explicitType) {
    return explicitType
  }

  const extension = mediaPath.split('.').pop()?.toLowerCase()
  
  const videoExtensions = ['mp4', 'webm', 'mov', 'avi', 'mkv']
  const audioExtensions = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']
  
  if (extension && videoExtensions.includes(extension)) {
    return 'video'
  }
  
  if (extension && audioExtensions.includes(extension)) {
    return 'audio'
  }
  
  // Default to image if extension is image type or unknown
  return 'image'
}

export function LipsyncShowcaseCard({
  className,
  tool_title,
  title,
  highlightedTitle,
  description,
  optional_description,
  steps = [],
  learnMoreLink = "#",
  icon,
}: LipsyncShowcaseCardProps) {
  const layoutModeContext = useLayoutMode()
  const isRowLayout = layoutModeContext?.layoutMode === "row"
  
  const content = (
    <>
      {/* Header with Badge */}
      {tool_title && (
        <div className="flex items-center justify-center shrink-0 lipsync-showcase-badge-container">
          <Badge variant="outline" className="text-xs md:text-sm font-semibold px-2 md:px-3 py-1 h-auto lipsync-showcase-badge">
            {icon || <Sparkle className="size-4 md:size-5" />}
            <span className="ml-1 md:ml-2 lipsync-showcase-badge-text">{tool_title}</span>
          </Badge>
        </div>
      )}

      {/* Main Title */}
      <div className="space-y-1.5 md:space-y-2 text-center shrink-0 lipsync-showcase-title-container max-w-4xl mx-auto">
        <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-balance leading-[1.1] lipsync-showcase-title">
          {title}{" "}
          <span className="text-primary lipsync-showcase-title-highlight">{highlightedTitle}</span>
        </h1>
        <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto px-4 text-balance lipsync-showcase-description">
          {description}
        </p>
        {optional_description && (
          <a
            href={learnMoreLink}
            className="text-sm md:text-base text-primary/80 hover:text-primary transition-colors inline-block font-medium lipsync-showcase-optional-link"
          >
            {optional_description}
          </a>
        )}
      </div>

      {/* Steps Section */}
      {steps.length > 0 && (
        <div className="flex flex-col shrink-0 space-y-3 md:space-y-4 mt-0 lipsync-showcase-steps-container"> 
          <div className={cn(
            "grid gap-4 md:gap-4 w-full lipsync-showcase-steps-grid",
            steps.length === 1 ? "grid-cols-1 max-w-5xl mx-auto" : 
            "grid-cols-3"
          )}>
            {steps.map((step, index) => {
                const stepNumber = index + 1
                const mediaType = detectMediaType(step.mediaPath, step.mediaType)
                const isSingleStep = steps.length === 1
                
                // Audio step component with playback controls
                const AudioStepContent = () => {
                  const [isPlaying, setIsPlaying] = React.useState(false)
                  const audioRef = React.useRef<HTMLAudioElement | null>(null)
                  
                  const handlePlayPause = () => {
                    if (!audioRef.current) return
                    
                    if (isPlaying) {
                      audioRef.current.pause()
                      setIsPlaying(false)
                    } else {
                      audioRef.current.play()
                      setIsPlaying(true)
                    }
                  }
                  
                  const handleAudioEnded = () => {
                    setIsPlaying(false)
                  }
                  
                  return (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50 relative">
                      <audio
                        ref={audioRef}
                        src={step.mediaPath}
                        onEnded={handleAudioEnded}
                        preload="metadata"
                      />
                      <div className="flex flex-col items-center gap-3 p-4">
                        <Waveform className="size-8 md:size-10 text-primary" weight="fill" />
                        <Button
                          onClick={handlePlayPause}
                          size="sm"
                          variant="outline"
                          className="gap-2"
                        >
                          {isPlaying ? (
                            <>
                              <Pause className="size-4" />
                              <span>Pause</span>
                            </>
                          ) : (
                            <>
                              <Play className="size-4" />
                              <span>Play</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )
                }
                
                // Video step component with mute/unmute toggle
                const VideoStepContent = ({ isSingle }: { isSingle: boolean }) => {
                  const [isMuted, setIsMuted] = React.useState(true)
                  const videoRef = React.useRef<HTMLVideoElement | null>(null)
                  
                  const handleToggleMute = () => {
                    if (!videoRef.current) return
                    videoRef.current.muted = !isMuted
                    setIsMuted(!isMuted)
                  }
                  
                  return (
                    <div className="relative w-full h-full flex items-center justify-center">
                      {isSingle ? (
                        <video
                          ref={videoRef}
                          src={step.mediaPath}
                          className="w-full h-auto block lipsync-showcase-step-video"
                          loop
                          muted={isMuted}
                          autoPlay
                          playsInline
                        />
                      ) : (
                        <video
                          ref={videoRef}
                          src={step.mediaPath}
                          className="max-w-full max-h-full object-contain block lipsync-showcase-step-video"
                          loop
                          muted={isMuted}
                          autoPlay
                          playsInline
                        />
                      )}
                      <Button
                        onClick={handleToggleMute}
                        size="sm"
                        variant="secondary"
                        className="absolute bottom-2 right-2 opacity-80 hover:opacity-100 transition-opacity z-10"
                        aria-label={isMuted ? "Unmute" : "Mute"}
                      >
                        {isMuted ? (
                          <SpeakerSlash className="size-4" />
                        ) : (
                          <SpeakerHigh className="size-4" />
                        )}
                      </Button>
                    </div>
                  )
                }
                
                return (
                  <div key={index} className="relative flex flex-col min-h-0 lipsync-showcase-step">
                    {/* Conditionally render Card wrapper only if more than one step */}
                    {isSingleStep ? (
                      <div className="flex flex-col h-full min-w-0 lipsync-showcase-step-single">
                        <div className="shrink-0 lipsync-showcase-step-media-container shadow-2xl rounded-2xl overflow-hidden border border-border/50 bg-black/5 dark:bg-white/5">
                          {mediaType === 'video' ? (
                            <div className="w-full lipsync-showcase-step-video-wrapper">
                              <VideoStepContent isSingle={true} />
                            </div>
                          ) : mediaType === 'audio' ? (
                            <div className="w-full h-32 lipsync-showcase-step-audio-wrapper">
                              <AudioStepContent />
                            </div>
                          ) : (
                            <div className="w-full lipsync-showcase-step-image-wrapper">
                              <img
                                src={step.mediaPath}
                                alt={step.title}
                                className="w-full h-auto block lipsync-showcase-step-image"
                              />
                            </div>
                          )}
                        </div>
                        {(step.title || step.description) && (
                          <div className="pt-3 md:pt-4 space-y-1 text-center shrink-0 lipsync-showcase-step-text">
                            {step.title && (
                              <h4 className="font-bold text-lg md:text-xl lg:text-2xl uppercase tracking-wider lipsync-showcase-step-title">
                                {step.title}
                              </h4>
                            )}
                            {step.description && (
                              <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto lipsync-showcase-step-description">
                                {step.description}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Card className="flex flex-col h-auto min-h-full relative lipsync-showcase-step-card border-border/50 transition-all hover:shadow-xl hover:border-primary/20 bg-card/50 backdrop-blur-sm py-0 overflow-visible">
                        {/* Step Number - Positioned at top-left of Card */}
                        <div className="absolute top-3 left-3 z-10 lipsync-showcase-step-number-container">
                          <div className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-lg border-2 border-background lipsync-showcase-step-number">
                            {stepNumber}
                          </div>
                        </div>
                        <CardContent className="p-0 flex flex-col min-h-full lipsync-showcase-step-card-content overflow-visible">
                          <div className="shrink-0 lipsync-showcase-step-media-wrapper overflow-hidden bg-black/5 dark:bg-white/5 aspect-video flex items-center justify-center rounded-t-2xl">
                            {mediaType === 'video' ? (
                              <VideoStepContent isSingle={false} />
                            ) : mediaType === 'audio' ? (
                              <AudioStepContent />
                            ) : (
                              <img
                                src={step.mediaPath}
                                alt={step.title}
                                className="max-w-full max-h-full object-contain block lipsync-showcase-step-image"
                              />
                            )}
                          </div>
                          <div className="p-2.5 md:p-3 pb-4 md:pb-5 space-y-1 text-center flex-1 flex flex-col justify-start lipsync-showcase-step-text">
                            <h4 className="font-bold text-sm md:text-base lg:text-lg uppercase tracking-widest lipsync-showcase-step-title">
                              {step.title}
                            </h4>
                            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed lipsync-showcase-step-description">
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
    </>
  )

  // Use Card wrapper only in column layout, plain div in row layout
  if (isRowLayout) {
    return (
      <div className={cn("w-full min-h-full flex flex-col lipsync-showcase-card overflow-visible", className)}>
        <div className="flex flex-col gap-4 p-4 md:p-4 pb-4 justify-start lipsync-showcase-content overflow-visible">
          {content}
        </div>
      </div>
    )
  }

  return (
    <Card className={cn("w-full min-h-full flex flex-col lipsync-showcase-card border-none shadow-none bg-transparent py-0 overflow-visible", className)}>
      <CardContent className="flex flex-col gap-4 p-4 md:p-4 pb-4 justify-start lipsync-showcase-content overflow-visible">
        {content}
      </CardContent>
    </Card>
  )
}
