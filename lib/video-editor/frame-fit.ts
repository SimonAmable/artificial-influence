/**
 * Scale and center `media` rectangle so it fits entirely inside the composition (contain).
 */
export function fitRectContain(
  frameW: number,
  frameH: number,
  mediaW: number,
  mediaH: number
): { x: number; y: number; width: number; height: number } {
  if (!Number.isFinite(mediaW) || !Number.isFinite(mediaH) || mediaW <= 0 || mediaH <= 0) {
    return { x: 0, y: 0, width: frameW, height: frameH }
  }
  const s = Math.min(frameW / mediaW, frameH / mediaH)
  const w = mediaW * s
  const h = mediaH * s
  return {
    x: (frameW - w) / 2,
    y: (frameH - h) / 2,
    width: w,
    height: h,
  }
}
