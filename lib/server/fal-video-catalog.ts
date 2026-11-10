export interface CatalogFalVideoRequestOptions {
  aspectRatio?: string | null
  duration?: number | string | null
  enablePromptExpansion?: boolean | null
  endImageUrl?: string | null
  generateAudio?: boolean | null
  imageUrl?: string | null
  modelIdentifier: string
  prompt?: string | null
  referenceImageUrls?: string[]
  referenceVideoUrls?: string[]
  resolution?: string | null
  videoUrl?: string | null
}

export const KLING_V4_CANONICAL_ID = "kling/v4" as const
export const KLING_V4_FLASH_CANONICAL_ID = "kling/v4/flash" as const
export const WAN_30_CANONICAL_ID = "alibaba/wan-3.0" as const
export const WAN_30_PRIME_CANONICAL_ID = "alibaba/wan-3.0-prime" as const
export const FLUX_3_MAX_CANONICAL_ID = "blackforestlabs/flux-3-max" as const
export const MINIMAX_H3_MAX_CANONICAL_ID = "minimax/h3-max" as const
export const MINIMAX_H3_MAX_TURBO_CANONICAL_ID = "minimax/h3-max-turbo" as const

const CATALOG_IDS = [
  KLING_V4_CANONICAL_ID,
  KLING_V4_FLASH_CANONICAL_ID,
  WAN_30_CANONICAL_ID,
  WAN_30_PRIME_CANONICAL_ID,
  FLUX_3_MAX_CANONICAL_ID,
  MINIMAX_H3_MAX_CANONICAL_ID,
  MINIMAX_H3_MAX_TURBO_CANONICAL_ID,
] as const

export type CatalogFalVideoModelId = (typeof CATALOG_IDS)[number]

export type CatalogFalVideoEndpoint =
  | "kling/v4/text-to-video"
  | "kling/v4/image-to-video"
  | "kling/v4/flash/text-to-video"
  | "kling/v4/flash/image-to-video"
  | "alibaba/wan-3.0/text-to-video"
  | "alibaba/wan-3.0/image-to-video"
  | "alibaba/wan-3.0/reference-to-video"
  | "alibaba/wan-3.0-prime/text-to-video"
  | "alibaba/wan-3.0-prime/image-to-video"
  | "alibaba/wan-3.0-prime/reference-to-video"
  | "blackforestlabs/flux-3-max/text-to-video"
  | "blackforestlabs/flux-3-max/image-to-video"
  | "minimax/h3-max/text-to-video"
  | "minimax/h3-max-turbo/text-to-video"

const CATALOG_ID_SET = new Set<string>(CATALOG_IDS)

export function isCatalogFalVideoModel(
  modelIdentifier: string,
): modelIdentifier is CatalogFalVideoModelId {
  return CATALOG_ID_SET.has(modelIdentifier)
}

function uniqueMediaUrls(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const urls: string[] = []
  for (const value of values) {
    const url = pickString(value)
    if (!url || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
  }
  return urls
}

function pickString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function clampDuration(value: CatalogFalVideoRequestOptions["duration"], min: number, max: number, fallback: number): number {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : fallback
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, Math.round(numeric)))
}

function pickAspect(value: CatalogFalVideoRequestOptions["aspectRatio"], allowed: readonly string[], fallback: string): string {
  const aspect = pickString(value)
  if (aspect && allowed.includes(aspect)) return aspect
  return fallback
}

