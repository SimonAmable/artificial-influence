import {
  ANGLES_TILT_MAX,
  ANGLES_TILT_MIN,
  ANGLES_ZOOM_MAX,
  ANGLES_ZOOM_MIN,
} from "./constants.ts"
import type { AngleState } from "./types.ts"

export type CameraPosition = {
  x: number
  y: number
  z: number
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function wrapDegrees(value: number): number {
  return ((value % 360) + 360) % 360
}

/** Clamp/wrap angle values without snapping — used for live orbit previews. */
export function sanitizeAngleState(state: AngleState): AngleState {
  return {
    rotation: wrapDegrees(state.rotation),
    tilt: clamp(state.tilt, ANGLES_TILT_MIN, ANGLES_TILT_MAX),
    zoom: clamp(state.zoom, ANGLES_ZOOM_MIN, ANGLES_ZOOM_MAX),
  }
}

/** Integer-snapped angle state for prompts, sliders, and committed values. */
export function normalizeAngleState(state: AngleState): AngleState {
  const sanitized = sanitizeAngleState(state)
  return {
    rotation: Math.round(sanitized.rotation),
    tilt: Math.round(sanitized.tilt),
    zoom: Math.round(sanitized.zoom),
  }
}

export function zoomToOrbitRadius(
  zoom: number,
  options?: { minRadius?: number; maxRadius?: number },
): number {
  const normalizedZoom = clamp(zoom, ANGLES_ZOOM_MIN, ANGLES_ZOOM_MAX)
  const minRadius = options?.minRadius ?? 1.35
  const maxRadius = options?.maxRadius ?? 3.4
  const zoomProgress =
    (normalizedZoom - ANGLES_ZOOM_MIN) / (ANGLES_ZOOM_MAX - ANGLES_ZOOM_MIN)

  return maxRadius + (minRadius - maxRadius) * zoomProgress
}

export function angleStateToCameraPosition(
  state: AngleState,
  options?: { minRadius?: number; maxRadius?: number },
): CameraPosition {
  const sanitized = sanitizeAngleState(state)
  const azimuth = (sanitized.rotation * Math.PI) / 180
  const elevation = (sanitized.tilt * Math.PI) / 180
  const radius = zoomToOrbitRadius(sanitized.zoom, options)
  const elevationCosine = Math.cos(elevation)

  return {
    x: Math.sin(azimuth) * elevationCosine * radius,
    y: Math.sin(elevation) * radius,
    z: Math.cos(azimuth) * elevationCosine * radius,
  }
}
