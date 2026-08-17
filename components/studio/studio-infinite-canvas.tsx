"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { STUDIO_MAX_ZOOM, STUDIO_MIN_ZOOM, type StudioViewport } from "@/lib/studio/types"

export interface StudioInfiniteCanvasHandle {
  getSize: () => { width: number; height: number }
}

interface StudioInfiniteCanvasProps {
  viewport: StudioViewport
  onViewportChange: (viewport: StudioViewport) => void
  onBackgroundClick?: () => void
  className?: string
  children: React.ReactNode
}

const MIN_ZOOM = STUDIO_MIN_ZOOM
const MAX_ZOOM = STUDIO_MAX_ZOOM
const CLICK_MOVE_THRESHOLD = 4

export const StudioInfiniteCanvas = React.forwardRef<
  StudioInfiniteCanvasHandle,
  StudioInfiniteCanvasProps
>(function StudioInfiniteCanvas(
  { viewport, onViewportChange, onBackgroundClick, className, children },
  ref,
) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const isPanningRef = React.useRef(false)
  const lastPointerRef = React.useRef<{ x: number; y: number } | null>(null)
  const panMovedRef = React.useRef(false)
  const viewportRef = React.useRef(viewport)

  React.useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  React.useImperativeHandle(ref, () => ({
    getSize: () => {
      const rect = containerRef.current?.getBoundingClientRect()
      return {
        width: rect?.width ?? 0,
        height: rect?.height ?? 0,
      }
    },
  }), [])

  const handleWheel = React.useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault()
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top
      const current = viewportRef.current

      if (event.ctrlKey || event.metaKey) {
        const zoomFactor = Math.exp(-event.deltaY * 0.0015)
        const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.zoom * zoomFactor))
        const worldX = (pointerX - current.x) / current.zoom
        const worldY = (pointerY - current.y) / current.zoom
        onViewportChange({
          zoom: nextZoom,
          x: pointerX - worldX * nextZoom,
          y: pointerY - worldY * nextZoom,
        })
        return
      }

      onViewportChange({
        ...current,
        x: current.x - event.deltaX,
        y: current.y - event.deltaY,
      })
    },
    [onViewportChange],
  )

  const handlePointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return
    const target = event.target as HTMLElement
    if (target.closest("[data-studio-tile]")) return

    isPanningRef.current = true
    panMovedRef.current = false
    lastPointerRef.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isPanningRef.current || !lastPointerRef.current) return
      const dx = event.clientX - lastPointerRef.current.x
      const dy = event.clientY - lastPointerRef.current.y
      if (Math.abs(dx) > CLICK_MOVE_THRESHOLD || Math.abs(dy) > CLICK_MOVE_THRESHOLD) {
        panMovedRef.current = true
      }
      lastPointerRef.current = { x: event.clientX, y: event.clientY }
      const current = viewportRef.current
      onViewportChange({
        ...current,
        x: current.x + dx,
        y: current.y + dy,
      })
    },
    [onViewportChange],
  )

  const handlePointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const wasClick = isPanningRef.current && !panMovedRef.current
      isPanningRef.current = false
      lastPointerRef.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      if (wasClick) {
        onBackgroundClick?.()
      }
    },
    [onBackgroundClick],
  )

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full w-full overflow-hidden touch-none cursor-grab active:cursor-grabbing",
        "bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border)/0.55)_1px,transparent_0)] [background-size:24px_24px]",
        className,
      )}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className="absolute left-0 top-0 origin-top-left will-change-transform"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        }}
      >
        {children}
      </div>
    </div>
  )
})
