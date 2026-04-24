export const REPLICATE_GPT_IMAGE_2_MODEL = "openai/gpt-image-2" as const

export type ReplicateGptImage2ReferenceImage = Blob | File

type GptImage2AspectRatio = "1:1" | "3:2" | "2:3"
type GptImage2Quality = "low" | "medium" | "high" | "auto"
type GptImage2Moderation = "low" | "auto"
type GptImage2OutputFormat = "webp" | "png" | "jpeg"
type GptImage2Background = "auto" | "opaque"

const SUPPORTED_GPT_IMAGE_2_ASPECT_RATIOS = new Set<GptImage2AspectRatio>(["1:1", "3:2", "2:3"])

function normalizeAspectRatio(value: string | null | undefined): GptImage2AspectRatio {
  const trimmed = value?.trim()

  if (!trimmed || trimmed === "match_input_image") {
    return "1:1"
  }

  if (SUPPORTED_GPT_IMAGE_2_ASPECT_RATIOS.has(trimmed as GptImage2AspectRatio)) {
    return trimmed as GptImage2AspectRatio
  }

  const match = trimmed.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/)
  if (!match) {
    return "1:1"
  }

  const width = Number(match[1])
  const height = Number(match[2])

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return "1:1"
  }

  if (Math.abs(width - height) < 0.001) {
    return "1:1"
  }

  return width > height ? "3:2" : "2:3"
}

function normalizeQuality(value: string | null | undefined): GptImage2Quality {
  if (value === "medium" || value === "high" || value === "auto") {
    return value
  }

  return "low"
}

function normalizeModeration(value: string | null | undefined): GptImage2Moderation {
  if (value === "auto") {
    return "auto"
  }

  return "low"
}

function normalizeOutputFormat(value: string | null | undefined): GptImage2OutputFormat | null {
  if (value === "png" || value === "webp" || value === "jpeg" || value === "jpg") {
    return value === "jpg" ? "jpeg" : value
  }

  return null
}

function normalizeBackground(value: string | null | undefined): GptImage2Background | null {
  if (value === "auto" || value === "opaque") {
    return value
  }

  return null
}

export function isReplicateGptImage2Model(modelIdentifier: string) {
  return modelIdentifier === REPLICATE_GPT_IMAGE_2_MODEL
}

export function buildReplicateGptImage2Input({
  aspectRatio,
  background,
  moderation,
  numberOfImages,
  outputFormat,
  prompt,
  quality,
  referenceImages,
}: {
  aspectRatio?: string | null
  background?: string | null
  moderation?: string | null
  numberOfImages?: number | null
  outputFormat?: string | null
  prompt: string
  quality?: string | null
  referenceImages?: ReplicateGptImage2ReferenceImage[]
}): {
  input: Record<string, unknown>
  resolvedAspectRatio: GptImage2AspectRatio
} {
  const resolvedAspectRatio = normalizeAspectRatio(aspectRatio)
  const resolvedOutputFormat = normalizeOutputFormat(outputFormat)
  const resolvedBackground = normalizeBackground(background)
  const cleanReferenceImages = (referenceImages ?? [])
    .filter((image): image is ReplicateGptImage2ReferenceImage => image instanceof Blob)
    .slice(0, 4)

  const input: Record<string, unknown> = {
    prompt,
    aspect_ratio: resolvedAspectRatio,
    quality: normalizeQuality(quality),
    moderation: normalizeModeration(moderation),
    number_of_images: Math.min(10, Math.max(1, Number(numberOfImages ?? 1) || 1)),
  }

  if (cleanReferenceImages.length > 0) {
    input.input_images = cleanReferenceImages
  }

  if (resolvedOutputFormat) {
    input.output_format = resolvedOutputFormat
  }

  if (resolvedBackground) {
    input.background = resolvedBackground
  }

  return {
    input,
    resolvedAspectRatio,
  }
}
