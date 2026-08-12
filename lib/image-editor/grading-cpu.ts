import type { MiniGlAdjustments, MiniGlPipeline } from "./minigl-params"
import { applyFilmGrainToFloatRgb } from "./apply-film-grain"
import {
  applyColorMatrixPixel,
  buildAdjustmentMatrices,
  buildInstaMtxMatrix,
} from "./grading-matrices"

export function mapSettingsToMiniGlAdjustments(
  settings: {
    brightness: number
    contrast: number
    saturation: number
    warmth: number
  }
): MiniGlAdjustments {
  return {
    brightness: settings.brightness / 100,
    contrast: settings.contrast / 100,
    saturation: settings.saturation / 100,
    temperature: settings.warmth / 100,
  }
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function applyGamma(channel: number, gamma: number): number {
  if (gamma === 1) return channel
  return Math.pow(channel, gamma)
}

function applyVibrance(
  r: number,
  g: number,
  b: number,
  vibrance: number
): [number, number, number] {
  if (vibrance === 0) return [r, g, b]
  const max = Math.max(r, g, b)
  const avg = (r + g + b) / 3
  const amt = Math.abs(max - avg) * 2 * -vibrance
  const nr = max !== r ? r + (max - r) * amt : r
  const ng = max !== g ? g + (max - g) * amt : g
  const nb = max !== b ? b + (max - b) * amt : b
  return [nr, ng, nb]
}

function applyVignette(
  r: number,
  g: number,
  b: number,
  x: number,
  y: number,
  vignette: number
): [number, number, number] {
  if (vignette === 0) return [r, g, b]
  const inner = 0.2
  const outer = 1.1
  const curvature = 0.65
  const posX = x * 2 - 1
  const posY = y * 2 - 1
  const curveX = Math.pow(Math.abs(posX), 1 / curvature)
  const curveY = Math.pow(Math.abs(posY), 1 / curvature)
  const edge = Math.pow(Math.hypot(curveX, curveY), curvature)
  const scale = 1 - Math.abs(posX)
  const vignetteAmount =
    1 - vignette * smoothstep(inner * scale, outer * scale, edge)
  return [r * vignetteAmount, g * vignetteAmount, b * vignetteAmount]
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function applyHighlightsShadows(
  r: number,
  g: number,
  b: number,
  highlights: number,
  shadows: number
): [number, number, number] {
  const luminanceWeighting = [0.2125, 0.7154, 0.0721]
  const luminance =
    r * luminanceWeighting[0] +
    g * luminanceWeighting[1] +
    b * luminanceWeighting[2]

  const shadow = Math.max(
    0,
    Math.min(
      1,
      Math.pow(luminance, 1 / shadows) +
        -0.76 * Math.pow(luminance, 2 / shadows) -
        luminance
    )
  )
  const highlight = Math.max(
    -1,
    Math.min(
      0,
      1 -
        (Math.pow(1 - luminance, 1 / (2 - highlights)) +
          -0.8 * Math.pow(1 - luminance, 2 / (2 - highlights))) -
        luminance
    )
  )

  const delta = luminance + shadow + highlight
  const denom = luminance > 0 ? luminance : 1
  let nr = delta * ((r - 0) / denom)
  let ng = delta * ((g - 0) / denom)
  let nb = delta * ((b - 0) / denom)

  const contrastedLuminance = (luminance - 0.5) * 1.5 + 0.5
  const whiteInterp =
    contrastedLuminance * contrastedLuminance * contrastedLuminance
  const whiteTarget = Math.max(0, Math.min(2, highlights)) - 1
  nr = nr + (1 - nr) * whiteInterp * whiteTarget
  ng = ng + (1 - ng) * whiteInterp * whiteTarget
  nb = nb + (1 - nb) * whiteInterp * whiteTarget

  const invContrastedLuminance = 1 - contrastedLuminance
  const blackInterp =
    invContrastedLuminance * invContrastedLuminance * invContrastedLuminance
  const blackTarget = 1 - Math.max(0, Math.min(1, shadows))
  nr = nr * (1 - blackInterp * blackTarget)
  ng = ng * (1 - blackInterp * blackTarget)
  nb = nb * (1 - blackInterp * blackTarget)

  return [nr, ng, nb]
}

function applyClarityConvolution(
  data: Float32Array,
  width: number,
  height: number,
  kernel: number[],
  weight: number
): Float32Array {
  const out = new Float32Array(data.length)
  const idx = (x: number, y: number, c: number) =>
    (y * width + x) * 4 + c

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offsets = [
        [-1, -1],
        [0, -1],
        [1, -1],
        [-1, 0],
        [0, 0],
        [1, 0],
        [-1, 1],
        [0, 1],
        [1, 1],
      ]
      for (let c = 0; c < 3; c++) {
        let sum = 0
        for (let k = 0; k < 9; k++) {
          const ox = Math.max(0, Math.min(width - 1, x + offsets[k][0]))
          const oy = Math.max(0, Math.min(height - 1, y + offsets[k][1]))
          sum += data[idx(ox, oy, c)] * kernel[k]
        }
        out[idx(x, y, c)] = Math.max(0, Math.min(1, sum / weight))
      }
      out[idx(x, y, 3)] = data[idx(x, y, 3)]
    }
  }
  return out
}

