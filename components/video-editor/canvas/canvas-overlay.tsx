"use client"

import * as React from "react"
import { useVideoEditor } from "@/components/video-editor/video-editor-provider"
import { findItemInProject } from "@/lib/video-editor/project-helpers"
import type { EditorItem, EditorProject } from "@/lib/video-editor/types"
import { cn } from "@/lib/utils"

const MIN_SIZE = 8

type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w"

function flattenVisibleItems(project: EditorProject): EditorItem[] {
  const out: EditorItem[] = []
  for (const t of project.tracks) {
    if (t.hidden) continue
    for (const i of t.items) {
      out.push(i)
    }
  }
  return out
}

function clientToComp(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  compW: number,
  compH: number
): { x: number; y: number } {
  const x = ((clientX - rect.left) / rect.width) * compW
  const y = ((clientY - rect.top) / rect.height) * compH
  return { x, y }
}

function applyResize(
  handle: HandleId,
  dx: number,
  dy: number,
  start: { x: number; y: number; width: number; height: number },
  lockAspect: boolean
): { x: number; y: number; width: number; height: number } {
  const { x: x0, y: y0, width: w0, height: h0 } = start
  const ar = w0 / h0

  let x = x0
  let y = y0
  let w = w0
  let h = h0

  if (lockAspect) {
    switch (handle) {
      case "e": {
        w = Math.max(MIN_SIZE, w0 + dx)
        h = w / ar
        break
      }
      case "w": {
        w = Math.max(MIN_SIZE, w0 - dx)
        h = w / ar
        x = x0 + w0 - w
        y = y0 + (h0 - h) / 2
        break
      }
      case "s": {
        h = Math.max(MIN_SIZE, h0 + dy)
        w = h * ar
        x = x0 + (w0 - w) / 2
        break
      }
      case "n": {
        h = Math.max(MIN_SIZE, h0 - dy)
        w = h * ar
        x = x0 + (w0 - w) / 2
        y = y0 + h0 - h
        break
      }
      case "se": {
        w = Math.max(MIN_SIZE, w0 + dx)
        h = w / ar
        break
      }
      case "nw": {
        w = Math.max(MIN_SIZE, w0 - dx)
        h = w / ar
        x = x0 + w0 - w
        y = y0 + h0 - h
        break
      }
      case "ne": {
        w = Math.max(MIN_SIZE, w0 + dx)
        h = w / ar
        y = y0 + h0 - h
        break
      }
      case "sw": {
        w = Math.max(MIN_SIZE, w0 - dx)
        h = w / ar
        x = x0 + w0 - w
        break
      }
    }
    return { x, y, width: w, height: h }
  }

  switch (handle) {
    case "e":
      w = Math.max(MIN_SIZE, w0 + dx)
      break
    case "w": {
      const nw = Math.max(MIN_SIZE, w0 - dx)
      x = x0 + w0 - nw
      w = nw
      break
    }
    case "s":
      h = Math.max(MIN_SIZE, h0 + dy)
      break
    case "n": {
      const nh = Math.max(MIN_SIZE, h0 - dy)
      y = y0 + h0 - nh
      h = nh
      break
    }
    case "se": {
      w = Math.max(MIN_SIZE, w0 + dx)
      h = Math.max(MIN_SIZE, h0 + dy)
      break
    }
    case "nw": {
      const nw = Math.max(MIN_SIZE, w0 - dx)
      const nh = Math.max(MIN_SIZE, h0 - dy)
      x = x0 + w0 - nw
      y = y0 + h0 - nh
      w = nw
      h = nh
      break
    }
    case "ne": {
      const nw = Math.max(MIN_SIZE, w0 + dx)
      const nh = Math.max(MIN_SIZE, h0 - dy)
      y = y0 + h0 - nh
      w = nw
      h = nh
      break
    }
    case "sw": {
      const nw = Math.max(MIN_SIZE, w0 - dx)
      const nh = Math.max(MIN_SIZE, h0 + dy)
      x = x0 + w0 - nw
      w = nw
      h = nh
      break
    }
  }
  return { x, y, width: w, height: h }
}

const HANDLE_CURSOR: Record<HandleId, string> = {
  nw: "cursor-nwse-resize",
  n: "cursor-ns-resize",
  ne: "cursor-nesw-resize",
  e: "cursor-ew-resize",
  se: "cursor-nwse-resize",
  s: "cursor-ns-resize",
  sw: "cursor-nesw-resize",
  w: "cursor-ew-resize",
}

const HANDLE_POS: Record<HandleId, React.CSSProperties> = {
  nw: { left: 0, top: 0 },
  n: { left: "50%", top: 0 },
  ne: { left: "100%", top: 0 },
  e: { left: "100%", top: "50%" },
  se: { left: "100%", top: "100%" },
  s: { left: "50%", top: "100%" },
  sw: { left: 0, top: "100%" },
  w: { left: 0, top: "50%" },
}

