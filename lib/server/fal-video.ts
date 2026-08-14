import { fal } from "@fal-ai/client"
import { getFalWebhookUrl } from "@/lib/server/fal-webhook-url"

export const HAPPY_HORSE_CANONICAL_ID = "alibaba/happy-horse/v1.1" as const
export const HAPPY_HORSE_LEGACY_ID = "alibaba/happy-horse" as const
export const GEMINI_OMNI_FLASH_CANONICAL_ID = "google/gemini-omni-flash" as const
export const MINIMAX_H3_CANONICAL_ID = "minimax/h3" as const

export const FAL_HAPPY_HORSE_T2V = "alibaba/happy-horse/v1.1/text-to-video" as const
export const FAL_HAPPY_HORSE_I2V = "alibaba/happy-horse/v1.1/image-to-video" as const
export const FAL_HAPPY_HORSE_REFERENCE = "alibaba/happy-horse/v1.1/reference-to-video" as const
export const FAL_GEMINI_OMNI_FLASH_T2V = "google/gemini-omni-flash" as const
export const FAL_GEMINI_OMNI_FLASH_I2V = "google/gemini-omni-flash/image-to-video" as const
export const FAL_GEMINI_OMNI_FLASH_REFERENCE = "google/gemini-omni-flash/reference-to-video" as const
export const FAL_GEMINI_OMNI_FLASH_EDIT = "google/gemini-omni-flash/edit" as const
export const FAL_MINIMAX_H3_T2V = "minimax/h3/text-to-video" as const
export const FAL_MINIMAX_H3_I2V = "minimax/h3/image-to-video" as const
export const FAL_MINIMAX_H3_REFERENCE = "minimax/h3/reference-to-video" as const
export const SEEDANCE_2_5_CANONICAL_ID = "bytedance/seedance-2.5" as const
export const FAL_SEEDANCE_2_5_REFERENCE = "bytedance/seedance-2.5/reference-to-video" as const

export const MINIMAX_H3_ENDPOINT_IDS = [
  FAL_MINIMAX_H3_T2V,
  FAL_MINIMAX_H3_I2V,
  FAL_MINIMAX_H3_REFERENCE,
] as const

export type SupportedFalVideoModelIdentifier =
  | typeof HAPPY_HORSE_CANONICAL_ID
  | typeof GEMINI_OMNI_FLASH_CANONICAL_ID
  | typeof MINIMAX_H3_CANONICAL_ID

export type FalVideoEndpoint =
  | typeof FAL_HAPPY_HORSE_T2V
  | typeof FAL_HAPPY_HORSE_I2V
  | typeof FAL_HAPPY_HORSE_REFERENCE
  | typeof FAL_GEMINI_OMNI_FLASH_T2V
  | typeof FAL_GEMINI_OMNI_FLASH_I2V
  | typeof FAL_GEMINI_OMNI_FLASH_REFERENCE
  | typeof FAL_GEMINI_OMNI_FLASH_EDIT
  | typeof FAL_MINIMAX_H3_T2V
  | typeof FAL_MINIMAX_H3_I2V
  | typeof FAL_MINIMAX_H3_REFERENCE
  | typeof FAL_SEEDANCE_2_5_REFERENCE

export type MinimaxH3Resolution = "480P" | "768P" | "2K" | "4K"

export interface FalVideoRequestOptions {
  aspectRatio?: string | null
  duration?: number | string | null
  enablePromptExpansion?: boolean | null
  enableSafetyChecker?: boolean | null
  endImageUrl?: string | null
  generateAudio?: boolean | null
  imageUrl?: string | null
  modelIdentifier: string
  prompt?: string | null
  referenceAudioUrls?: string[]
  referenceImageUrls: string[]
  referenceVideoUrls?: string[]
  resolution?: "720p" | "1080p" | string | null
  seed?: number | string | null
  videoUrl?: string | null
}

const HAPPY_HORSE_ASPECT_RATIOS = new Set([
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "3:4",
  "21:9",
  "9:21",
  "5:4",
  "4:5",
])