/** CPU grading pipeline aligned with mini-gl / glfx shader math (for previews + fallback). */
export function applyGradingCpu(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  pipeline: MiniGlPipeline
): Uint8ClampedArray {
  const floatData = new Float32Array(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const o = i * 4
    floatData[o] = rgba[o] / 255
    floatData[o + 1] = rgba[o + 1] / 255
    floatData[o + 2] = rgba[o + 2] / 255
    floatData[o + 3] = rgba[o + 3] / 255
  }

  if (pipeline.insta) {
    const { matrix, offset } = buildInstaMtxMatrix(
      pipeline.insta.mtx,
      pipeline.insta.mix
    )
    for (let i = 0; i < width * height; i++) {
      const o = i * 4
      const [r, g, b] = applyColorMatrixPixel(
        floatData[o],
        floatData[o + 1],
        floatData[o + 2],
        matrix,
        offset
      )
      floatData[o] = r
      floatData[o + 1] = g
      floatData[o + 2] = b
    }
  }

  const adjustments: MiniGlAdjustments = {
    ...pipeline.adjustments,
  }

  const {
    matrix,
    offset,
    gamma,
    vibrance,
    vignette,
    clarityKernel,
    clarityWeight,
  } = buildAdjustmentMatrices(adjustments)

  if (clarityWeight !== 1 && clarityKernel.some((v) => v !== 0)) {
    const convolved = applyClarityConvolution(
      floatData,
      width,
      height,
      clarityKernel,
      clarityWeight
    )
    floatData.set(convolved)
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      let r = floatData[o]
      let g = floatData[o + 1]
      let b = floatData[o + 2]

      r = applyGamma(r, gamma)
      g = applyGamma(g, gamma)
      b = applyGamma(b, gamma)

      ;[r, g, b] = applyVibrance(r, g, b, vibrance)
      ;[r, g, b] = applyColorMatrixPixel(r, g, b, matrix, offset)
      ;[r, g, b] = applyVignette(
        r,
        g,
        b,
        x / (width - 1),
        y / (height - 1),
        vignette
      )

      floatData[o] = r
      floatData[o + 1] = g
      floatData[o + 2] = b
    }
  }

  if (pipeline.highlightsShadows) {
    const [highlights, shadows] = pipeline.highlightsShadows
    const h = highlights + 1
    const s = shadows / 2 + 1
    for (let i = 0; i < width * height; i++) {
      const o = i * 4
      const [r, g, b] = applyHighlightsShadows(
        floatData[o],
        floatData[o + 1],
        floatData[o + 2],
        h,
        s
      )
      floatData[o] = Math.max(0, Math.min(1, r))
      floatData[o + 1] = Math.max(0, Math.min(1, g))
      floatData[o + 2] = Math.max(0, Math.min(1, b))
    }
  }

  applyFilmGrainToFloatRgb(floatData, width, height, pipeline.grain)

  const out = new Uint8ClampedArray(rgba.length)
  for (let i = 0; i < width * height; i++) {
    const o = i * 4
    out[o] = clampByte(floatData[o] * 255)
    out[o + 1] = clampByte(floatData[o + 1] * 255)
    out[o + 2] = clampByte(floatData[o + 2] * 255)
    out[o + 3] = clampByte(floatData[o + 3] * 255)
  }
  return out
}
