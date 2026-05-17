import type { Canvas as FabricCanvas, FabricObject } from "fabric"
import { Point } from "fabric"

/** Distance in canvas pixels from the canvas center before snapping activates. */
export const CANVAS_CENTER_SNAP_THRESHOLD = 8

export type CanvasCenterSnapGuides = {
  verticalX: number | null
  horizontalY: number | null
}

export function clearCanvasCenterSnapGuides(store: { current: CanvasCenterSnapGuides }): void {
  store.current = { verticalX: null, horizontalY: null }
}

/**
 * Snaps the object's bounding-box center to the canvas midpoint on each axis when within
 * {@link CANVAS_CENTER_SNAP_THRESHOLD}, and records which centerlines should be drawn.
 */
export function updateCanvasCenterSnap(
  canvas: FabricCanvas,
  target: FabricObject,
  guidesStore: { current: CanvasCenterSnapGuides }
): void {
  const cw = canvas.getWidth()
  const ch = canvas.getHeight()
  if (cw <= 0 || ch <= 0) {
    guidesStore.current = { verticalX: null, horizontalY: null }
    return
  }

  const midX = cw / 2
  const midY = ch / 2
  const center = target.getCenterPoint()

  let snapX = false
  let snapY = false
  let nextX = center.x
  let nextY = center.y

  if (Math.abs(center.x - midX) < CANVAS_CENTER_SNAP_THRESHOLD) {
    nextX = midX
    snapX = true
  }
  if (Math.abs(center.y - midY) < CANVAS_CENTER_SNAP_THRESHOLD) {
    nextY = midY
    snapY = true
  }

  if (snapX || snapY) {
    target.setPositionByOrigin(new Point(nextX, nextY), "center", "center")
    target.setCoords()
  }

  guidesStore.current = {
    verticalX: snapX ? midX : null,
    horizontalY: snapY ? midY : null,
  }
}

export function drawCanvasCenterSnapGuides(
  ctx: CanvasRenderingContext2D,
  canvas: FabricCanvas,
  guides: CanvasCenterSnapGuides,
  strokeStyle: string
): void {
  const { verticalX, horizontalY } = guides
  if (verticalX === null && horizontalY === null) return

  const w = canvas.getWidth()
  const h = canvas.getHeight()
  if (w <= 0 || h <= 0) return

  ctx.save()
  ctx.setLineDash([4, 4])
  ctx.lineWidth = 1
  ctx.strokeStyle = strokeStyle

  if (verticalX !== null) {
    const x = Math.round(verticalX) + 0.5
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  if (horizontalY !== null) {
    const y = Math.round(horizontalY) + 0.5
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }

  ctx.restore()
}
