"use client"

import * as React from "react"
import {
  ArrowLeft,
  ArrowsClockwise,
  Check,
  CircleNotch,
  Copy,
  Image as ImageIcon,
  Lock,
  SquaresFour,
  TextT,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  ExpandViewButton,
  SlideshowFullscreenViewer,
} from "@/components/slideshows/slideshow-fullscreen-viewer"
import { SlideImageControls } from "@/components/slideshows/slide-image-controls"
import { OverlayTextField } from "@/components/slideshows/overlay-text-field"
import { SlidePreviewFrame } from "@/components/slideshows/slide-preview-frame"
import type { SlideshowCollection } from "@/lib/slideshow/types"
import type { ResolvedSlideshowSlide, SlideshowProject } from "@/lib/slideshows/types"
import { slideUsesOverlayText } from "@/lib/slideshows/text-treatment"
import { cn } from "@/lib/utils"

function visualLabel(slide: ResolvedSlideshowSlide) {
  if (slide.visual.source === "collection" && slide.visual.aiEditPrompt) return "Collection → AI Edit"
  if (slide.visual.source === "collection") return "Collection"
  if (slide.visual.source === "generate") return "AI Generated"
  if (slide.visual.source === "reuse") return "Reused visual"
  return "Manual visual"
}

function statusVariant(status: SlideshowProject["status"]) {
  return status === "rendered" || status === "ready" ? "default" : status === "failed" ? "destructive" : "secondary"
}

const CAROUSEL_SLOT_WIDTH = 280
const CAROUSEL_SLOT_GAP = 16
const CAROUSEL_SWIPE_THRESHOLD = 48

function carouselTrackOffset(selectedIndex: number) {
  const slotStride = CAROUSEL_SLOT_WIDTH + CAROUSEL_SLOT_GAP
  const selectedCenter = selectedIndex * slotStride + CAROUSEL_SLOT_WIDTH / 2
  return `translateX(calc(50% - ${selectedCenter}px))`
}

function carouselSlideScale(index: number, selectedIndex: number, zoom: number) {
  const distance = Math.abs(index - selectedIndex)
  if (distance === 0) return zoom
  return Math.max(0.58, 0.76 - distance * 0.09)
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || "Request failed.")
  return body as T
}

