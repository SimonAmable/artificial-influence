"use client"

import * as React from "react"
import {
  ArrowsOutSimple,
  CaretLeft,
  CaretRight,
  DownloadSimple,
  PencilSimple,
  SquaresFour,
  Trash,
  X,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { SlidePreviewFrame } from "@/components/slideshows/slide-preview-frame"
import type { SlideshowAspectRatio, SlideshowProject } from "@/lib/slideshows/types"
import { cn } from "@/lib/utils"

type ViewerSlide = {
  id: string
  imageUrl: string | null
  slide?: SlideshowProject["slides"][number]
}

function buildViewerSlides(project: SlideshowProject): ViewerSlide[] {
  const ordered = [...project.slides].sort((a, b) => a.index - b.index)
  const rendered = project.renderedSlideUrls
  const hasRendered = rendered.length > 0

  return ordered.map((slide, index) => ({
    id: slide.id,
    imageUrl: hasRendered ? rendered[index] ?? slide.finalImageUrl ?? slide.sourceImageUrl : slide.finalImageUrl ?? slide.sourceImageUrl,
    slide,
  }))
}

export function SlideshowFullscreenViewer({
  project,
  open,
  onOpenChange,
  initialIndex = 0,
  onEdit,
  onRender,
  onDelete,
}: {
  project: SlideshowProject | null
  open: boolean
  onOpenChange: (open: boolean) => void
  initialIndex?: number
  onEdit?: () => void
  onRender?: () => void
  onDelete?: () => void
}) {
  const [index, setIndex] = React.useState(initialIndex)
  const slides = React.useMemo(
    () => (project ? buildViewerSlides(project) : []),
    [project],
  )
  const hasRendered = (project?.renderedSlideUrls.length ?? 0) > 0
  const current = slides[index]

  React.useEffect(() => {
    if (open) setIndex(initialIndex)
  }, [initialIndex, open, project?.id])

  if (!project) return null

  const resolvedProject = project

  function downloadCurrent() {
    const url = current?.imageUrl
    if (!url) return
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${resolvedProject.name}-slide-${index + 1}.png`
    anchor.click()
  }

  function downloadAll() {
    slides.forEach((slide, slideIndex) => {
      if (!slide.imageUrl) return
      const anchor = document.createElement("a")
      anchor.href = slide.imageUrl
      anchor.download = `${resolvedProject.name}-slide-${slideIndex + 1}.png`
      anchor.click()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92vh,900px)] max-w-5xl gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <div className="relative flex min-w-0 flex-1 flex-col bg-muted/30">
          <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
            {current?.slide ? (
              <SlidePreviewFrame
                slide={{
                  ...current.slide,
                  finalImageUrl: current.imageUrl,
                  sourceImageUrl: current.imageUrl,
                }}
                aspectRatio={resolvedProject.aspectRatio}
                className="max-h-full w-auto max-w-[min(100%,320px)]"
                burnedPreview={hasRendered}
                showPreBurnText={!hasRendered}
                previewWidth={320}
              />
            ) : (
              <div className="text-sm text-muted-foreground">No preview available</div>
            )}
          </div>

          <div className="flex items-center justify-center gap-4 border-t bg-card/80 px-4 py-4">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={index <= 0}
              onClick={() => setIndex((value) => Math.max(0, value - 1))}
            >
              <CaretLeft className="h-4 w-4" />
            </Button>
            <div className="flex gap-2">
              {slides.map((slide, slideIndex) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={`Slide ${slideIndex + 1}`}
                  className={cn(
                    "h-2 w-2 rounded-full transition-colors",
                    slideIndex === index ? "bg-primary" : "bg-muted-foreground/30 hover:bg-muted-foreground/50",
                  )}
                  onClick={() => setIndex(slideIndex)}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={index >= slides.length - 1}
              onClick={() => setIndex((value) => Math.min(slides.length - 1, value + 1))}
            >
              <CaretRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <aside className="flex w-[min(100%,280px)] shrink-0 flex-col border-l bg-card p-5">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Preview</p>
            <h2 className="mt-1 line-clamp-2 text-lg font-semibold">{resolvedProject.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Slide {index + 1} of {slides.length}
              {hasRendered ? " · Rendered" : " · Draft preview"}
            </p>
          </div>

          <div className="flex flex-1 flex-col gap-1">
            <Button
              type="button"
              variant="ghost"
              className="justify-start gap-3"
              disabled={!current?.imageUrl}
              onClick={downloadCurrent}
            >
              <DownloadSimple className="h-4 w-4" />
              Download slide
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="justify-start gap-3"
              disabled={!hasRendered && !slides.some((slide) => slide.imageUrl)}
              onClick={downloadAll}
            >
              <DownloadSimple className="h-4 w-4" />
              Download all images
            </Button>
            {onEdit ? (
              <Button type="button" variant="ghost" className="justify-start gap-3" onClick={onEdit}>
                <PencilSimple className="h-4 w-4" />
                Edit slideshow
              </Button>
            ) : null}
            {onRender && !hasRendered ? (
              <Button type="button" variant="ghost" className="justify-start gap-3" onClick={onRender}>
                <SquaresFour className="h-4 w-4" />
                Render images
              </Button>
            ) : null}
            {onDelete ? (
              <Button
                type="button"
                variant="ghost"
                className="justify-start gap-3 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash className="h-4 w-4" />
                Delete project
              </Button>
            ) : null}
          </div>

          <Button type="button" variant="outline" className="mt-6" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
        </aside>
      </DialogContent>
    </Dialog>
  )
}

export function ExpandViewButton({
  onClick,
  className,
}: {
  onClick: () => void
  className?: string
}) {
  return (
    <Button type="button" variant="outline" size="sm" className={className} onClick={onClick}>
      <ArrowsOutSimple className="mr-2 h-4 w-4" />
      Expand view
    </Button>
  )
}
