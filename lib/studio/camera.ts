import type { StudioViewport } from "@/lib/studio/types"

export interface WorldRect {
  x: number
  y: number
  width: number
  height: number
}

export function boundingRect(items: WorldRect[]): WorldRect | null {
  if (items.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const item of items) {
    minX = Math.min(minX, item.x)
    minY = Math.min(minY, item.y)
    maxX = Math.max(maxX, item.x + item.width)
    maxY = Math.max(maxY, item.y + item.height)
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

export function viewportToCenterRect(
  rect: WorldRect,
  container: { width: number; height: number },
  zoom: number,
  inset: { top: number; bottom: number; left?: number; right?: number } = {
    top: 112,
    bottom: 200,
  },
): StudioViewport {
  const left = inset.left ?? 0
  const right = inset.right ?? 0
  const viewWidth = Math.max(1, container.width - left - right)
  const viewHeight = Math.max(1, container.height - inset.top - inset.bottom)
  const centerX = rect.x + rect.width / 2
  const centerY = rect.y + rect.height / 2

  return {
    zoom,
    x: left + viewWidth / 2 - centerX * zoom,
    y: inset.top + viewHeight / 2 - centerY * zoom,
  }
}

export function animateViewport(
  from: StudioViewport,
  to: StudioViewport,
  durationMs: number,
  onFrame: (viewport: StudioViewport) => void,
  onDone?: () => void,
): () => void {
  const start = performance.now()
  let frame = 0

  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / Math.max(1, durationMs))
    const eased = 1 - (1 - t) ** 3
    onFrame({
      x: from.x + (to.x - from.x) * eased,
      y: from.y + (to.y - from.y) * eased,
      zoom: from.zoom + (to.zoom - from.zoom) * eased,
    })
    if (t < 1) {
      frame = requestAnimationFrame(tick)
      return
    }
    onDone?.()
  }

  frame = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(frame)
}