const MINIMAX_H3_ASPECT_RATIOS = new Set([
  "21:9",
  "16:9",
  "4:3",
  "1:1",
  "3:4",
  "9:16",
])

const MINIMAX_H3_REFERENCE_ASPECT_RATIOS = new Set([
  ...MINIMAX_H3_ASPECT_RATIOS,
  "adaptive",
])

const MAX_MINIMAX_H3_REFERENCE_IMAGES = 9
const MAX_MINIMAX_H3_REFERENCE_VIDEOS = 3
const MAX_MINIMAX_H3_REFERENCE_AUDIOS = 3
const MAX_MINIMAX_H3_REFERENCE_FILES = 12
const MAX_SEEDANCE_2_5_REFERENCE_IMAGES = 30
const MAX_SEEDANCE_2_5_REFERENCE_VIDEOS = 10
const MAX_SEEDANCE_2_5_REFERENCE_AUDIOS = 10
const MAX_SEEDANCE_2_5_REFERENCE_FILES = 50

const SEEDANCE_2_5_ASPECT_RATIOS = new Set([
  "auto",
  "21:9",
  "16:9",
  "4:3",
  "1:1",
  "3:4",
  "9:16",
])

function configureFal() {
  const key = process.env.FAL_KEY
  if (!key) {
    throw new Error("FAL_KEY is not configured.")
  }

  fal.config({ credentials: key })
}

