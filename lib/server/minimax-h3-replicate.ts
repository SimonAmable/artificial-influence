const H3_REPLICATE_RATIOS = new Set(["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"])

export type MinimaxH3ReplicateModelId = "minimax/h3-highspeed" | "minimax/h3-lite"

type MinimaxH3ReplicateRequest = {
  prompt: unknown
  image?: unknown
  first_frame_image?: unknown
  last_frame?: unknown
  otherParams: Record<string, unknown>
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function uniqueUrls(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return []
  const urls: string[] = []
  for (const item of value) {
    const url = text(item)
    if (!url || urls.includes(url)) continue
    urls.push(url)
    if (urls.length >= max) break
  }
  return urls
}

function durationSeconds(value: unknown): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
  if (!Number.isFinite(parsed)) return 5
  return Math.min(15, Math.max(4, Math.round(parsed)))
}

function ratio(value: unknown): string {
  const raw = text(value)
  return raw && H3_REPLICATE_RATIOS.has(raw) ? raw : "16:9"
}

function liteResolution(value: unknown): "480P" | "768P" {
  const raw = text(value)?.toLowerCase()
  return raw === "480p" ? "480P" : "768P"
}

export function buildMinimaxH3ReplicateInput(
  model: MinimaxH3ReplicateModelId,
  request: MinimaxH3ReplicateRequest,
): Record<string, unknown> {
  const referenceImages = uniqueUrls(request.otherParams.reference_images, 9)
  const referenceVideos = uniqueUrls(
    request.otherParams.reference_videos ?? request.otherParams.reference_video,
    3,
  )
  const referenceMode = referenceImages.length > 0 || referenceVideos.length > 0
  const firstFrame = referenceMode
    ? null
    : text(request.first_frame_image) ??
      text(request.image) ??
      text(request.otherParams.first_frame_image) ??
      text(request.otherParams.image)
  const lastFrame = referenceMode
    ? null
    : text(request.last_frame) ??
      text(request.otherParams.last_frame_image) ??
      text(request.otherParams.last_frame)
  const hasVisualReference =
    referenceMode || firstFrame != null || lastFrame != null
  const referenceAudios = hasVisualReference
    ? uniqueUrls(request.otherParams.reference_audios ?? request.otherParams.audio, 3)
    : []

  const input: Record<string, unknown> = {
    prompt: text(request.prompt) ?? "",
    duration: durationSeconds(request.otherParams.duration),
    ratio: ratio(request.otherParams.ratio ?? request.otherParams.aspect_ratio),
  }

  if (firstFrame) input.first_frame_image = firstFrame
  if (lastFrame) input.last_frame_image = lastFrame
  if (referenceImages.length > 0) input.reference_image_urls = referenceImages
  if (referenceVideos.length > 0) input.reference_video_urls = referenceVideos
  if (referenceAudios.length > 0) input.reference_audio_urls = referenceAudios
  if (model === "minimax/h3-lite") {
    input.resolution = liteResolution(request.otherParams.resolution)
  }

  return input
}