type DragState = {
  mode: "move" | "resize"
  pointerId: number
  itemId: string
  handle?: HandleId
  startPointer: { x: number; y: number }
  startItem: { x: number; y: number; width: number; height: number }
}

/**
 * Selection boxes must use % of the viewport, not raw composition pixels.
 * The preview div often has a smaller *used* size (maxWidth/maxHeight) than
 * compW×compH; Remotion scales the frame to fit, but px-based overlay was misaligned.
 */
export function CanvasOverlay({
  compositionRef,
  compW,
  compH,
}: {
  compositionRef: React.RefObject<HTMLDivElement | null>
  compW: number
  compH: number
}) {
  const { project, dispatch } = useVideoEditor()
  const projectRef = React.useRef(project)
  React.useLayoutEffect(() => {
    projectRef.current = project
  }, [project])

  const items = flattenVisibleItems(project)
  const primaryId = project.selectedItemIds[0] ?? null

  const dragRef = React.useRef<DragState | null>(null)

  const startDrag = (
    e: React.PointerEvent,
    mode: "move" | "resize",
    item: EditorItem,
    handle?: HandleId
  ) => {
    e.stopPropagation()
    e.preventDefault()
    const el = compositionRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const p = clientToComp(e.clientX, e.clientY, rect, compW, compH)
    const found = findItemInProject(projectRef.current, item.id)?.item
    if (!found) return

    dragRef.current = {
      mode,
      pointerId: e.pointerId,
      itemId: item.id,
      handle,
      startPointer: p,
      startItem: { x: found.x, y: found.y, width: found.width, height: found.height },
    }

    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current
      const node = compositionRef.current
      if (!d || !node || ev.pointerId !== d.pointerId) return
      const r = node.getBoundingClientRect()
      const cur = clientToComp(ev.clientX, ev.clientY, r, compW, compH)
      const dx = cur.x - d.startPointer.x
      const dy = cur.y - d.startPointer.y
      const s = d.startItem
      const itemNow = findItemInProject(projectRef.current, d.itemId)?.item
      const lockAspect = ev.shiftKey || !!itemNow?.keepAspectRatio

      if (d.mode === "move") {
        dispatch({
          type: "UPDATE_ITEM",
          itemId: d.itemId,
          patch: { x: s.x + dx, y: s.y + dy },
        })
        return
      }

      if (d.mode === "resize" && d.handle) {
        const next = applyResize(d.handle, dx, dy, s, lockAspect)
        dispatch({
          type: "UPDATE_ITEM",
          itemId: d.itemId,
          patch: {
            x: next.x,
            y: next.y,
            width: next.width,
            height: next.height,
          },
        })
      }
    }

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== dragRef.current?.pointerId) return
      dragRef.current = null
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div
        className="pointer-events-auto absolute inset-0 z-0"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) {
            dispatch({ type: "SET_SELECTED", ids: [] })
          }
        }}
      />
      {items.map((item, stackIndex) => {
        const selected = project.selectedItemIds.includes(item.id)
        const showHandles = selected && project.selectedItemIds.length === 1 && primaryId === item.id
        const safeW = compW > 0 ? compW : 1
        const safeH = compH > 0 ? compH : 1

        return (
          <div
            key={item.id}
            className="pointer-events-auto absolute z-10"
            style={{
              left: `${(item.x / safeW) * 100}%`,
              top: `${(item.y / safeH) * 100}%`,
              width: `${(item.width / safeW) * 100}%`,
              height: `${(item.height / safeH) * 100}%`,
              transform: `rotate(${item.rotation}deg)`,
              transformOrigin: "top left",
              zIndex: 20 + stackIndex,
            }}
            onPointerDown={(e) => {
              e.stopPropagation()
              if (e.metaKey || e.ctrlKey) {
                dispatch({ type: "TOGGLE_SELECT", itemId: item.id, additive: true })
              } else {
                dispatch({ type: "SET_SELECTED", ids: [item.id] })
              }
              startDrag(e, "move", item)
            }}
          >
            <div
              className={cn(
                "pointer-events-none absolute inset-0 border-2 transition-colors",
                selected ? "border-primary bg-primary/5" : "border-transparent hover:border-primary/40"
              )}
            />
            {showHandles &&
              (["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const).map((hid) => (
                <button
                  key={hid}
                  type="button"
                  tabIndex={-1}
                  aria-label={`Resize ${hid}`}
                  className={cn(
                    "pointer-events-auto absolute z-30 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-primary bg-background shadow",
                    HANDLE_CURSOR[hid]
                  )}
                  style={HANDLE_POS[hid]}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    dispatch({ type: "SET_SELECTED", ids: [item.id] })
                    startDrag(e, "resize", item, hid)
                  }}
                />
              ))}
          </div>
        )
      })}
    </div>
  )
}