export function buildCatalogFalVideoRequest(options: CatalogFalVideoRequestOptions): {
  endpointId: CatalogFalVideoEndpoint
  input: Record<string, unknown>
  mode: "text-to-video" | "image-to-video" | "reference-to-video"
} {
  const id = options.modelIdentifier
  const prompt = pickString(options.prompt)
  const startImage = pickString(options.imageUrl)
  const endImage = pickString(options.endImageUrl)

  if (id === KLING_V4_CANONICAL_ID || id === KLING_V4_FLASH_CANONICAL_ID) {
    const flash = id === KLING_V4_FLASH_CANONICAL_ID
    const duration = clampDuration(options.duration, 3, flash ? 20 : 30, 5)
    const resolution = flash
      ? "720p"
      : pickString(options.resolution)?.toLowerCase() === "720p"
        ? "720p"
        : "1080p"
    const aspectRatio = pickAspect(options.aspectRatio, ["16:9", "9:16", "1:1", "21:9"], "16:9")
    if (startImage) {
      const input: Record<string, unknown> = {
        start_image_url: startImage,
        duration,
        resolution,
        aspect_ratio: aspectRatio,
      }
      if (prompt) input.prompt = prompt
      if (endImage) input.end_image_url = endImage
      return {
        endpointId: flash ? "kling/v4/flash/image-to-video" : "kling/v4/image-to-video",
        mode: "image-to-video",
        input,
      }
    }
    if (!prompt) {
      throw new Error(flash ? "Kling 4.0 Flash text-to-video requires a prompt." : "Kling 4.0 text-to-video requires a prompt.")
    }
    return {
      endpointId: flash ? "kling/v4/flash/text-to-video" : "kling/v4/text-to-video",
      mode: "text-to-video",
      input: { prompt, duration, resolution, aspect_ratio: aspectRatio },
    }
  }

  if (id === WAN_30_CANONICAL_ID || id === WAN_30_PRIME_CANONICAL_ID) {
    const prime = id === WAN_30_PRIME_CANONICAL_ID
    const rawResolution = pickString(options.resolution)?.toLowerCase()
    const resolution = rawResolution === "480p" || rawResolution === "1080p" ? rawResolution : "720p"
    const duration = clampDuration(options.duration, 2, 30, 5)
    const aspectRatio = pickAspect(
      options.aspectRatio,
      ["adaptive", "16:9", "4:3", "1:1", "3:4", "9:16"],
      "adaptive",
    )
    const shared = {
      resolution,
      aspect_ratio: aspectRatio,
      duration,
      audio: options.generateAudio !== false,
      enable_prompt_expansion: options.enablePromptExpansion !== false,
      enable_safety_checker: false,
    }
    const referenceVideos = uniqueMediaUrls([
      ...(options.referenceVideoUrls ?? []),
      options.videoUrl,
    ]).slice(0, 5)
    if (referenceVideos.length > 0) {
      const referenceImages = uniqueMediaUrls([
        startImage,
        endImage,
        ...(options.referenceImageUrls ?? []),
      ]).slice(0, 10)
      return {
        endpointId: prime
          ? "alibaba/wan-3.0-prime/reference-to-video"
          : "alibaba/wan-3.0/reference-to-video",
        mode: "reference-to-video",
        input: {
          ...shared,
          ...(prompt ? { prompt } : {}),
          reference_video_urls: referenceVideos,
          ...(referenceImages.length > 0 ? { reference_image_urls: referenceImages } : {}),
        },
      }
    }
    if (startImage) {
      return {
        endpointId: prime ? "alibaba/wan-3.0-prime/image-to-video" : "alibaba/wan-3.0/image-to-video",
        mode: "image-to-video",
        input: {
          ...shared,
          ...(prompt ? { prompt } : {}),
          start_image_url: startImage,
          ...(endImage ? { end_image_url: endImage } : {}),
        },
      }
    }
    if (!prompt) {
      throw new Error(prime ? "Wan 3.0 Prime text-to-video requires a prompt." : "Wan 3.0 text-to-video requires a prompt.")
    }
    return {
      endpointId: prime ? "alibaba/wan-3.0-prime/text-to-video" : "alibaba/wan-3.0/text-to-video",
      mode: "text-to-video",
      input: { ...shared, prompt },
    }
  }

  if (id === FLUX_3_MAX_CANONICAL_ID) {
    if (!prompt) {
      throw new Error("FLUX 3 Max requires a prompt.")
    }
    const duration = String(clampDuration(options.duration, 5, 20, 5))
    const rawResolution = pickString(options.resolution)
    const resolution =
      rawResolution === "1080p" || rawResolution === "2K" || rawResolution === "4K" ? rawResolution : "720p"
    const aspectRatio = pickAspect(
      options.aspectRatio,
      ["auto", "21:9", "2:1", "16:9", "4:3", "1:1", "3:4", "9:16"],
      "auto",
    )
    const input: Record<string, unknown> = {
      prompt,
      duration,
      resolution,
      aspect_ratio: aspectRatio,
      generate_audio: options.generateAudio !== false,
      reasoning_level: "high",
    }
    if (startImage) {
      input.image_url = startImage
      if (endImage) input.end_image_url = endImage
      return {
        endpointId: "blackforestlabs/flux-3-max/image-to-video",
        mode: "image-to-video",
        input,
      }
    }
    return {
      endpointId: "blackforestlabs/flux-3-max/text-to-video",
      mode: "text-to-video",
      input,
    }
  }

  if (id === MINIMAX_H3_MAX_CANONICAL_ID || id === MINIMAX_H3_MAX_TURBO_CANONICAL_ID) {
    if (startImage || endImage) {
      throw new Error("MiniMax H3 Max and Turbo on fal are text-to-video. Remove the start frame, or use MiniMax H3 for image-to-video.")
    }
    if (!prompt) {
      throw new Error("MiniMax H3 Max text-to-video requires a prompt.")
    }
    const rawResolution = pickString(options.resolution)?.toUpperCase()
    const resolution = rawResolution === "480P" || rawResolution === "1080P" ? rawResolution : "768P"
    return {
      endpointId:
        id === MINIMAX_H3_MAX_TURBO_CANONICAL_ID
          ? "minimax/h3-max-turbo/text-to-video"
          : "minimax/h3-max/text-to-video",
      mode: "text-to-video",
      input: {
        prompt,
        duration: clampDuration(options.duration, 2, 15, 5),
        resolution,
        aspect_ratio: pickAspect(options.aspectRatio, ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], "16:9"),
        prompt_expansion_mode: "balanced",
        enable_safety_checker: false,
      },
    }
  }

  throw new Error(`Unsupported Fal video model: ${id}`)
}
