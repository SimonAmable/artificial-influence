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

type CarouselShotsLightboxProps = {
  activeIndex: number | null
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
      <DialogContent className="flex w-[min(100%,34rem)] max-h-[min(92dvh,820px)] flex-col gap-4 overflow-hidden sm:max-w-xl">
        {shot ? (
          <>
            <div className="relative flex items-center justify-center px-12">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="absolute left-0 top-1/2 size-9 -translate-y-1/2 rounded-full active:-translate-y-1/2"
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
                className="absolute right-0 top-1/2 size-9 -translate-y-1/2 rounded-full active:-translate-y-1/2"
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
              className="flex min-h-0 flex-1 items-center justify-center overflow-hidden"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <div className="relative inline-flex max-h-[min(58dvh,520px)] max-w-full overflow-hidden rounded-xl border bg-muted/20 touch-pan-y">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shot.upscaledUrl ?? shot.url}
                  alt={`Carousel shot ${shot.index + 1}`}
                  className="block max-h-[min(58dvh,520px)] w-auto max-w-full object-contain"
                  draggable={false}
                />
                {isUpscaling ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                    <CircleNotch className="size-8 animate-spin text-primary" />
                  </div>
                ) : null}
              </div>
            </div>

            <DialogFooter className="flex flex-row flex-wrap items-center justify-center gap-2 sm:justify-center">
              <Button
                type="button"
                variant="outline"
                className="active:translate-y-0"
                onClick={() => onDownload(shot)}
              >
                Download
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 active:translate-y-0"
                onClick={() => onUpscale(shot)}
              >
                Upscale
                <UpscaleCreditCost cost={upscaleCreditCost} />
              </Button>
              <Button
                type="button"
                className="gap-1.5 active:translate-y-0"
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
