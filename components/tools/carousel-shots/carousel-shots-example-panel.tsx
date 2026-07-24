"use client"

import { useLayoutEffect, useRef } from "react"
import { gsap } from "gsap"

import { CAROUSEL_SHOTS_EXAMPLE } from "@/lib/carousel-shots/constants"

const EXPAND_DURATION = 0.55
const HOLD_DURATION = 0.7
const COLLAPSE_DURATION = 0.55
const GAP_DURATION = 0.2

interface SlotTransform {
  x: number
  y: number
  scale: number
}

function getSlotTransforms(imageCount: number, container: HTMLElement): SlotTransform[] {
  const { width, height } = container.getBoundingClientRect()
  const columns = 2
  const cellWidth = width / columns
  const cellHeight = height / Math.ceil(imageCount / columns)
  const containerCenterX = width / 2
  const containerCenterY = height / 2
  const coverScale = Math.max(width / cellWidth, height / cellHeight)

  return Array.from({ length: imageCount }, (_, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const slotCenterX = column * cellWidth + cellWidth / 2
    const slotCenterY = row * cellHeight + cellHeight / 2

    return {
      x: containerCenterX - slotCenterX,
      y: containerCenterY - slotCenterY,
      scale: coverScale,
    }
  })
}

function resetImageTransforms(images: HTMLImageElement[]) {
  gsap.set(images, {
    x: 0,
    y: 0,
    scale: 1,
    zIndex: 1,
    transformOrigin: "center center",
  })
}

function buildSpotlightTimeline(images: HTMLImageElement[], container: HTMLElement) {
  const expandedTransforms = getSlotTransforms(images.length, container)
  resetImageTransforms(images)

  const timeline = gsap.timeline({
    repeat: -1,
    onRepeat: () => {
      resetImageTransforms(images)
    },
  })

  images.forEach((img, index) => {
    const expanded = expandedTransforms[index]

    timeline.to(img, {
      x: expanded.x,
      y: expanded.y,
      scale: expanded.scale,
      zIndex: 10,
      duration: EXPAND_DURATION,
      ease: "power2.inOut",
    })

    timeline.to({}, { duration: HOLD_DURATION })

    timeline.to(img, {
      x: 0,
      y: 0,
      scale: 1,
      zIndex: 1,
      duration: COLLAPSE_DURATION,
      ease: "power2.inOut",
    })

    if (index < images.length - 1) {
      timeline.to({}, { duration: GAP_DURATION })
    }
  })

  return timeline
}

export function CarouselShotsExamplePanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRefs = useRef<Array<HTMLImageElement | null>>([])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const images = imageRefs.current.filter((img): img is HTMLImageElement => img !== null)
    if (images.length === 0) return

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReducedMotion) return

    const ctx = gsap.context(() => {
      let timeline = buildSpotlightTimeline(images, container)

      const resizeObserver = new ResizeObserver(() => {
        timeline.kill()
        resetImageTransforms(images)
        timeline = buildSpotlightTimeline(images, container)
      })
      resizeObserver.observe(container)

      return () => {
        resizeObserver.disconnect()
        timeline.kill()
        resetImageTransforms(images)
      }
    }, container)

    return () => ctx.revert()
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-dashed border-muted-foreground/40 bg-muted/10 p-4 sm:p-6">
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-4">
        <div
          ref={containerRef}
          className="relative grid h-full max-h-full w-full max-w-md grid-cols-2 grid-rows-2 gap-0 overflow-hidden"
        >
          {CAROUSEL_SHOTS_EXAMPLE.slideUrls.map((src, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              ref={(element) => {
                imageRefs.current[index] = element
              }}
              src={src}
              alt={`Carousel shots example slide ${index + 1}`}
              className="relative z-1 block h-full w-full object-cover will-change-transform"
            />
          ))}
        </div>
      </div>

      <div className="mt-4 shrink-0 space-y-1.5 text-center">
        <h2 className="text-lg font-semibold tracking-tight">{CAROUSEL_SHOTS_EXAMPLE.title}</h2>
        <p className="text-sm text-muted-foreground">{CAROUSEL_SHOTS_EXAMPLE.description}</p>
      </div>
    </div>
  )
}
