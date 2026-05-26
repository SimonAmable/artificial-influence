"use client"

import * as React from "react"
import { CaretLeft, CaretRight } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

export interface ImageCompareSliderProps {
  beforeSrc: string
  afterSrc: string
  className?: string
  initialPosition?: number
  beforeLabel?: string
  afterLabel?: string
  /** How images fill the compare frame. Use contain to preserve aspect ratio. */
  objectFit?: "cover" | "contain"
}

export function ImageCompareSlider({
  beforeSrc,
  afterSrc,
  className,
  initialPosition = 50,
  beforeLabel = "Before",
  afterLabel = "After",
  objectFit = "cover",
}: ImageCompareSliderProps) {
  const objectFitClass = objectFit === "contain" ? "object-contain" : "object-cover"
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [position, setPosition] = React.useState(initialPosition)
  const isDragging = React.useRef(false)

  const clampPosition = React.useCallback((value: number) => {
    return Math.min(100, Math.max(0, value))
  }, [])

  const updateFromClientX = React.useCallback(
    (clientX: number) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      if (rect.width <= 0) return
      const next = ((clientX - rect.left) / rect.width) * 100
      setPosition(clampPosition(next))
    },
    [clampPosition],
  )

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      isDragging.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
      updateFromClientX(event.clientX)
    },
    [updateFromClientX],
  )

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current) return
      updateFromClientX(event.clientX)
    },
    [updateFromClientX],
  )

  const handlePointerUp = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        setPosition((prev) => clampPosition(prev - 2))
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        setPosition((prev) => clampPosition(prev + 2))
      } else if (event.key === "Home") {
        event.preventDefault()
        setPosition(0)
      } else if (event.key === "End") {
        event.preventDefault()
        setPosition(100)
      }
    },
    [clampPosition],
  )

  return (
    <div
      ref={containerRef}
      className={cn("relative h-full min-h-0 w-full select-none overflow-hidden rounded-2xl", className)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="slider"
      tabIndex={0}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(position)}
      aria-label="Compare before and after images"
      onKeyDown={handleKeyDown}
    >
      <img
        src={beforeSrc}
        alt={beforeLabel}
        className={cn("block h-full w-full", objectFitClass)}
        draggable={false}
      />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <img
          src={afterSrc}
          alt={afterLabel}
          className={cn("block h-full w-full", objectFitClass)}
          draggable={false}
        />
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(0,0,0,0.4)]"
        style={{ left: `${position}%` }}
      >
        <div className="absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-md">
          <CaretLeft className="size-3" weight="bold" />
          <CaretRight className="size-3" weight="bold" />
        </div>
      </div>
    </div>
  )
}
