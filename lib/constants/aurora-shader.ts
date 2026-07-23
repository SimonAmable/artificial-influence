export const AURORA_SHADER_COLORS = [
  "#000000",
  "#FF0000",
  "#FFEA00",
  "#00D3FF",
  "#0028FF",
] as const

export const AURORA_SHADER_UNIFORMS = {
  style: 4,
  intensity: 0.87,
  zoom: 0.84,
  warp: 0.41,
  contrast: 0.7,
  speed: 0.83,
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
  cursorEffect: 4,
  cursorStrength: 0.87,
  cursorRadius: 0.5,
} as const

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "")
  const value = Number.parseInt(normalized, 16)
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]
}

export function getAuroraShaderColorUniforms(): [number, number, number][] {
  const base = AURORA_SHADER_COLORS.map(hexToRgb)
  const last = base[base.length - 1] ?? [0, 0, 0]
  return [...base, last, last, last]
}
