export const WAVESPEED_ENDPOINT_PREFIX = "wavespeed:"

const WAN_30_ASPECT_RATIOS = new Set(["16:9", "9:16", "1:1", "4:3", "3:4"])

export type Wan30WaveSpeedRequestOptions = {
  prompt: string | null
  imageUrl: string | null
  endImageUrl: string | null
  referenceImageUrls: string[]
  referenceVideoUrls: string[]
  referenceAudioUrls: string[]
  videoUrl: string | null
  aspectRatio: string | null
  duration: unknown
  resolution: string | null
  generateAudio: boolean | null
  enablePromptExpansion: boolean | null
  seed: number | string | null
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
  return Math.min(30, Math.max(2, Math.round(parsed)))
}

function resolution(value: unknown): "480p" | "720p" | "1080p" {
  const raw = text(value)?.toLowerCase()
  if (raw === "480p" || raw === "1080p") return raw
  return "720p"
}

function aspectRatio(value: unknown): string | null {
  const raw = text(value)
  return raw && WAN_30_ASPECT_RATIOS.has(raw) ? raw : null
}

function seed(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 2147483647) return null
  return parsed
}

export function wavespeedStoredEndpoint(endpoint: string): string {
  return `${WAVESPEED_ENDPOINT_PREFIX}${endpoint}`
}

export function parseWaveSpeedEndpoint(stored: string | null | undefined): string | null {
  if (!stored?.startsWith(WAVESPEED_ENDPOINT_PREFIX)) return null
  const endpoint = stored.slice(WAVESPEED_ENDPOINT_PREFIX.length)
  return endpoint.length > 0 ? endpoint : null
}

export function buildWan30WaveSpeedRequest(options: Wan30WaveSpeedRequestOptions): {
  endpoint: string
  input: Record<string, unknown>
} {
  const prompt = text(options.prompt) ?? ""
  const startImage = text(options.imageUrl)
  const endImage = text(options.endImageUrl)
  const referenceImages = uniqueUrls(options.referenceImageUrls, 10)
  const referenceVideos = uniqueUrls([...(options.referenceVideoUrls ?? []), options.videoUrl], 5)
  const referenceAudios = uniqueUrls(options.referenceAudioUrls, 5)
  const ratio = aspectRatio(options.aspectRatio)
  const input: Record<string, unknown> = {
    resolution: resolution(options.resolution),
    duration: durationSeconds(options.duration),
    generate_audio: options.generateAudio !== false,
    enable_prompt_expansion: options.enablePromptExpansion === true,
  }
  const chosenSeed = seed(options.seed)
  if (chosenSeed != null) input.seed = chosenSeed

  if (referenceVideos.length > 0 || referenceAudios.length > 0 || referenceImages.length > 0) {
    const images = uniqueUrls([startImage, endImage, ...referenceImages], 10)
    if (!prompt) throw new Error("Wan 3.0 reference-to-video requires a prompt.")
    return {
      endpoint: "alibaba/wan-3.0/reference-to-video",
      input: {
        ...input,
        aspect_ratio: ratio ?? "16:9",
        prompt,
        ...(images.length > 0 ? { reference_images: images } : {}),
        ...(referenceVideos.length > 0 ? { reference_videos: referenceVideos } : {}),
        ...(referenceAudios.length > 0 ? { reference_audios: referenceAudios } : {}),
      },
    }
  }

  if (startImage) {
    if (!prompt) throw new Error("Wan 3.0 image-to-video requires a prompt.")
    if (ratio) input.aspect_ratio = ratio
    return {
      endpoint: "alibaba/wan-3.0/image-to-video",
      input: {
        ...input,
        prompt,
        image: startImage,
        ...(endImage ? { last_image: endImage } : {}),
      },
    }
  }

  if (!prompt) throw new Error("Wan 3.0 text-to-video requires a prompt.")
  return {
    endpoint: "alibaba/wan-3.0/text-to-video",
    input: {
      ...input,
      aspect_ratio: ratio ?? "16:9",
      prompt,
    },
  }
}
