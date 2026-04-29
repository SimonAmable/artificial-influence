import { fal } from "@fal-ai/client"

export const HAPPY_HORSE_CANONICAL_ID = "alibaba/happy-horse" as const

export const FAL_HAPPY_HORSE_T2V = "alibaba/happy-horse/text-to-video" as const
export const FAL_HAPPY_HORSE_I2V = "alibaba/happy-horse/image-to-video" as const
export const FAL_HAPPY_HORSE_REFERENCE = "alibaba/happy-horse/reference-to-video" as const

export type SupportedFalVideoModelIdentifier = typeof HAPPY_HORSE_CANONICAL_ID

export type FalVideoEndpoint =
  | typeof FAL_HAPPY_HORSE_T2V
  | typeof FAL_HAPPY_HORSE_I2V
  | typeof FAL_HAPPY_HORSE_REFERENCE

export interface FalVideoRequestOptions {
  aspectRatio?: string | null
  duration?: number | string | null
  imageUrl?: string | null
  modelIdentifier: SupportedFalVideoModelIdentifier
  prompt?: string | null
  referenceImageUrls: string[]
  resolution?: "720p" | "1080p" | string | null
  seed?: number | string | null
}

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

function normalizeAspectRatio(value: FalVideoRequestOptions["aspectRatio"]): string {
  const aspectRatio = pickString(value) ?? "16:9"
  if (["16:9", "9:16", "1:1", "4:3", "3:4"].includes(aspectRatio)) {
    return aspectRatio
  }
  return "16:9"
}

export function isSupportedFalVideoModel(
  modelIdentifier: string,
): modelIdentifier is SupportedFalVideoModelIdentifier {
  return modelIdentifier === HAPPY_HORSE_CANONICAL_ID
}

export function buildFalVideoRequest(options: FalVideoRequestOptions): {
  endpointId: FalVideoEndpoint
  input: Record<string, unknown>
  mode: "text-to-video" | "image-to-video" | "reference-to-video"
} {
  if (options.modelIdentifier !== HAPPY_HORSE_CANONICAL_ID) {
    throw new Error(`Unsupported Fal video model: ${options.modelIdentifier}`)
  }

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
        aspect_ratio: normalizeAspectRatio(options.aspectRatio),
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
      aspect_ratio: normalizeAspectRatio(options.aspectRatio),
    },
  }
}

export async function submitFalVideoQueue(
  endpointId: FalVideoEndpoint,
  input: Record<string, unknown>,
): Promise<{ requestId: string; endpointId: FalVideoEndpoint }> {
  configureFal()
  const submitted = await fal.queue.submit(endpointId, {
    input: input as never,
  })
  const requestId = submitted.request_id
  if (!requestId) {
    throw new Error("Fal queue submit did not return request_id")
  }

  return { requestId, endpointId }
}
