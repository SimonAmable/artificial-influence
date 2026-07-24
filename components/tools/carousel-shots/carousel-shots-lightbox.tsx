"use client"

import * as React from "react"
import { ArrowLeft, ArrowRight, CircleNotch } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { UpscaleCreditCost } from "@/components/tools/carousel-shots/upscale-credit-cost"
import type { CarouselShotRecord } from "@/lib/carousel-shots/types"
import { cn } from "@/lib/utils"

type CarouselShotsLightboxProps = {
  activeIndex: number | null
  aspectRatioClass: string
  isUpscaling: boolean
  onClose: () => void
  onDownload: (shot: CarouselShotRecord) => void
  onNavigate: (index: number) => void
  onUpscale: (shot: CarouselShotRecord) => void
  onUpscaleAndDownload: (shot: CarouselShotRecord) => void
  shots: CarouselShotRecord[]
  upscaleCreditCost: number
}

export function CarouselShotsLightbox({
  activeIndex,
  aspectRatioClass,
  isUpscaling,
  onClose,
  onDownload,
  onNavigate,
  onUpscale,
  onUpscaleAndDownload,
  shots,
  upscaleCreditCost,
}: CarouselShotsLightboxProps) {
  const shot = activeIndex == null ? null : shots[activeIndex] ?? null
  const open = shot != null
  const touchStartXRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (!open || activeIndex == null) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        onNavigate(Math.max(0, activeIndex - 1))
        return
      }
      if (event.key === "ArrowRight") {
        event.preventDefault()
        onNavigate(Math.min(shots.length - 1, activeIndex + 1))
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [activeIndex, onNavigate, open, shots.length])

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.changedTouches[0]?.clientX ?? null
  }

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (activeIndex == null || touchStartXRef.current == null) return
    const endX = event.changedTouches[0]?.clientX
    if (endX == null) return

    const deltaX = endX - touchStartXRef.current
    touchStartXRef.current = null
    if (Math.abs(deltaX) < 40) return

    if (deltaX > 0) {
      onNavigate(Math.max(0, activeIndex - 1))
    } else {
      onNavigate(Math.min(shots.length - 1, activeIndex + 1))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="w-[min(100%,34rem)] gap-4 sm:max-w-xl">
        {shot ? (
          <>
            <div className="relative flex items-center justify-center px-12">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="absolute left-0 top-1/2 size-9 -translate-y-1/2 rounded-full"
                disabled={activeIndex === 0}
                onClick={() => onNavigate(Math.max(0, (activeIndex ?? 0) - 1))}
                aria-label="Previous shot"
              >
                <ArrowLeft className="size-4" />
              </Button>
              <DialogTitle className="text-center text-lg font-medium">
                Shot {shot.index + 1} of {shots.length}
              </DialogTitle>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="absolute right-0 top-1/2 size-9 -translate-y-1/2 rounded-full"
                disabled={activeIndex === shots.length - 1}
                onClick={() =>
                  onNavigate(Math.min(shots.length - 1, (activeIndex ?? 0) + 1))
                }
                aria-label="Next shot"
              >
                <ArrowRight className="size-4" />
              </Button>
            </div>

            <div
              className={cn(
                "relative mx-auto w-full overflow-hidden rounded-xl border bg-muted/20 touch-pan-y",
                aspectRatioClass,
              )}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.upscaledUrl ?? shot.url}
                alt={`Carousel shot ${shot.index + 1}`}
                className="h-full w-full object-contain"
                draggable={false}
              />
              {isUpscaling ? (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                  <CircleNotch className="size-8 animate-spin text-primary" />
                </div>
              ) : null}
            </div>

            <DialogFooter className="flex flex-row flex-wrap items-center justify-center gap-2 sm:justify-center">
              <Button type="button" variant="outline" onClick={() => onDownload(shot)}>
                Download
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                onClick={() => onUpscale(shot)}
              >
                Upscale
                <UpscaleCreditCost cost={upscaleCreditCost} />
              </Button>
              <Button
                type="button"
                className="gap-1.5"
                onClick={() => onUpscaleAndDownload(shot)}
              >
                Upscale & Download
                <UpscaleCreditCost cost={shot.upscaledUrl ? 0 : upscaleCreditCost} />
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
