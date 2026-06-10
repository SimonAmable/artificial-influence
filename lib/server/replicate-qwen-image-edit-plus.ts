export const QWEN_IMAGE_EDIT_PLUS_LORA_MODEL = "qwen/qwen-image-edit-plus-lora" as const

export const QWEN_IMAGE_EDIT_PLUS_LORA_WEIGHTS_URL =
  "https://huggingface.co/GoGoonAI/wan-testing/resolve/main/qwen_MCNL_v1.0.safetensors"

const SUPPORTED_ASPECT_RATIOS = new Set(["1:1", "16:9", "9:16", "4:3", "3:4"])

type QwenImageEditPlusAspectRatio =
  | "1:1"
  | "16:9"
  | "9:16"
  | "4:3"
  | "3:4"
  | "match_input_image"

type QwenImageEditPlusOutputFormat = "webp" | "png" | "jpeg"

export function isQwenImageEditPlusLoraModel(modelIdentifier: string): boolean {
  return modelIdentifier === QWEN_IMAGE_EDIT_PLUS_LORA_MODEL
}

export function resolveQwenImageEditPlusAspectRatio(
  value: string | null | undefined,
): QwenImageEditPlusAspectRatio {
  const trimmed = value?.trim()
  if (trimmed && SUPPORTED_ASPECT_RATIOS.has(trimmed)) {
    return trimmed as QwenImageEditPlusAspectRatio
  }
  return "match_input_image"
}

function normalizeOutputFormat(
  value: string | null | undefined,
): QwenImageEditPlusOutputFormat {
  const normalized = value?.trim().toLowerCase()
  if (normalized === "png" || normalized === "jpeg" || normalized === "jpg") {
    return normalized === "jpg" ? "jpeg" : normalized
  }
  return "webp"
}

function normalizeOutputQuality(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) {
    return 95
  }
  return Math.min(100, Math.max(1, Math.round(value)))
}

function normalizeLoraScale(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) {
    return 1
  }
  return Math.max(0, value)
}

export function buildReplicateQwenImageEditPlusInput({
  aspectRatio,
  defaults = {},
  goFast,
  loraScale,
  outputFormat,
  outputQuality,
  prompt,
  referenceImageUrls,
}: {
  aspectRatio?: string | null
  defaults?: Record<string, unknown>
  goFast?: boolean | null
  loraScale?: number | null
  outputFormat?: string | null
  outputQuality?: number | null
  prompt: string
  referenceImageUrls: string[]
}): {
  input: Record<string, unknown>
  resolvedAspectRatio: QwenImageEditPlusAspectRatio
  usedReferenceImageUrls: string[]
} {
  const usedReferenceImageUrls = referenceImageUrls.slice(0, 1)
  const resolvedAspectRatio = resolveQwenImageEditPlusAspectRatio(aspectRatio)

  const defaultGoFast = defaults.go_fast
  const defaultLoraScale = defaults.lora_scale
  const defaultOutputFormat = defaults.output_format
  const defaultOutputQuality = defaults.output_quality
  const defaultLoraWeights = defaults.lora_weights

  const input: Record<string, unknown> = {
    prompt,
    image: usedReferenceImageUrls,
    aspect_ratio: resolvedAspectRatio,
    go_fast: goFast ?? (typeof defaultGoFast === "boolean" ? defaultGoFast : true),
    lora_scale: normalizeLoraScale(
      loraScale ??
        (typeof defaultLoraScale === "number" ? defaultLoraScale : null),
    ),
    lora_weights:
      typeof defaultLoraWeights === "string" && defaultLoraWeights.trim().length > 0
        ? defaultLoraWeights
        : QWEN_IMAGE_EDIT_PLUS_LORA_WEIGHTS_URL,
    output_format: normalizeOutputFormat(
      outputFormat ??
        (typeof defaultOutputFormat === "string" ? defaultOutputFormat : null),
    ),
    output_quality: normalizeOutputQuality(
      outputQuality ??
        (typeof defaultOutputQuality === "number" ? defaultOutputQuality : null),
    ),
    disable_safety_checker:
      typeof defaults.disable_safety_checker === "boolean"
        ? defaults.disable_safety_checker
        : true,
  }

  return {
    input,
    resolvedAspectRatio,
    usedReferenceImageUrls,
  }
}