function pickString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function pickUniqueUrls(values: Array<string | null | undefined>, limit: number): string[] {
  const seen = new Set<string>()
  const urls: string[] = []
  for (const value of values) {
    const url = pickString(value)
    if (!url || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
    if (urls.length >= limit) break
  }
  return urls
}

function pickBoolean(value: boolean | null | undefined, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

function normalizeDuration(value: FalVideoRequestOptions["duration"]): number {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : 5

  if (!Number.isFinite(numeric)) return 5
  return Math.min(15, Math.max(3, Math.round(numeric)))
}

function normalizeGeminiOmniFlashDuration(value: FalVideoRequestOptions["duration"]): number {
  const numeric = normalizeDuration(value)
  return Math.min(10, Math.max(3, numeric === 5 ? 8 : numeric))
}

function normalizeMinimaxH3Duration(value: FalVideoRequestOptions["duration"]): number {
  const numeric = normalizeDuration(value)
  return Math.min(15, Math.max(5, numeric))
}

function normalizeMinimaxH3Resolution(
  value: FalVideoRequestOptions["resolution"],
): MinimaxH3Resolution {
  const raw = pickString(value)?.toLowerCase().replace(/\s+/g, "") ?? "2k"
  switch (raw) {
    case "480p":
    case "480":
      return "480P"
    case "768p":
    case "768":
    case "720p":
    case "720":
      return "768P"
    case "4k":
    case "2160p":
    case "2160":
      return "4K"
    case "2k":
    case "1080p":
    case "1080":
    case "1440p":
      return "2K"
    default:
      return "2K"
  }
}

function normalizeMinimaxH3AspectRatio(
  value: FalVideoRequestOptions["aspectRatio"],
  allowAdaptive: boolean,
): string {
  const aspectRatio = pickString(value) ?? (allowAdaptive ? "adaptive" : "16:9")
  const allowed = allowAdaptive ? MINIMAX_H3_REFERENCE_ASPECT_RATIOS : MINIMAX_H3_ASPECT_RATIOS
  if (allowed.has(aspectRatio)) {
    return aspectRatio
  }
  return allowAdaptive ? "adaptive" : "16:9"
}

function normalizeResolution(
  value: FalVideoRequestOptions["resolution"],
): "720p" | "1080p" {
  return value === "720p" ? "720p" : "1080p"
}

function normalizeSeed(value: FalVideoRequestOptions["seed"]): number | undefined {
  if (value === null || value === undefined || value === "") return undefined
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return undefined
  return Math.max(0, Math.min(2147483647, Math.round(numeric)))
}

function normalizeHappyHorseAspectRatio(value: FalVideoRequestOptions["aspectRatio"]): string {
  const aspectRatio = pickString(value) ?? "16:9"
  if (HAPPY_HORSE_ASPECT_RATIOS.has(aspectRatio)) {
    return aspectRatio
  }
  return "16:9"
}

function normalizeGeminiOmniFlashAspectRatio(
  value: FalVideoRequestOptions["aspectRatio"],
): "16:9" | "9:16" {
  const aspectRatio = pickString(value) ?? "16:9"
  return aspectRatio === "9:16" ? "9:16" : "16:9"
}

export function isHappyHorseModelIdentifier(modelIdentifier: string): boolean {
  return (
    modelIdentifier === HAPPY_HORSE_CANONICAL_ID ||
    modelIdentifier === HAPPY_HORSE_LEGACY_ID
  )
}

export function isMinimaxH3ModelIdentifier(modelIdentifier: string): boolean {
  return (
    modelIdentifier === MINIMAX_H3_CANONICAL_ID ||
    (MINIMAX_H3_ENDPOINT_IDS as readonly string[]).includes(modelIdentifier)
  )
}

export function isSeedance25FalModelIdentifier(modelIdentifier: string): boolean {
  return modelIdentifier === SEEDANCE_2_5_CANONICAL_ID
}

export function shouldRouteSeedance25ToFal(options: {
  hasReferenceVideo: boolean
  modelIdentifier: string
}): boolean {
  return isSeedance25FalModelIdentifier(options.modelIdentifier) && options.hasReferenceVideo
}

export function normalizeFalVideoModelIdentifier(
  modelIdentifier: string,
): SupportedFalVideoModelIdentifier | null {
  if (isHappyHorseModelIdentifier(modelIdentifier)) {
    return HAPPY_HORSE_CANONICAL_ID
  }
  if (modelIdentifier === GEMINI_OMNI_FLASH_CANONICAL_ID) {
    return GEMINI_OMNI_FLASH_CANONICAL_ID
  }
  if (isMinimaxH3ModelIdentifier(modelIdentifier)) {
    return MINIMAX_H3_CANONICAL_ID
  }
  return null
}

export function isSupportedFalVideoModel(
  modelIdentifier: string,
): modelIdentifier is SupportedFalVideoModelIdentifier {
  return normalizeFalVideoModelIdentifier(modelIdentifier) !== null
}

function buildHappyHorseFalVideoRequest(
  options: FalVideoRequestOptions,
): {
  endpointId: FalVideoEndpoint
  input: Record<string, unknown>
  mode: "text-to-video" | "image-to-video" | "reference-to-video"
} {
  const prompt = pickString(options.prompt)
  const imageUrl = pickString(options.imageUrl)
  const referenceImageUrls = options.referenceImageUrls
    .map((url) => pickString(url))
    .filter((url): url is string => Boolean(url))
    .slice(0, 9)

  const baseInput: Record<string, unknown> = {
    duration: normalizeDuration(options.duration),
    resolution: normalizeResolution(options.resolution),
    enable_safety_checker: false,
  }

  const seed = normalizeSeed(options.seed)
  if (seed !== undefined) {
    baseInput.seed = seed
  }

  if (referenceImageUrls.length > 0) {
    if (!prompt) {
      throw new Error("Happy Horse reference-to-video requires a prompt.")
    }

    return {
      endpointId: FAL_HAPPY_HORSE_REFERENCE,
      mode: "reference-to-video",
      input: {
        ...baseInput,
        prompt,
        image_urls: referenceImageUrls,
        aspect_ratio: normalizeHappyHorseAspectRatio(options.aspectRatio),
      },
    }
  }

  if (imageUrl) {
    const input: Record<string, unknown> = {
      ...baseInput,
      image_url: imageUrl,
    }

    if (prompt) {
      input.prompt = prompt
    }

    return {
      endpointId: FAL_HAPPY_HORSE_I2V,
      mode: "image-to-video",
      input,
    }
  }

  if (!prompt) {
    throw new Error("Happy Horse text-to-video requires a prompt.")
  }

  return {
    endpointId: FAL_HAPPY_HORSE_T2V,
    mode: "text-to-video",
    input: {
      ...baseInput,
      prompt,
      aspect_ratio: normalizeHappyHorseAspectRatio(options.aspectRatio),
    },
  }
}

function buildGeminiOmniFlashFalVideoRequest(
  options: FalVideoRequestOptions,
): {
  endpointId: FalVideoEndpoint
  input: Record<string, unknown>
  mode: "text-to-video" | "image-to-video" | "reference-to-video" | "video-to-video"
} {
  const prompt = pickString(options.prompt)
  const imageUrl = pickString(options.imageUrl)
  const videoUrl = pickString(options.videoUrl)
  const referenceImageUrls = options.referenceImageUrls
    .map((url) => pickString(url))
    .filter((url): url is string => Boolean(url))
    .slice(0, 9)

  const baseInput: Record<string, unknown> = {
    aspect_ratio: normalizeGeminiOmniFlashAspectRatio(options.aspectRatio),
    duration: normalizeGeminiOmniFlashDuration(options.duration),
  }

  if (videoUrl) {
    if (!prompt) {
      throw new Error("Gemini Omni Flash video editing requires a prompt.")
    }

    return {
      endpointId: FAL_GEMINI_OMNI_FLASH_EDIT,
      mode: "video-to-video",
      input: {
        prompt,
        video_url: videoUrl,
      },
    }
  }

  if (referenceImageUrls.length > 0) {
    if (!prompt) {
      throw new Error("Gemini Omni Flash reference-to-video requires a prompt.")
    }

    return {
      endpointId: FAL_GEMINI_OMNI_FLASH_REFERENCE,
      mode: "reference-to-video",
      input: {
        ...baseInput,
        prompt,
        image_urls: referenceImageUrls,
      },
    }
  }

  if (imageUrl) {
    if (!prompt) {
      throw new Error("Gemini Omni Flash image-to-video requires a prompt.")
    }

    return {
      endpointId: FAL_GEMINI_OMNI_FLASH_I2V,
      mode: "image-to-video",
      input: {
        ...baseInput,
        prompt,
        image_url: imageUrl,
      },
    }
  }

  if (!prompt) {
    throw new Error("Gemini Omni Flash text-to-video requires a prompt.")
  }

  return {
    endpointId: FAL_GEMINI_OMNI_FLASH_T2V,
    mode: "text-to-video",
    input: {
      ...baseInput,
      prompt,
    },
  }
}

function buildMinimaxH3FalVideoRequest(
  options: FalVideoRequestOptions,
): {
  endpointId: FalVideoEndpoint
  input: Record<string, unknown>
  mode: "text-to-video" | "image-to-video" | "reference-to-video"
} {
  const prompt = pickString(options.prompt)
  const startImageUrl = pickString(options.imageUrl)
  const endImageUrl = pickString(options.endImageUrl)
  const referenceImageUrls = pickUniqueUrls(
    [startImageUrl, endImageUrl, ...options.referenceImageUrls],
    MAX_MINIMAX_H3_REFERENCE_IMAGES,
  )
  const referenceVideoUrls = pickUniqueUrls(
    [...(options.referenceVideoUrls ?? []), options.videoUrl],
    MAX_MINIMAX_H3_REFERENCE_VIDEOS,
  )
  const referenceAudioUrls = pickUniqueUrls(
    options.referenceAudioUrls ?? [],
    MAX_MINIMAX_H3_REFERENCE_AUDIOS,
  )

  while (
    referenceImageUrls.length + referenceVideoUrls.length + referenceAudioUrls.length >
    MAX_MINIMAX_H3_REFERENCE_FILES
  ) {
    if (referenceAudioUrls.length > 0) {
      referenceAudioUrls.pop()
      continue
    }
    if (referenceVideoUrls.length > 0) {
      referenceVideoUrls.pop()
      continue
    }
    referenceImageUrls.pop()
  }

  const hasReferenceInputs =
    options.referenceImageUrls.some((url) => Boolean(pickString(url))) ||
    referenceVideoUrls.length > 0 ||
    referenceAudioUrls.length > 0

  const baseInput: Record<string, unknown> = {
    duration: normalizeMinimaxH3Duration(options.duration),
    resolution: normalizeMinimaxH3Resolution(options.resolution),
    enable_prompt_expansion: pickBoolean(options.enablePromptExpansion, true),
    enable_safety_checker: false,
  }

  if (hasReferenceInputs) {
    if (!prompt) {
      throw new Error("MiniMax H3 reference-to-video requires a prompt.")
    }
    if (referenceAudioUrls.length > 0 && referenceImageUrls.length === 0 && referenceVideoUrls.length === 0) {
      throw new Error(
        "MiniMax H3 reference audio requires at least one reference image or video.",
      )
    }
    if (referenceImageUrls.length === 0 && referenceVideoUrls.length === 0) {
      throw new Error("MiniMax H3 reference-to-video requires at least one image or video reference.")
    }

    const input: Record<string, unknown> = {
      ...baseInput,
      prompt,
      aspect_ratio: normalizeMinimaxH3AspectRatio(options.aspectRatio, true),
    }
    if (referenceImageUrls.length > 0) {
      input.reference_image_urls = referenceImageUrls
    }
    if (referenceVideoUrls.length > 0) {
      input.reference_video_urls = referenceVideoUrls
    }
    if (referenceAudioUrls.length > 0) {
      input.reference_audio_urls = referenceAudioUrls
    }

    return {
      endpointId: FAL_MINIMAX_H3_REFERENCE,
      mode: "reference-to-video",
      input,
    }
  }

  const firstFrameUrl = startImageUrl ?? endImageUrl
  if (firstFrameUrl) {
    if (!prompt) {
      throw new Error("MiniMax H3 image-to-video requires a prompt.")
    }

    const input: Record<string, unknown> = {
      ...baseInput,
      prompt,
      image_url: firstFrameUrl,
    }
    if (startImageUrl && endImageUrl && endImageUrl !== startImageUrl) {
      input.end_image_url = endImageUrl
    }

    return {
      endpointId: FAL_MINIMAX_H3_I2V,
      mode: "image-to-video",
      input,
    }
  }

  if (!prompt) {
    throw new Error("MiniMax H3 text-to-video requires a prompt.")
  }

  return {
    endpointId: FAL_MINIMAX_H3_T2V,
    mode: "text-to-video",
    input: {
      ...baseInput,
      prompt,
      aspect_ratio: normalizeMinimaxH3AspectRatio(options.aspectRatio, false),
    },
  }
}

function convertSeedancePromptTagsForFal(prompt: string): string {
  return prompt.replace(/\[(Image|Video|Audio)(\d+)\]/gi, (_match, kind: string, index: string) => {
    const label = kind.charAt(0).toUpperCase() + kind.slice(1).toLowerCase()
    return `@${label}${index}`
  })
}

function normalizeSeedance25FalDuration(value: FalVideoRequestOptions["duration"]): string {
  if (value === null || value === undefined || value === "") return "auto"
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase()
    if (trimmed === "auto" || trimmed === "-1") return "auto"
    const numeric = Number(trimmed)
    if (!Number.isFinite(numeric)) return "auto"
    if (numeric <= 0) return "auto"
    return String(Math.min(30, Math.max(4, Math.round(numeric))))
  }
  if (!Number.isFinite(value) || value <= 0) return "auto"
  return String(Math.min(30, Math.max(4, Math.round(value))))
}

function normalizeSeedance25FalAspectRatio(value: FalVideoRequestOptions["aspectRatio"]): string {
  const aspectRatio = pickString(value)
  if (!aspectRatio || aspectRatio === "adaptive") return "auto"
  if (SEEDANCE_2_5_ASPECT_RATIOS.has(aspectRatio)) return aspectRatio
  return "auto"
}

function normalizeSeedance25FalResolution(
  value: FalVideoRequestOptions["resolution"],
): "480p" | "720p" {
  const raw = pickString(value)?.toLowerCase() ?? "720p"
  return raw === "480p" || raw === "480" ? "480p" : "720p"
}

function buildSeedance25FalReferenceRequest(options: FalVideoRequestOptions): {
  endpointId: FalVideoEndpoint
  input: Record<string, unknown>
  mode: "reference-to-video"
} {
  const prompt = pickString(options.prompt)
  if (!prompt) {
    throw new Error("Seedance 2.5 reference-to-video requires a prompt.")
  }

  const imageUrls = pickUniqueUrls(
    [options.imageUrl, options.endImageUrl, ...options.referenceImageUrls],
    MAX_SEEDANCE_2_5_REFERENCE_IMAGES,
  )
  const videoUrls = pickUniqueUrls(
    [...(options.referenceVideoUrls ?? []), options.videoUrl],
    MAX_SEEDANCE_2_5_REFERENCE_VIDEOS,
  )
  const audioUrls = pickUniqueUrls(
    options.referenceAudioUrls ?? [],
    MAX_SEEDANCE_2_5_REFERENCE_AUDIOS,
  )

  while (imageUrls.length + videoUrls.length + audioUrls.length > MAX_SEEDANCE_2_5_REFERENCE_FILES) {
    if (audioUrls.length > 0) {
      audioUrls.pop()
      continue
    }
    if (imageUrls.length > 0) {
      imageUrls.pop()
      continue
    }
    videoUrls.pop()
  }

  if (videoUrls.length === 0) {
    throw new Error("Seedance 2.5 Fal routing requires at least one reference video.")
  }

  const input: Record<string, unknown> = {
    prompt: convertSeedancePromptTagsForFal(prompt),
    video_urls: videoUrls,
    duration: normalizeSeedance25FalDuration(options.duration),
    resolution: normalizeSeedance25FalResolution(options.resolution),
    aspect_ratio: normalizeSeedance25FalAspectRatio(options.aspectRatio),
    generate_audio: pickBoolean(options.generateAudio, true),
  }
  if (imageUrls.length > 0) {
    input.image_urls = imageUrls
  }
  if (audioUrls.length > 0) {
    input.audio_urls = audioUrls
  }

  return {
    endpointId: FAL_SEEDANCE_2_5_REFERENCE,
    mode: "reference-to-video",
    input,
  }
}

export function buildFalVideoRequest(options: FalVideoRequestOptions): {
  endpointId: FalVideoEndpoint
  input: Record<string, unknown>
  mode: "text-to-video" | "image-to-video" | "reference-to-video" | "video-to-video"
} {
  if (isSeedance25FalModelIdentifier(options.modelIdentifier)) {
    return buildSeedance25FalReferenceRequest(options)
  }

  const normalizedModel = normalizeFalVideoModelIdentifier(options.modelIdentifier)
  if (!normalizedModel) {
    throw new Error(`Unsupported Fal video model: ${options.modelIdentifier}`)
  }

  switch (normalizedModel) {
    case GEMINI_OMNI_FLASH_CANONICAL_ID:
      return buildGeminiOmniFlashFalVideoRequest(options)
    case MINIMAX_H3_CANONICAL_ID:
      return buildMinimaxH3FalVideoRequest(options)
    case HAPPY_HORSE_CANONICAL_ID:
      return buildHappyHorseFalVideoRequest(options)
    default: {
      const _exhaustive: never = normalizedModel
      throw new Error(`Unsupported Fal video model: ${_exhaustive}`)
    }
  }
}

export async function submitFalVideoQueue(
  endpointId: FalVideoEndpoint,
  input: Record<string, unknown>,
): Promise<{ requestId: string; endpointId: FalVideoEndpoint }> {
  configureFal()
  const webhookUrl = getFalWebhookUrl()
  const submitted = await fal.queue.submit(endpointId, {
    input: input as never,
    ...(webhookUrl ? { webhookUrl } : {}),
  })
  const requestId = submitted.request_id
  if (!requestId) {
    throw new Error("Fal queue submit did not return request_id")
  }

  return { requestId, endpointId }
}
