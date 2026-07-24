export const AURORA_SHADER_COLORS = [
  "#000000",
  "#00FF37",
  "#B6FF41",
  "#000000",
] as const

/** Shimmer recipe — Silk path in the multi-style fragment shader. */
export const AURORA_SHADER_UNIFORMS = {
  style: 0,
  intensity: 0.87,
  zoom: 0.84,
  warp: 0.41,
  contrast: 0.7,
  speed: 0.28,
  /** ~8× idle speed while a generation job is running. */
  generatingSpeed: 2.24,
  grain: 0.17,
  drift: 0.59,
  animate: 1,
  reverse: 0,
  rotate: (159 * Math.PI) / 180,
  seed: 42,
  smoothBlend: 0,
  offsetX: 0.11,
  offsetY: 0.39,
  cursorOn: 1,
  /** Swirl cursor mode */
  cursorEffect: 2,
  cursorStrength: 0.01,
  cursorRadius: 0.15,
} as const

export const AURORA_SHADER_GLOW = "#00FF37"

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "")
  const value = Number.parseInt(normalized, 16)
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]
}

export function getAuroraShaderColorUniforms(): [number, number, number][] {
  const base = AURORA_SHADER_COLORS.map(hexToRgb)
  const last = base[base.length - 1] ?? [0, 0, 0]
  const colors: [number, number, number][] = [...base]
  while (colors.length < 8) {
    colors.push(last)
  }
  return colors.slice(0, 8)
}
