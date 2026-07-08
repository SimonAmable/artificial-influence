import { fal } from "@fal-ai/client"
import { getFalWebhookUrl } from "@/lib/server/fal-webhook-url"

export const HAPPY_HORSE_CANONICAL_ID = "alibaba/happy-horse/v1.1" as const
export const HAPPY_HORSE_LEGACY_ID = "alibaba/happy-horse" as const
export const GEMINI_OMNI_FLASH_CANONICAL_ID = "google/gemini-omni-flash" as const

export const FAL_HAPPY_HORSE_T2V = "alibaba/happy-horse/v1.1/text-to-video" as const
export const FAL_HAPPY_HORSE_I2V = "alibaba/happy-horse/v1.1/image-to-video" as const
export const FAL_HAPPY_HORSE_REFERENCE = "alibaba/happy-horse/v1.1/reference-to-video" as const
export const FAL_GEMINI_OMNI_FLASH_T2V = "google/gemini-omni-flash" as const
export const FAL_GEMINI_OMNI_FLASH_I2V = "google/gemini-omni-flash/image-to-video" as const
export const FAL_GEMINI_OMNI_FLASH_REFERENCE = "google/gemini-omni-flash/reference-to-video" as const

export type SupportedFalVideoModelIdentifier =
  | typeof HAPPY_HORSE_CANONICAL_ID
  | typeof GEMINI_OMNI_FLASH_CANONICAL_ID

export type FalVideoEndpoint =
  | typeof FAL_HAPPY_HORSE_T2V
  | typeof FAL_HAPPY_HORSE_I2V
  | typeof FAL_HAPPY_HORSE_REFERENCE
  | typeof FAL_GEMINI_OMNI_FLASH_T2V
  | typeof FAL_GEMINI_OMNI_FLASH_I2V
  | typeof FAL_GEMINI_OMNI_FLASH_REFERENCE

export interface FalVideoRequestOptions {
  aspectRatio?: string | null
  duration?: number | string | null
  imageUrl?: string | null
  modelIdentifier: string
  prompt?: string | null
  referenceImageUrls: string[]
  resolution?: "720p" | "1080p" | string | null
  seed?: number | string | null
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

export function normalizeFalVideoModelIdentifier(
  modelIdentifier: string,
): SupportedFalVideoModelIdentifier | null {
  if (isHappyHorseModelIdentifier(modelIdentifier)) {
    return HAPPY_HORSE_CANONICAL_ID
  }
  if (modelIdentifier === GEMINI_OMNI_FLASH_CANONICAL_ID) {
    return GEMINI_OMNI_FLASH_CANONICAL_ID
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
  mode: "text-to-video" | "image-to-video" | "reference-to-video"
} {
  const prompt = pickString(options.prompt)
  const imageUrl = pickString(options.imageUrl)
  const referenceImageUrls = options.referenceImageUrls
    .map((url) => pickString(url))
    .filter((url): url is string => Boolean(url))
    .slice(0, 9)

  const baseInput: Record<string, unknown> = {
    aspect_ratio: normalizeGeminiOmniFlashAspectRatio(options.aspectRatio),
    duration: normalizeGeminiOmniFlashDuration(options.duration),
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

export function buildFalVideoRequest(options: FalVideoRequestOptions): {
  endpointId: FalVideoEndpoint
  input: Record<string, unknown>
  mode: "text-to-video" | "image-to-video" | "reference-to-video"
} {
  const normalizedModel = normalizeFalVideoModelIdentifier(options.modelIdentifier)
  if (!normalizedModel) {
    throw new Error(`Unsupported Fal video model: ${options.modelIdentifier}`)
  }

  if (normalizedModel === GEMINI_OMNI_FLASH_CANONICAL_ID) {
    return buildGeminiOmniFlashFalVideoRequest(options)
  }

  return buildHappyHorseFalVideoRequest(options)
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