export function ProjectEditor({
  project,
  onBack,
  onChange,
  onRunAgain,
}: {
  project: SlideshowProject
  onBack: () => void
  onChange: (project: SlideshowProject) => void
  onRunAgain: () => void
}) {
  const [slides, setSlides] = React.useState(project.slides)
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [zoom, setZoom] = React.useState(1)
  const [busy, setBusy] = React.useState<"save" | "resolve" | "render" | null>(null)
  const [textSheetOpen, setTextSheetOpen] = React.useState(false)
  const [imageSheetOpen, setImageSheetOpen] = React.useState(false)
  const [fullscreenOpen, setFullscreenOpen] = React.useState(false)
  const [collections, setCollections] = React.useState<SlideshowCollection[]>([])

  const orderedSlides = React.useMemo(
    () => [...slides].sort((a, b) => a.index - b.index),
    [slides],
  )
  const selectedSlide = orderedSlides[selectedIndex] ?? null
  const carouselViewportRef = React.useRef<HTMLDivElement>(null)
  const pointerDragRef = React.useRef<{ startX: number; startY: number; pointerId: number } | null>(null)
  const suppressSlideClickRef = React.useRef(false)
  const wheelCooldownRef = React.useRef(false)

  const goToSlide = React.useCallback((index: number) => {
    setSelectedIndex((current) => {
      const next = Math.max(0, Math.min(orderedSlides.length - 1, index))
      return next === current ? current : next
    })
  }, [orderedSlides.length])

  React.useEffect(() => setSlides(project.slides), [project])

  const hasResolvingSlides = React.useMemo(
    () => slides.some((slide) => slide.status === "resolving"),
    [slides],
  )
  const onChangeRef = React.useRef(onChange)
  React.useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  React.useEffect(() => {
    if (!hasResolvingSlides || busy !== null) return

    let cancelled = false
    const pollResolve = async () => {
      try {
        const { project: updated } = await readJson<{ project: SlideshowProject }>(
          await fetch(`/api/slideshows/projects/${project.id}/resolve`, { method: "POST" }),
        )
        if (cancelled) return
        setSlides(updated.slides)
        onChangeRef.current(updated)
      } catch {
        // Keep polling — transient errors are expected while jobs are still running.
      }
    }

    void pollResolve()
    const intervalId = window.setInterval(() => {
      void pollResolve()
    }, 4000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [busy, hasResolvingSlides, project.id])

  React.useEffect(() => {
    if (!imageSheetOpen || collections.length > 0) return
    fetch("/api/slideshows/collections", { cache: "no-store" })
      .then((response) => readJson<{ collections: SlideshowCollection[] }>(response))
      .then((data) => setCollections(data.collections))
      .catch(() => toast.error("Failed to load image packs."))
  }, [collections.length, imageSheetOpen])

  React.useEffect(() => {
    if (selectedIndex < orderedSlides.length) return
    setSelectedIndex(Math.max(0, orderedSlides.length - 1))
  }, [orderedSlides.length, selectedIndex])

  React.useEffect(() => {
    const viewport = carouselViewportRef.current
    if (!viewport) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        goToSlide(selectedIndex - 1)
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        goToSlide(selectedIndex + 1)
      }
    }

    function onWheel(event: WheelEvent) {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
      if (Math.abs(event.deltaX) < 12 || wheelCooldownRef.current) return

      event.preventDefault()
      wheelCooldownRef.current = true
      if (event.deltaX > 0) goToSlide(selectedIndex + 1)
      else goToSlide(selectedIndex - 1)

      window.setTimeout(() => {
        wheelCooldownRef.current = false
      }, 280)
    }

    viewport.addEventListener("keydown", onKeyDown)
    viewport.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      viewport.removeEventListener("keydown", onKeyDown)
      viewport.removeEventListener("wheel", onWheel)
    }
  }, [goToSlide, selectedIndex])

  function onCarouselPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest("button, a, input, textarea, select, [role='button']")) return
    pointerDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      pointerId: event.pointerId,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onCarouselPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = pointerDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    pointerDragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    if (Math.abs(deltaX) < CAROUSEL_SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY)) return

    suppressSlideClickRef.current = true
    window.setTimeout(() => {
      suppressSlideClickRef.current = false
    }, 0)

    if (deltaX < 0) goToSlide(selectedIndex + 1)
    else goToSlide(selectedIndex - 1)
  }

  function updateSlide(index: number, update: (slide: ResolvedSlideshowSlide) => ResolvedSlideshowSlide) {
    setSlides((current) => current.map((slide) => slide.index === index ? update(slide) : slide))
  }

  function regenerateSlide(index: number) {
    updateSlide(index, (current) => ({
      ...current,
      sourceImageUrl: null,
      sourceCollectionImageId: null,
      generationId: null,
      finalImageUrl: null,
      status: "pending",
      errorMessage: null,
    }))
    toast.message("Slide queued for regeneration. Resolve pending when ready.")
  }

  async function save() {
    setBusy("save")
    try {
      const { project: updated } = await readJson<{ project: SlideshowProject }>(
        await fetch(`/api/slideshows/projects/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slides }),
        }),
      )
      onChange(updated)
      toast.success("Slideshow saved.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save slideshow.")
    } finally {
      setBusy(null)
    }
  }

  async function action(name: "resolve" | "render") {
    setBusy(name)
    try {
      if (slides !== project.slides) await save()
      const { project: updated } = await readJson<{ project: SlideshowProject }>(
        await fetch(`/api/slideshows/projects/${project.id}/${name}`, { method: "POST" }),
      )
      onChange(updated)
      toast.success(name === "resolve" ? "Slideshow resolution refreshed." : "Final slide images rendered.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${name} slideshow.`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] px-5 pb-10 pt-20">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{project.name}</h1>
              <Badge variant={statusVariant(project.status)}>{project.status}</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{project.brief}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy !== null} onClick={onRunAgain}>
            <Copy className="mr-2 h-4 w-4" />
            Run again
          </Button>
          <Button variant="outline" disabled={busy !== null} onClick={() => void save()}>
            {busy === "save" ? <CircleNotch className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Save
          </Button>
          <Button variant="outline" disabled={busy !== null} onClick={() => void action("resolve")}>
            {busy === "resolve" ? <CircleNotch className="mr-2 h-4 w-4 animate-spin" /> : <ArrowsClockwise className="mr-2 h-4 w-4" />}
            Resolve pending
          </Button>
          <Button
            disabled={busy !== null || !slides.every((slide) => slide.status === "ready")}
            onClick={() => void action("render")}
          >
            {busy === "render" ? <CircleNotch className="mr-2 h-4 w-4 animate-spin" /> : <SquaresFour className="mr-2 h-4 w-4" />}
            Render images
          </Button>
        </div>
      </div>

      {project.errorMessage ? (
        <p className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {project.errorMessage}
        </p>
      ) : null}

      <div className="rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-[180px] space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>1x</span>
              <span>{zoom.toFixed(1)}x</span>
              <span>2x</span>
            </div>
            <Slider
              min={1}
              max={2}
              step={0.1}
              value={[zoom]}
              onValueChange={(value) => setZoom(value[0] ?? 1)}
            />
          </div>
          <p className="text-sm font-medium">Preview editor</p>
          <ExpandViewButton onClick={() => setFullscreenOpen(true)} />
        </div>

        <div
          ref={carouselViewportRef}
          tabIndex={0}
          role="region"
          aria-roledescription="carousel"
          aria-label="Slide preview carousel"
          className="relative cursor-grab overflow-hidden px-4 py-10 outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-8 touch-pan-y select-none"
          onPointerDown={onCarouselPointerDown}
          onPointerUp={onCarouselPointerUp}
          onPointerCancel={onCarouselPointerUp}
        >
          <div
            className="flex items-center transition-transform duration-300 ease-out will-change-transform"
            style={{
              gap: CAROUSEL_SLOT_GAP,
              transform: carouselTrackOffset(selectedIndex),
            }}
          >
            {orderedSlides.map((slide, index) => {
              const isActive = index === selectedIndex
              const distance = Math.abs(index - selectedIndex)
              const scale = carouselSlideScale(index, selectedIndex, zoom)

              return (
                <div
                  key={slide.id}
                  className={cn("shrink-0", isActive ? "z-10" : "z-0")}
                  style={{ width: CAROUSEL_SLOT_WIDTH }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (suppressSlideClickRef.current) return
                      setSelectedIndex(index)
                    }}
                    className={cn(
                      "mx-auto block w-full transition-[transform,opacity] duration-300 ease-out",
                      !isActive && "hover:opacity-90",
                    )}
                    style={{
                      transform: `scale(${scale})`,
                      transformOrigin: "center center",
                      opacity: isActive ? 1 : Math.max(0.42, 0.72 - distance * 0.14),
                    }}
                  >
                    <SlidePreviewFrame
                      slide={slide}
                      aspectRatio={project.aspectRatio}
                      className="w-full shadow-lg"
                      showPreBurnText={isActive}
                    />
                  </button>
                </div>
              )
            })}
          </div>

          {selectedSlide ? (
            <div className="mx-auto mt-5 flex w-fit flex-wrap items-center justify-center gap-2 rounded-full border bg-background/95 px-3 py-2 shadow-sm">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => setImageSheetOpen(true)}
                title="Image controls"
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => setTextSheetOpen(true)}
                title="Text & overlays"
              >
                <TextT className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => regenerateSlide(selectedSlide.index)}
                title="Regenerate visual"
              >
                <ArrowsClockwise className="h-4 w-4" />
              </Button>
              <Badge variant="secondary" className="rounded-full px-3">
                {project.aspectRatio}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3">
                {visualLabel(selectedSlide)}
              </Badge>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-center gap-2 border-t px-4 py-4">
          {orderedSlides.map((slide, index) => {
            const thumb = slide.finalImageUrl || slide.sourceImageUrl
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className={cn(
                  "h-14 w-10 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                  index === selectedIndex ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
                )}
              >
                {thumb ? (
                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-muted text-[10px] text-muted-foreground">
                    {index + 1}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <Sheet open={textSheetOpen} onOpenChange={setTextSheetOpen}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle className="text-base tracking-wide uppercase">Text & overlays</SheetTitle>
            <SheetDescription className="text-xs leading-relaxed">
              Overlay slides accept caption copy here. Image-only slides keep text in the visual prompt.
            </SheetDescription>
          </SheetHeader>
          {selectedSlide ? (
            <div className="space-y-6 px-6 py-5">
              {slideUsesOverlayText(selectedSlide) ? (
              <section className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-medium">{selectedSlide.role}</Label>
                  {selectedSlide.content.locked ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : null}
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  This slide uses overlay captions. Edit overlay text below.
                </p>
              </section>
              ) : (
              <section className="space-y-2.5">
                <Label className="text-sm font-medium">Image-only slide</Label>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Text overlays are off for this slide. Put any in-image copy in the visual prompt.
                </p>
              </section>
              )}

              {slideUsesOverlayText(selectedSlide) && selectedSlide.overlays.length > 0 ? (
                <section className="space-y-5 border-t pt-5">
                  {selectedSlide.overlays.map((overlay, index) => (
                    <OverlayTextField
                      key={overlay.id}
                      overlay={overlay}
                      className={index > 0 ? "border-t pt-5" : undefined}
                      onStyleChange={(style) => updateSlide(selectedSlide.index, (current) => ({
                        ...current,
                        overlays: current.overlays.map((candidate) => candidate.id === overlay.id
                          ? { ...candidate, style }
                          : candidate),
                      }))}
                      onTextChange={(resolvedText) => updateSlide(selectedSlide.index, (current) => ({
                        ...current,
                        overlays: current.overlays.map((candidate) => candidate.id === overlay.id
                          ? { ...candidate, resolvedText }
                          : candidate),
                      }))}
                    />
                  ))}
                </section>
              ) : null}

              {(selectedSlide.visual.source === "generate" || selectedSlide.visual.aiEditPrompt) ? (
                <section className="space-y-2 border-t pt-5">
                  <Label className="text-sm font-medium">Visual prompt</Label>
                  <Textarea
                    rows={4}
                    value={selectedSlide.visual.prompt || selectedSlide.visual.aiEditPrompt || ""}
                    readOnly
                    className="resize-none bg-muted/40 text-muted-foreground"
                  />
                </section>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={imageSheetOpen} onOpenChange={setImageSheetOpen}>
        <SheetContent className="w-full overflow-y-auto px-3 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Image controls</SheetTitle>
            <SheetDescription>
              Change source type, pick from a pack, or regenerate slide {selectedIndex + 1}.
            </SheetDescription>
          </SheetHeader>
          {selectedSlide ? (
            <div className="mt-6">
              <SlideImageControls
                slide={selectedSlide}
                slideIndex={selectedIndex}
                allSlides={orderedSlides}
                collections={collections}
                busy={busy !== null}
                onResolve={() => void action("resolve")}
                onSlideChange={(next) => updateSlide(selectedSlide.index, () => next)}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <SlideshowFullscreenViewer
        project={{ ...project, slides }}
        open={fullscreenOpen}
        onOpenChange={setFullscreenOpen}
        initialIndex={selectedIndex}
        onRender={() => void action("render")}
      />
    </div>
  )
}
