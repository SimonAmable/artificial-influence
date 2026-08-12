import type { MiniGlAdjustments, MiniGlInstaMtx } from "./minigl-params"

type Matrix4 = [
  [number, number, number, number, number],
  [number, number, number, number, number],
  [number, number, number, number, number],
  [number, number, number, number, number],
]

function multiplyM(A: Matrix4, B: Matrix4, n = 4): Matrix4 {
  const C: Matrix4 = [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ]
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0
      for (let k = 0; k < n; k++) {
        sum += A[i][k] * B[k][j]
      }
      C[i][j] = sum
    }
  }
  return C
}

/** Port of @xdadda/mini-gl insta MTX presets (glfx / pixi color-matrix family). */
export function buildInstaMtxMatrix(
  mtx: MiniGlInstaMtx["mtx"],
  mix: number
): { matrix: Matrix4; offset: [number, number, number, number] } {
  const identity: Matrix4 = [
    [1, 0, 0, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 0, 1, 0],
  ]

  const colormatrix: Record<string, Matrix4> = {
    polaroid: [
      [1 + 0.438 * mix, -0.062 * mix, -0.062 * mix, 0, 0],
      [-0.122 * mix, 1 + 0.378 * mix, -0.122 * mix, 0, 0],
      [-0.016 * mix, -0.016 * mix, 1 + 0.483 * mix, 0, 0],
      [0, 0, 0, 1, 0],
    ],
    kodachrome: [
      [
        (1 + 0.1285582396593525 * mix) * ((mix / 2 + 1) / 2 + 0.5),
        -0.3967382283601348 * mix,
        -0.03992559172921793 * mix,
        0,
        0.06372958762196502 * mix,
      ],
      [
        -0.16404339962244616 * mix,
        (1 + 0.0835251566291304 * mix) * ((mix / 2 + 1) / 2 + 0.5),
        -0.05498805115633132 * mix,
        0,
        0.024732407896706203 * mix,
      ],
      [
        -0.16786010706155763 * mix,
        -0.5603416277695248 * mix,
        (1 + 0.6014850761964943 * mix) * ((mix / 2 + 1) / 2 + 0.5),
        0,
        0.03562982807460946 * mix,
      ],
      [0, 0, 0, 1, 0],
    ],
    browni: [
      [
        (1 - 0.4002976502 * mix) * ((mix / 1.5 + 1) / 2 + 0.5),
        0.34553243048391263 * mix,
        -0.2708298674538042 * mix,
        0,
        (47.43192855600873 / 500) * mix,
      ],
      [
        -0.037703249837783157 * mix,
        (1 - 0.1390422412 * mix) * ((mix / 1.5 + 1) / 2 + 0.5),
        0.15059552388459913 * mix,
        0,
        (-36.96841498319127 / 500) * mix,
      ],
      [
        0.24113635128153335 * mix,
        -0.07441037908422492 * mix,
        (1 - 0.5502781794 * mix) * ((mix / 1.5 + 1) / 2 + 0.5),
        0,
        (-7.562075277591283 / 500) * mix,
      ],
      [0, 0, 0, 1, 0],
    ],
    vintage: [
      [
        (1 - 0.3720654364 * mix) * ((mix / 1.5 + 1) / 2 + 0.5),
        0.3202183420819367 * mix,
        -0.03965408211312453 * mix,
        0,
        (9.651285835294123 / 1000) * mix,
      ],
      [
        0.02578397704808868 * mix,
        (1 - 0.3558811356 * mix) * ((mix / 1.5 + 1) / 2 + 0.5),
        0.03259127616149294 * mix,
        0,
        (7.462829176470591 / 1000) * mix,
      ],
      [
        0.0466055556782719 * mix,
        -0.0851232987247891 * mix,
        (1 - 0.4758351981 * mix) * ((mix / 1.5 + 1) / 2 + 0.5),
        0,
        (5.159190588235296 / 1000) * mix,
      ],
      [0, 0, 0, 1, 0],
    ],
  }

  const m = colormatrix[mtx] ?? identity
  const offset: [number, number, number, number] = [m[0][4], m[1][4], m[2][4], m[3][4]]
  return { matrix: m, offset }
}

