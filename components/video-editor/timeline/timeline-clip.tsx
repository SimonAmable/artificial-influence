"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { trackIdAtPointer } from "@/lib/video-editor/timeline-dom"
import {
  applyLeftEdgeTrim,
  applyRightEdgeTrim,
  buildMagneticSnapFrames,
  snapTimelineFrame,
} from "@/lib/video-editor/timeline-clip-math"
import type { EditorItem, EditorProject, VideoEditorAction } from "@/lib/video-editor/types"

function clipLabel(item: EditorItem): string {
  switch (item.type) {
    case "text":
      return "Text"
    case "solid":
      return "Solid"
    case "captions":
      return "CC"
    default:
      return item.type.toUpperCase()
  }
}

export function TimelineClip({
  item,
  trackId,
  project,
  px,
  currentFrame,
  scrollRef,
  dispatch,
  setIsPlaying,
}: {
  item: EditorItem
  trackId: string
  project: EditorProject
  px: number
  currentFrame: number
  scrollRef: React.RefObject<HTMLDivElement | null>
  dispatch: (a: VideoEditorAction) => void
  setIsPlaying: (v: boolean) => void
}) {
  const projectRef = React.useRef(project)
  const playheadRef = React.useRef(currentFrame)
  React.useLayoutEffect(() => {
    projectRef.current = project
    playheadRef.current = currentFrame
  }, [project, currentFrame])

  const selected = project.selectedItemIds.includes(item.id)
  const w = Math.max(item.durationInFrames * px, 8)
  const tooNarrow = w < 24

  /** Fractional frame index for smooth drags; quantized in `snap`. */
  const frameFromClientX = React.useCallback(
    (clientX: number) => {
      const el = scrollRef.current
      if (!el) return 0
      const rect = el.getBoundingClientRect()
      const x = clientX - rect.left + el.scrollLeft
      return Math.max(0, x / px)
    },
    [px, scrollRef]
  )

  const attachDragListeners = (
    pointerId: number,
    mode: "move" | "trim-left" | "trim-right",
    grabOffsetFrames: number,
    fixedRightFrame: number,
    fixedLeftFrame: number,
    startItem: EditorItem,
    itemId: string,
    tid: string
  ) => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return

      const proj = projectRef.current
      const snapFrames = buildMagneticSnapFrames(proj, tid, itemId, playheadRef.current)
      const snap = (frame: number) =>
        snapTimelineFrame(frame, proj.snappingEnabled, {
          pxPerFrame: px,
          snapFrames,
        })

      if (mode === "move") {
        const f = frameFromClientX(e.clientX)
        let newFrom = snap(f - grabOffsetFrames)
        newFrom = Math.max(0, newFrom)
        const targetTrackId = trackIdAtPointer(e.clientX, e.clientY, tid)
        dispatch({ type: "MOVE_ITEM", itemId, from: newFrom, trackId: targetTrackId })
        return
      }

      if (mode === "trim-left") {
        const f = snap(frameFromClientX(e.clientX))
        const right = fixedRightFrame
        let newFrom = Math.min(f, right - 1)
        newFrom = Math.max(0, newFrom)
        const newDur = right - newFrom
        if (newDur < 1) return
        const patch = applyLeftEdgeTrim(startItem, newFrom, newDur)
        if (patch) dispatch({ type: "UPDATE_ITEM", itemId, patch })
        return
      }

      if (mode === "trim-right") {
        const f = snap(frameFromClientX(e.clientX))
        const left = fixedLeftFrame
        const newRight = Math.max(f, left + 1)
        const newDur = newRight - left
        const patch = applyRightEdgeTrim(startItem, newDur)
        if (patch) dispatch({ type: "UPDATE_ITEM", itemId, patch })
      }
    }

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
  }

  const beginDrag = (
    e: React.PointerEvent,
    mode: "move" | "trim-left" | "trim-right",
    grabOffsetFrames: number,
    fixedRightFrame: number,
    fixedLeftFrame: number
  ) => {
    e.stopPropagation()
    e.preventDefault()
    if (e.button !== 0) return
    dispatch({
      type: "TOGGLE_SELECT",
      itemId: item.id,
      additive: e.metaKey || e.ctrlKey,
    })
    setIsPlaying(false)
    attachDragListeners(
      e.pointerId,
      mode,
      grabOffsetFrames,
      fixedRightFrame,
      fixedLeftFrame,
      item,
      item.id,
      trackId
    )
  }

  const startMove = (e: React.PointerEvent) => {
    const f = frameFromClientX(e.clientX)
    beginDrag(e, "move", f - item.from, 0, 0)
  }

  const startTrimLeft = (e: React.PointerEvent) => {
    beginDrag(e, "trim-left", 0, item.from + item.durationInFrames, item.from)
  }

  const startTrimRight = (e: React.PointerEvent) => {
    beginDrag(e, "trim-right", 0, item.from + item.durationInFrames, item.from)
  }

  return (
    <div
      className={cn(
        "absolute top-1 bottom-1 flex overflow-hidden rounded-md border text-left text-[10px] leading-tight shadow-sm transition-[border-color,box-shadow]",
        selected
          ? "border-primary bg-primary/25 shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]"
          : "border-border/90 bg-secondary/90 hover:border-muted-foreground/40"
      )}
      style={{
        left: item.from * px,
        width: w,
        minWidth: 8,
      }}
    >
      {!tooNarrow && (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Trim start"
            className={cn(
              "relative z-20 shrink-0 cursor-ew-resize rounded-l-md border-r border-white/15 bg-linear-to-r from-black/40 to-black/20",
              "w-2.5 min-w-[10px] hover:from-primary/50 hover:to-primary/25"
            )}
            onPointerDown={startTrimLeft}
          />
          <button
            type="button"
            tabIndex={-1}
            className={cn(
              "relative z-10 flex min-w-0 flex-1 cursor-grab items-center overflow-hidden px-1 text-left active:cursor-grabbing",
              "select-none"
            )}
            onPointerDown={startMove}
          >
            <span className="truncate font-medium">{clipLabel(item)}</span>
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Trim end"
            className={cn(
              "relative z-20 shrink-0 cursor-ew-resize rounded-r-md border-l border-white/15 bg-linear-to-l from-black/40 to-black/20",
              "w-2.5 min-w-[10px] hover:from-primary/50 hover:to-primary/25"
            )}
            onPointerDown={startTrimRight}
          />
        </>
      )}
      {tooNarrow && (
        <button
          type="button"
          tabIndex={-1}
          className={cn(
            "relative z-10 flex w-full cursor-grab items-center justify-center px-0.5 active:cursor-grabbing",
            "select-none"
          )}
          onPointerDown={startMove}
        >
          <span className="truncate">{clipLabel(item)}</span>
        </button>
      )}
    </div>
  )
}
