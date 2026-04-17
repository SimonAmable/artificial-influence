/**
 * Wan 2.7 — single product id `wan-video/wan-2.7` routes to Replicate
 * `wan-video/wan-2.7-t2v` or `wan-video/wan-2.7-i2v`.
 */

export const WAN_27_CANONICAL_ID = "wan-video/wan-2.7" as const
export const WAN_27_T2V_ID = "wan-video/wan-2.7-t2v" as const
export const WAN_27_I2V_ID = "wan-video/wan-2.7-i2v" as const

function pickString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim().length > 0) return v.trim()
  }
  return undefined
}

export interface Wan27BodySlice {
  prompt?: unknown
  image?: unknown
  first_frame_image?: unknown
  last_frame?: unknown
  negative_prompt?: unknown
  audio?: unknown
  [key: string]: unknown
}

/**
 * Build Replicate model id + input for Wan 2.7 (video routes + chat tool).
 */
export function resolveWan27Replicate(
  body: Wan27BodySlice,
  otherParams: Record<string, unknown>,
): { replicateModel: string; replicateInput: Record<string, unknown> } {
  const prompt = typeof body.prompt === "string" ? body.prompt : ""
  const firstFrame = pickString(
    body.image,
    body.first_frame_image,
    otherParams.start_image,
    otherParams.first_frame,
    otherParams.image,
  )
  const lastFrame = pickString(
    body.last_frame,
    body.last_frame_image,
    otherParams.last_frame,
    otherParams.last_frame_image,
    otherParams.end_image,
  )
  const negativePrompt = pickString(body.negative_prompt, otherParams.negative_prompt)
  const audio = pickString(body.audio, otherParams.audio)

  const resolution = pickString(otherParams.resolution) ?? "1080p"
  const durationRaw = otherParams.duration
  const duration =
    typeof durationRaw === "number" && !Number.isNaN(durationRaw)
      ? Math.min(15, Math.max(2, Math.round(durationRaw)))
      : typeof durationRaw === "string"
        ? Math.min(15, Math.max(2, Math.round(Number(durationRaw)) || 5))
        : 5

  const aspectRatio = pickString(otherParams.aspect_ratio) ?? "16:9"

  const enableExpansion =
    otherParams.enable_prompt_expansion !== undefined
      ? Boolean(otherParams.enable_prompt_expansion)
      : true

  const seedRaw = otherParams.seed
  const seed =
    seedRaw !== null && seedRaw !== undefined && seedRaw !== ""
      ? Number(seedRaw)
      : undefined

  if (firstFrame) {
    const replicateInput: Record<string, unknown> = {
      prompt,
      first_frame: firstFrame,
      resolution,
      duration,
      enable_prompt_expansion: enableExpansion,
    }
    if (lastFrame) replicateInput.last_frame = lastFrame
    if (negativePrompt) replicateInput.negative_prompt = negativePrompt
    if (audio) replicateInput.audio = audio
    if (seed !== undefined && !Number.isNaN(seed)) replicateInput.seed = Math.round(seed)

    return { replicateModel: WAN_27_I2V_ID, replicateInput }
  }

  const replicateInput: Record<string, unknown> = {
    prompt,
    aspect_ratio: aspectRatio,
    resolution,
    duration,
    enable_prompt_expansion: enableExpansion,
  }
  if (negativePrompt) replicateInput.negative_prompt = negativePrompt
  if (audio) replicateInput.audio = audio
  if (seed !== undefined && !Number.isNaN(seed)) replicateInput.seed = Math.round(seed)

  return { replicateModel: WAN_27_T2V_ID, replicateInput }
}
