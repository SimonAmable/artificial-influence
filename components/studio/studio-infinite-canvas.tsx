"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { screenToWorld } from "@/lib/studio/camera"
import { STUDIO_MAX_ZOOM, STUDIO_MIN_ZOOM, type StudioViewport } from "@/lib/studio/types"

export interface StudioInfiniteCanvasHandle {
  getSize: () => { width: number; height: number }
  getContainerRect: () => DOMRect | null
  screenToWorld: (clientX: number, clientY: number) => { x: number; y: number } | null
  getLastPointerWorld: () => { x: number; y: number } | null
}

interface StudioInfiniteCanvasProps {
  viewport: StudioViewport
  onViewportChange: (viewport: StudioViewport) => void
  onBackgroundClick?: () => void
  onBackgroundContextMenu?: (event: React.MouseEvent<HTMLDivElement>, world: { x: number; y: number }) => void
  onFilesDrop?: (files: File[], world: { x: number; y: number }) => void
  className?: string
  children: React.ReactNode
}

const MIN_ZOOM = STUDIO_MIN_ZOOM
const MAX_ZOOM = STUDIO_MAX_ZOOM
const CLICK_MOVE_THRESHOLD = 4

function eventHasFiles(event: React.DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files")
}

export const StudioInfiniteCanvas = React.forwardRef<
  StudioInfiniteCanvasHandle,
  StudioInfiniteCanvasProps
>(function StudioInfiniteCanvas(
  {
    viewport,
    onViewportChange,
    onBackgroundClick,
    onBackgroundContextMenu,
    onFilesDrop,
    className,
    children,
  },
  ref,
) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const isPanningRef = React.useRef(false)
  const lastPointerRef = React.useRef<{ x: number; y: number } | null>(null)
  const lastPointerWorldRef = React.useRef<{ x: number; y: number } | null>(null)
  const panMovedRef = React.useRef(false)
  const viewportRef = React.useRef(viewport)
  const dragDepthRef = React.useRef(0)
  const [isFileDrag, setIsFileDrag] = React.useState(false)

  React.useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  const worldFromClient = React.useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current
    if (!container) return null
    return screenToWorld(clientX, clientY, container.getBoundingClientRect(), viewportRef.current)
  }, [])

  React.useImperativeHandle(ref, () => ({
    getSize: () => {
      const rect = containerRef.current?.getBoundingClientRect()
      return {
        width: rect?.width ?? 0,
        height: rect?.height ?? 0,
      }
    },
    getContainerRect: () => containerRef.current?.getBoundingClientRect() ?? null,
    screenToWorld: (clientX: number, clientY: number) => worldFromClient(clientX, clientY),
    getLastPointerWorld: () => lastPointerWorldRef.current,
  }), [worldFromClient])

  const rememberPointer = React.useCallback(
    (clientX: number, clientY: number) => {
      const world = worldFromClient(clientX, clientY)
      if (world) lastPointerWorldRef.current = world
    },
    [worldFromClient],
  )

  const handleWheel = React.useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault()
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top
      const current = viewportRef.current
      rememberPointer(event.clientX, event.clientY)

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
    [onViewportChange, rememberPointer],
  )

  const handlePointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    rememberPointer(event.clientX, event.clientY)
    if (event.button !== 0 && event.button !== 1) return
    const target = event.target as HTMLElement
    if (target.closest("[data-studio-tile]")) return

    isPanningRef.current = true
    panMovedRef.current = false
    lastPointerRef.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [rememberPointer])

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      rememberPointer(event.clientX, event.clientY)
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
    [onViewportChange, rememberPointer],
  )

  const handlePointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      rememberPointer(event.clientX, event.clientY)
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
    [onBackgroundClick, rememberPointer],
  )

  const handleContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement
      if (target.closest("[data-studio-tile]")) return
      event.preventDefault()
      const world = worldFromClient(event.clientX, event.clientY)
      if (!world) return
      lastPointerWorldRef.current = world
      onBackgroundContextMenu?.(event, world)
    },
    [onBackgroundContextMenu, worldFromClient],
  )

  const handleDragEnter = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!eventHasFiles(event)) return
    event.preventDefault()
    dragDepthRef.current += 1
    setIsFileDrag(true)
  }, [])

  const handleDragOver = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!eventHasFiles(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
    rememberPointer(event.clientX, event.clientY)
  }, [rememberPointer])

  const handleDragLeave = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!eventHasFiles(event)) return
    event.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setIsFileDrag(false)
  }, [])

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!eventHasFiles(event)) return
      event.preventDefault()
      dragDepthRef.current = 0
      setIsFileDrag(false)
      const files = Array.from(event.dataTransfer.files ?? [])
      const world = worldFromClient(event.clientX, event.clientY)
      if (!world || files.length === 0) return
      lastPointerWorldRef.current = world
      onFilesDrop?.(files, world)
    },
    [onFilesDrop, worldFromClient],
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
      onContextMenu={handleContextMenu}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className="absolute left-0 top-0 origin-top-left will-change-transform"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        }}
      >
        {children}
      </div>
      {isFileDrag ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-background/55 backdrop-blur-[1px]">
          <p className="rounded-full border border-border/70 bg-background/90 px-4 py-2 text-sm font-medium shadow-sm">
            Drop to add to board
          </p>
        </div>
      ) : null}
    </div>
  )
})
