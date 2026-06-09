"use client"

import * as React from "react"
import { CircleNotch, Image as ImageIcon } from "@phosphor-icons/react"
import { overlayPreviewTypography } from "@/lib/slideshows/overlay-text-style"
import type { ResolvedSlideshowSlide, SlideshowAspectRatio, SlideshowOverlay } from "@/lib/slideshows/types"
import { slideUsesOverlayText } from "@/lib/slideshows/text-treatment"
import { cn } from "@/lib/utils"

function aspectClass(ratio: SlideshowAspectRatio) {
  if (ratio === "4:5") return "aspect-[4/5]"
  if (ratio === "1:1") return "aspect-square"
  return "aspect-[9/16]"
}

function overlayPositionClass(position: SlideshowOverlay["position"]) {
  if (position === "top") return "top-[12%]"
  if (position === "bottom") return "bottom-[12%]"
  return "top-1/2 -translate-y-1/2"
}


export function SlidePreviewFrame({
  slide,
  aspectRatio,
  className,
  imageClassName,
  showPreBurnText = true,
  burnedPreview = false,
  previewWidth = 280,
}: {
  slide: ResolvedSlideshowSlide
  aspectRatio: SlideshowAspectRatio
  className?: string
  imageClassName?: string
  showPreBurnText?: boolean
  burnedPreview?: boolean
  previewWidth?: number
}) {
  const imageUrl = slide.finalImageUrl || slide.sourceImageUrl
  const usesOverlays = slideUsesOverlayText(slide)
  const overlayTexts = usesOverlays
    ? slide.overlays.filter((overlay) => overlay.resolvedText.trim().length > 0)
    : []

  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-muted shadow-md", aspectClass(aspectRatio), className)}>
      {imageUrl ? (
        <img src={imageUrl} alt="" className={cn("h-full w-full object-cover", imageClassName)} />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          {slide.status === "resolving" ? (
            <CircleNotch className="h-6 w-6 animate-spin" />
          ) : (
            <ImageIcon className="h-6 w-6" weight="duotone" />
          )}
          <span>{slide.status}</span>
        </div>
      )}

      {showPreBurnText && !burnedPreview && overlayTexts.length > 0 ? (
        <div className="pointer-events-none absolute inset-0">
          {overlayTexts.map((overlay) => {
            const typography = overlayPreviewTypography(overlay.style, { previewWidth })
            return (
              <div
                key={overlay.id}
                className={cn(
                  "absolute inset-x-0 flex justify-center px-4",
                  overlayPositionClass(overlay.position),
                )}
              >
                <p className={typography.className} style={typography.style}>
                  {overlay.resolvedText}
                </p>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function projectPreviewImage(
  project: { slides: ResolvedSlideshowSlide[]; renderedSlideUrls: string[] },
) {
  if (project.renderedSlideUrls[0]) return project.renderedSlideUrls[0]
  const first = [...project.slides].sort((a, b) => a.index - b.index)[0]
  return first?.finalImageUrl || first?.sourceImageUrl || null
}

export function ProjectPreviewFrame({
  project,
  className,
  previewWidth = 320,
}: {
  project: {
    slides: ResolvedSlideshowSlide[]
    renderedSlideUrls: string[]
    aspectRatio: SlideshowAspectRatio
  }
  className?: string
  previewWidth?: number
}) {
  const firstSlide = [...project.slides].sort((a, b) => a.index - b.index)[0]
  if (!firstSlide) return null

  const hasRendered = project.renderedSlideUrls.length > 0
  const previewUrl = hasRendered
    ? project.renderedSlideUrls[0] ?? firstSlide.finalImageUrl ?? firstSlide.sourceImageUrl
    : firstSlide.finalImageUrl ?? firstSlide.sourceImageUrl

  return (
    <SlidePreviewFrame
      slide={{
        ...firstSlide,
        finalImageUrl: previewUrl,
        sourceImageUrl: previewUrl ?? firstSlide.sourceImageUrl,
      }}
      aspectRatio={project.aspectRatio}
      className={className}
      burnedPreview={hasRendered}
      showPreBurnText={!hasRendered}
      previewWidth={previewWidth}
    />
  )
}
