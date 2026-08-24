/**
 * Aspect ratios accepted by xAI image APIs (generations + edits).
 * @see https://docs.x.ai/docs/guides/image-generation
 */
export const XAI_ASPECT_RATIOS = [
  "1:1",
  "3:4",
  "4:3",
  "9:16",
  "16:9",
  "2:3",
  "3:2",
  "9:19.5",
  "19.5:9",
  "9:20",
  "20:9",
  "1:2",
  "2:1",
  "21:9",
  "5:2",
  "auto",
] as const

export type XaiAspectRatio = (typeof XAI_ASPECT_RATIOS)[number]

const XAI_ASPECT_RATIO_SET = new Set<string>(XAI_ASPECT_RATIOS)

function parseAspectRatioValue(value: string): number | null {
  const match = value.trim().match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/)
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }
  return width / height
}

/**
 * Map any requested ratio onto an xAI-supported enum value.
 * Arbitrary ratios (e.g. contact-sheet `167:295`) snap to the nearest allowed ratio.
 * `match_input_image` becomes `auto`. Unsupported/empty input returns undefined
 * so callers can omit the field.
 */
export function resolveXaiAspectRatio(
  value: string | null | undefined,
): XaiAspectRatio | undefined {
  if (!value) return undefined

  const trimmed = value.trim()
  if (!trimmed) return undefined

  if (trimmed === "match_input_image" || trimmed === "auto") {
    return "auto"
  }

  if (XAI_ASPECT_RATIO_SET.has(trimmed)) {
    return trimmed as XaiAspectRatio
  }

  const target = parseAspectRatioValue(trimmed)
  if (target == null) return undefined

  let best: XaiAspectRatio = "1:1"
  let bestDistance = Number.POSITIVE_INFINITY

  for (const candidate of XAI_ASPECT_RATIOS) {
    if (candidate === "auto") continue
    const ratio = parseAspectRatioValue(candidate)
    if (ratio == null) continue
    const distance = Math.abs(Math.log(ratio / target))
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }

  return best
}
