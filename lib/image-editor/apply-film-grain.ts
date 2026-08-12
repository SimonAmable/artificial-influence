import { MAX_FILTER_GRAIN } from "./minigl-params"

/** Shared film-grain strength (0–1 noise amplitude at max grain). */
export const FILM_GRAIN_STRENGTH = 0.38

export function applyFilmGrainToRgba(
  data: Uint8ClampedArray,
  grain: number
): void {
  if (grain <= 0) return
  const strength = (grain / MAX_FILTER_GRAIN) * FILM_GRAIN_STRENGTH * 255
  for (let i = 0; i < data.length; i += 4) {
    const n = (0.5 - Math.random()) * strength
    data[i] = Math.max(0, Math.min(255, data[i] + n))
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n))
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n))
  }
}

export function applyFilmGrainToFloatRgb(
  data: Float32Array,
  width: number,
  height: number,
  grain: number
): void {
  if (grain <= 0) return
  const strength = (grain / MAX_FILTER_GRAIN) * FILM_GRAIN_STRENGTH
  const pixelCount = width * height
  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4
    const n = (0.5 - Math.random()) * strength
    data[offset] = Math.max(0, Math.min(1, data[offset] + n))
    data[offset + 1] = Math.max(0, Math.min(1, data[offset + 1] + n))
    data[offset + 2] = Math.max(0, Math.min(1, data[offset + 2] + n))
  }
}

export function applyFilmGrainToContext(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  grain: number
): void {
  if (grain <= 0) return
  const imageData = ctx.getImageData(0, 0, width, height)
  applyFilmGrainToRgba(imageData.data, grain)
  ctx.putImageData(imageData, 0, 0)
}
