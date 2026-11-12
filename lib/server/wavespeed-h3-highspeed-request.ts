const H3_HIGHSPEED_ASPECT_RATIOS = new Set(["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"])

export type H3HighspeedWaveSpeedRequestOptions = {
  prompt: string | null
  imageUrl: string | null
  endImageUrl: string | null
  referenceImageUrls: string[]
  referenceVideoUrls: string[]
  referenceAudioUrls: string[]
  videoUrl: string | null
  aspectRatio: string | null
  duration: unknown
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function uniqueUrls(values: Array<string | null | undefined>, max: number): string[] {
  const urls: string[] = []
  for (const value of values) {
    const url = text(value)
    if (!url || urls.includes(url)) continue
    urls.push(url)
    if (urls.length >= max) break
  }
  return urls
}

function durationSeconds(value: unknown): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN
  if (!Number.isFinite(parsed)) return 5
  return Math.min(15, Math.max(4, Math.round(parsed)))
}

function aspectRatio(value: unknown): string {
  const raw = text(value)
  return raw && H3_HIGHSPEED_ASPECT_RATIOS.has(raw) ? raw : "16:9"
}

export function buildH3HighspeedWaveSpeedRequest(options: H3HighspeedWaveSpeedRequestOptions): {
  endpoint: string
  input: Record<string, unknown>
} {
  const prompt = text(options.prompt) ?? ""
  if (!prompt) throw new Error("MiniMax H3 Highspeed requires a prompt.")
  const startImage = text(options.imageUrl)
  const endImage = text(options.endImageUrl)
  const referenceImages = uniqueUrls(options.referenceImageUrls, 9)
  const referenceVideos = uniqueUrls([...(options.referenceVideoUrls ?? []), options.videoUrl], 3)
  const referenceAudios = uniqueUrls(options.referenceAudioUrls, 3)
  const duration = durationSeconds(options.duration)

  if (referenceVideos.length > 0 || referenceAudios.length > 0 || referenceImages.length > 0) {
    const images = uniqueUrls([startImage, endImage, ...referenceImages], 9)
    if (images.length === 0 && referenceVideos.length === 0) {
      throw new Error("MiniMax H3 Highspeed reference audio requires an image or video.")
    }
    return {
      endpoint: "minimax/h3-highspeed/reference-to-video",
      input: {
        prompt,
        aspect_ratio: aspectRatio(options.aspectRatio),
        resolution: "768p",
        duration,
        ...(images.length > 0 ? { reference_images: images } : {}),
        ...(referenceVideos.length > 0 ? { reference_videos: referenceVideos } : {}),
        ...(referenceAudios.length > 0 ? { reference_audios: referenceAudios } : {}),
      },
    }
  }

  if (startImage) {
    return {
      endpoint: "minimax/h3-highspeed/image-to-video",
      input: {
        prompt,
        image: startImage,
        resolution: "768p",
        duration,
        ...(endImage ? { last_image: endImage } : {}),
      },
    }
  }

  return {
    endpoint: "minimax/h3-highspeed/text-to-video",
    input: {
      prompt,
      aspect_ratio: aspectRatio(options.aspectRatio),
      resolution: "768p",
      duration,
    },
  }
}