/** Port of @xdadda/mini-gl filterAdjustments matrix stack. */
export function buildAdjustmentMatrices(effects: MiniGlAdjustments): {
  matrix: Matrix4
  offset: [number, number, number, number]
  gamma: number
  vibrance: number
  vignette: number
  clarityKernel: number[]
  clarityWeight: number
} {
  let {
    brightness: b = 0,
    contrast: c = 0,
    saturation: s = 0,
    exposure: e = 0,
    temperature: t = 0,
    gamma = 0,
    clarity: l = 0,
    vibrance = 0,
    vignette = 0,
    tint: tt = 0,
    sepia: sp = 0,
  } = effects

  b = b / 4
  c = (c + 1) / 2 + 0.5
  s = s + 1
  e = ((e > 0 ? e * 3 : e * 1.5) + 1) / 2 + 0.5
  gamma += 1
  t *= 2
  tt *= 2

  const colormatrix: Record<string, Matrix4> = {
    brightness: [
      [1, 0, 0, 0, b],
      [0, 1, 0, 0, b],
      [0, 0, 1, 0, b],
      [0, 0, 0, 1, 0],
    ],
    contrast: [
      [c, 0, 0, 0, 0.5 * (1 - c)],
      [0, c, 0, 0, 0.5 * (1 - c)],
      [0, 0, c, 0, 0.5 * (1 - c)],
      [0, 0, 0, 1, 0],
    ],
    saturation: [
      [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0, 0],
      [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0, 0],
      [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0, 0],
      [0, 0, 0, 1, 0],
    ],
    exposure: [
      [e, 0, 0, 0, 0],
      [0, e, 0, 0, 0],
      [0, 0, e, 0, 0],
      [0, 0, 0, 1, 0],
    ],
    temperature:
      t > 0
        ? [
            [1 + 0.1 * t, 0, 0, 0, 0],
            [0, 1, 0, 0, 0],
            [0, 0, 1 + 0.1 * -t, 0, 0],
            [0, 0, 0, 1, 0],
          ]
        : [
            [1 + 0.15 * t, 0, 0, 0, 0],
            [0, 1 + 0.05 * t, 0, 0, 0],
            [0, 0, 1 + 0.15 * -t, 0, 0],
            [0, 0, 0, 1, 0],
          ],
    tint: [
      [1, 0, 0, 0, 0],
      [0, 1 + 0.1 * tt, 0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 1, 0],
    ],
    sepia: [
      [1 - 0.607 * sp, 0.769 * sp, 0.189 * sp, 0, 0],
      [0.349 * sp, 1 - 0.314 * sp, 0.168 * sp, 0, 0],
      [0.272 * sp, 0.534 * sp, 1 - 0.869 * sp, 0, 0],
      [0, 0, 0, 1, 0],
    ],
    identity: [
      [1, 0, 0, 0, 0],
      [0, 1, 0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 1, 0],
    ],
  }

  let cMatrix = colormatrix.identity
  let cOffset: [number, number, number, number] = [0, 0, 0, 0]

  cMatrix = multiplyM(cMatrix, colormatrix.brightness, 4)
  cOffset = [0, 1, 2, 3].map(
    (i) => cOffset[i] + colormatrix.brightness[i][4]
  ) as [number, number, number, number]
  cMatrix = multiplyM(cMatrix, colormatrix.contrast, 4)
  cOffset = [0, 1, 2, 3].map(
    (i) => cOffset[i] + colormatrix.contrast[i][4]
  ) as [number, number, number, number]
  cMatrix = multiplyM(cMatrix, colormatrix.saturation, 4)
  cMatrix = multiplyM(cMatrix, colormatrix.exposure, 4)
  cMatrix = multiplyM(cMatrix, colormatrix.temperature, 4)
  cMatrix = multiplyM(cMatrix, colormatrix.tint, 4)
  cMatrix = multiplyM(cMatrix, colormatrix.sepia, 4)

  const clarityKernel =
    l >= 0
      ? [0, -1 * l, 0, -1 * l, 1 + 4 * l, -1 * l, 0, -1 * l, 0]
      : [
          -1 * l,
          -2 * l,
          -1 * l,
          -2 * l,
          1 + -3 * l,
          -2 * l,
          -1 * l,
          -2 * l,
          -1 * l,
        ]

  let clarityWeight = clarityKernel.reduce((sum, value) => sum + value, 0)
  if (clarityWeight <= 0) clarityWeight = 1

  return {
    matrix: cMatrix,
    offset: cOffset,
    gamma: 1 / gamma,
    vibrance,
    vignette,
    clarityKernel,
    clarityWeight,
  }
}

export function applyColorMatrixPixel(
  r: number,
  g: number,
  b: number,
  matrix: Matrix4,
  offset: [number, number, number, number]
): [number, number, number] {
  const nr =
    r * matrix[0][0] +
    g * matrix[0][1] +
    b * matrix[0][2] +
    offset[0]
  const ng =
    r * matrix[1][0] +
    g * matrix[1][1] +
    b * matrix[1][2] +
    offset[1]
  const nb =
    r * matrix[2][0] +
    g * matrix[2][1] +
    b * matrix[2][2] +
    offset[2]
  return [
    clamp01(nr),
    clamp01(ng),
    clamp01(nb),
  ]
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
