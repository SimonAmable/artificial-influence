import { fal } from "@fal-ai/client"
import { getFalWebhookUrl } from "@/lib/server/fal-webhook-url"
import { aspectRatioToDimensions } from "@/lib/utils/model-parameters"

export const OPENAI_GPT_IMAGE_2_CANONICAL_ID = "openai/gpt-image-2" as const
export const QWEN_IMAGE2_CANONICAL_ID = "fal-ai/qwen-image-2" as const
export const WAN_27_IMAGE_CANONICAL_ID = "fal-ai/wan/v2.7" as const
export const WAN_27_PRO_IMAGE_CANONICAL_ID = "fal-ai/wan/v2.7/pro" as const
export const SEEDREAM_4_5_CANONICAL_ID = "bytedance/seedream-4.5" as const
export const SEEDREAM_5_LITE_CANONICAL_ID = "bytedance/seedream-5-lite" as const
export const SEEDREAM_5_PRO_CANONICAL_ID = "bytedance/seedream-5-pro" as const
export const NANO_BANANA_2_LITE_CANONICAL_ID = "google/nano-banana-2-lite" as const

export const FAL_OPENAI_GPT_IMAGE_2_T2I = "openai/gpt-image-2" as const
export const FAL_OPENAI_GPT_IMAGE_2_EDIT = "openai/gpt-image-2/edit" as const
export const FAL_QWEN_T2I = "fal-ai/qwen-image-2/text-to-image" as const
export const FAL_QWEN_EDIT = "fal-ai/qwen-image-2/edit" as const
export const FAL_WAN_27_T2I = "fal-ai/wan/v2.7/text-to-image" as const
export const FAL_WAN_27_EDIT = "fal-ai/wan/v2.7/edit" as const
export const FAL_WAN_27_PRO_T2I = "fal-ai/wan/v2.7/pro/text-to-image" as const
export const FAL_WAN_27_PRO_EDIT = "fal-ai/wan/v2.7/pro/edit" as const
export const FAL_SEEDREAM_4_5_T2I = "fal-ai/bytedance/seedream/v4.5/text-to-image" as const
export const FAL_SEEDREAM_4_5_EDIT = "fal-ai/bytedance/seedream/v4.5/edit" as const
export const FAL_SEEDREAM_5_LITE_T2I = "fal-ai/bytedance/seedream/v5/lite/text-to-image" as const
export const FAL_SEEDREAM_5_LITE_EDIT = "fal-ai/bytedance/seedream/v5/lite/edit" as const
export const FAL_SEEDREAM_5_PRO_T2I = "bytedance/seedream/v5/pro/text-to-image" as const
export const FAL_SEEDREAM_5_PRO_EDIT = "bytedance/seedream/v5/pro/edit" as const
export const FAL_NANO_BANANA_2_LITE_T2I = "google/nano-banana-2-lite" as const
export const FAL_NANO_BANANA_2_LITE_EDIT = "google/nano-banana-2-lite/edit" as const

export type SupportedFalImageModelIdentifier =
  | typeof OPENAI_GPT_IMAGE_2_CANONICAL_ID
  | typeof QWEN_IMAGE2_CANONICAL_ID
  | typeof WAN_27_IMAGE_CANONICAL_ID
  | typeof WAN_27_PRO_IMAGE_CANONICAL_ID
  | typeof SEEDREAM_4_5_CANONICAL_ID
  | typeof SEEDREAM_5_LITE_CANONICAL_ID
  | typeof SEEDREAM_5_PRO_CANONICAL_ID
  | typeof NANO_BANANA_2_LITE_CANONICAL_ID

export type FalImageEndpoint =
  | typeof FAL_OPENAI_GPT_IMAGE_2_T2I
  | typeof FAL_OPENAI_GPT_IMAGE_2_EDIT
  | typeof FAL_QWEN_T2I
  | typeof FAL_QWEN_EDIT
  | typeof FAL_WAN_27_T2I
  | typeof FAL_WAN_27_EDIT
  | typeof FAL_WAN_27_PRO_T2I
  | typeof FAL_WAN_27_PRO_EDIT
  | typeof FAL_SEEDREAM_4_5_T2I
  | typeof FAL_SEEDREAM_4_5_EDIT
  | typeof FAL_SEEDREAM_5_LITE_T2I
  | typeof FAL_SEEDREAM_5_LITE_EDIT
  | typeof FAL_SEEDREAM_5_PRO_T2I
  | typeof FAL_SEEDREAM_5_PRO_EDIT
  | typeof FAL_NANO_BANANA_2_LITE_T2I
  | typeof FAL_NANO_BANANA_2_LITE_EDIT

const FAL_IMAGE_MODEL_CONFIG: Record<
  SupportedFalImageModelIdentifier,
  {
    editEndpointId: FalImageEndpoint
    maxReferenceImages: number
    textEndpointId: FalImageEndpoint
  }
> = {
  [OPENAI_GPT_IMAGE_2_CANONICAL_ID]: {
    textEndpointId: FAL_OPENAI_GPT_IMAGE_2_T2I,
    editEndpointId: FAL_OPENAI_GPT_IMAGE_2_EDIT,
    maxReferenceImages: 4,
  },
  [QWEN_IMAGE2_CANONICAL_ID]: {
    textEndpointId: FAL_QWEN_T2I,
    editEndpointId: FAL_QWEN_EDIT,
    maxReferenceImages: 3,
  },
  [WAN_27_IMAGE_CANONICAL_ID]: {
    textEndpointId: FAL_WAN_27_T2I,
    editEndpointId: FAL_WAN_27_EDIT,
    maxReferenceImages: 4,
  },
  [WAN_27_PRO_IMAGE_CANONICAL_ID]: {
    textEndpointId: FAL_WAN_27_PRO_T2I,
    editEndpointId: FAL_WAN_27_PRO_EDIT,
    maxReferenceImages: 4,
  },
  [SEEDREAM_4_5_CANONICAL_ID]: {
    textEndpointId: FAL_SEEDREAM_4_5_T2I,
    editEndpointId: FAL_SEEDREAM_4_5_EDIT,
    maxReferenceImages: 10,
  },
  [SEEDREAM_5_LITE_CANONICAL_ID]: {
    textEndpointId: FAL_SEEDREAM_5_LITE_T2I,
    editEndpointId: FAL_SEEDREAM_5_LITE_EDIT,
    maxReferenceImages: 10,
  },
  [SEEDREAM_5_PRO_CANONICAL_ID]: {
    textEndpointId: FAL_SEEDREAM_5_PRO_T2I,
    editEndpointId: FAL_SEEDREAM_5_PRO_EDIT,
    maxReferenceImages: 10,
  },
  [NANO_BANANA_2_LITE_CANONICAL_ID]: {
    textEndpointId: FAL_NANO_BANANA_2_LITE_T2I,
    editEndpointId: FAL_NANO_BANANA_2_LITE_EDIT,
    maxReferenceImages: 10,
  },
}

export interface FalImageRequestOptions {
  aspectRatio?: string | null
  enablePromptExpansion?: boolean
  enableSafetyChecker?: boolean
  modelIdentifier: SupportedFalImageModelIdentifier
  negativePrompt?: string | null
  numImages: number
  outputFormat?: "png" | "jpeg" | "webp" | null
  prompt: string
  quality?: string | null
  referenceImageUrls: string[]
  resolutionPreset?: string | null
  seed?: number | null
}

export function configureFal() {
  const key = process.env.FAL_KEY
  if (!key) {
    throw new Error("FAL_KEY is not configured.")
  }

  fal.config({ credentials: key })
}

export function isSupportedFalImageModel(
  modelIdentifier: string,
): modelIdentifier is SupportedFalImageModelIdentifier {
  return modelIdentifier in FAL_IMAGE_MODEL_CONFIG
}

type FalImageSize =
  | "auto"
  | "square_hd"
  | "square"
  | "portrait_4_3"
  | "portrait_16_9"
  | "landscape_4_3"
  | "landscape_16_9"
  | { width: number; height: number }

export function aspectRatioToFalImageSize(
  aspectRatio: string | null | undefined,
  options?: { allowAuto?: boolean; maxSize?: number },
): FalImageSize {
  const a = (aspectRatio || "1:1").trim()

  if (options?.allowAuto && (a === "match_input_image" || a === "auto")) {
    return "auto"
  }

  if (a === "16:9") return "landscape_16_9"
  if (a === "9:16") return "portrait_16_9"
  if (a === "4:3") return "landscape_4_3"
  if (a === "3:4") return "portrait_4_3"
  if (a === "1:1") return "square_hd"

  if (/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(a)) {
    const dims = aspectRatioToDimensions(a, options?.maxSize ?? 1344)
    return {
      width: dims.width,
      height: dims.height,
    }
  }

  return "square_hd"
}

function normalizeOutputFormat(
  outputFormat: FalImageRequestOptions["outputFormat"],
): "png" | "jpeg" | "webp" {
  if (outputFormat === "jpeg" || outputFormat === "webp") return outputFormat
  return "png"
}

function normalizeQuality(value: string | null | undefined): "low" | "medium" | "high" {
  if (value === "low" || value === "medium" || value === "high") {
    return value
  }

  return "low"
}

/**
 * WAN 2.x image APIs expect a plain text prompt. Users sometimes paste JSON blobs
 * (e.g. from other tools) with "summary" / "prompt" fields — coerce when obvious.
 */
export function coerceWanImagePrompt(prompt: string): string {
  const trimmed = prompt.trimStart()
  if (!trimmed.startsWith("{")) return prompt
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const o = parsed as Record<string, unknown>
      for (const key of ["prompt", "summary", "description", "text"]) {
        const v = o[key]
        if (typeof v === "string" && v.trim().length > 0) return v.trim()
      }
    }
  } catch {
    /* keep original */
  }
  return prompt
}

type SeedreamImageSize =
  | FalImageSize
  | "auto_2K"
  | "auto_3K"
  | "auto_4K"

function aspectRatioToSeedreamImageSize(
  aspectRatio: string | null | undefined,
  options?: {
    allowAuto?: boolean
    resolutionPreset?: string | null
    supportsAuto3K?: boolean
  },
): SeedreamImageSize {
  const aspect = (aspectRatio || "1:1").trim()

  const preset = options?.resolutionPreset?.trim().toUpperCase()
  if (preset === "4K") return "auto_4K"
  if (preset === "3K" && options?.supportsAuto3K) return "auto_3K"
  if (preset === "2K") return "auto_2K"

  if (options?.allowAuto && (aspect === "match_input_image" || aspect === "auto")) {
    return "auto_2K"
  }

  if (aspect === "16:9") return "landscape_16_9"
  if (aspect === "9:16") return "portrait_16_9"
  if (aspect === "4:3") return "landscape_4_3"
  if (aspect === "3:4") return "portrait_4_3"
  if (aspect === "1:1") return "auto_2K"

  if (/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(aspect)) {
    const dims = aspectRatioToDimensions(aspect, 3072)
    return {
      width: dims.width,
      height: dims.height,
    }
  }

  return "auto_2K"
}

function isSeedreamFalImageModel(
  modelIdentifier: SupportedFalImageModelIdentifier,
): modelIdentifier is
  | typeof SEEDREAM_4_5_CANONICAL_ID
  | typeof SEEDREAM_5_LITE_CANONICAL_ID
  | typeof SEEDREAM_5_PRO_CANONICAL_ID {
  return (
    modelIdentifier === SEEDREAM_4_5_CANONICAL_ID ||
    modelIdentifier === SEEDREAM_5_LITE_CANONICAL_ID ||
    modelIdentifier === SEEDREAM_5_PRO_CANONICAL_ID
  )
}

const NANO_BANANA_2_LITE_ASPECT_RATIOS = new Set([
  "auto",
  "21:9",
  "16:9",
  "3:2",
  "4:3",
  "5:4",
  "1:1",
  "4:5",
  "3:4",
  "2:3",
  "9:16",
  "4:1",
  "1:4",
  "8:1",
  "1:8",
])

function normalizeNanoBananaLiteAspectRatio(
  value: string | null | undefined,
  isEdit: boolean,
): string {
  const aspect = (value || (isEdit ? "match_input_image" : "auto")).trim()
  if (aspect === "match_input_image") return "auto"
  if (NANO_BANANA_2_LITE_ASPECT_RATIOS.has(aspect)) return aspect
  return isEdit ? "auto" : "auto"
}

export function buildFalImageRequest(options: FalImageRequestOptions): {
  endpointId: FalImageEndpoint
  input: Record<string, unknown>
  resolvedAspectRatio: string
} {
  const config = FAL_IMAGE_MODEL_CONFIG[options.modelIdentifier]
  if (!config) {
    throw new Error(`Unsupported Fal image model: ${options.modelIdentifier}`)
  }

  const referenceImageUrls = options.referenceImageUrls
    .filter((url) => typeof url === "string" && url.length > 0)
    .slice(0, config.maxReferenceImages)
  const isEdit = referenceImageUrls.length > 0
  const endpointId = isEdit ? config.editEndpointId : config.textEndpointId
  const resolvedAspectRatio =
    options.aspectRatio ?? (isEdit ? "match_input_image" : "1:1")
  const imageSize =
    aspectRatioToFalImageSize(resolvedAspectRatio, {
      allowAuto: isEdit,
      maxSize: 1344,
    })
  const shouldIncludeImageSize = imageSize !== "auto"

  if (options.modelIdentifier === OPENAI_GPT_IMAGE_2_CANONICAL_ID) {
    const input: Record<string, unknown> = {
      prompt: options.prompt,
      quality: normalizeQuality(options.quality),
      num_images: Math.min(4, Math.max(1, options.numImages)),
      output_format: normalizeOutputFormat(options.outputFormat),
      image_size: imageSize,
    }

    if (isEdit) {
      input.image_urls = referenceImageUrls
    }

    return { endpointId, input, resolvedAspectRatio }
  }

  if (options.modelIdentifier === QWEN_IMAGE2_CANONICAL_ID) {
    const input: Record<string, unknown> = {
      prompt: options.prompt,
      negative_prompt: options.negativePrompt ?? "",
      num_images: Math.min(4, Math.max(1, options.numImages)),
      output_format: normalizeOutputFormat(options.outputFormat),
      enable_prompt_expansion: options.enablePromptExpansion ?? true,
      enable_safety_checker: false,
    }

    if (options.seed != null && !Number.isNaN(Number(options.seed))) {
      input.seed = Math.round(Number(options.seed))
    }

    if (shouldIncludeImageSize) {
      input.image_size = imageSize
    }

    if (isEdit) {
      input.image_urls = referenceImageUrls
    }

    return { endpointId, input, resolvedAspectRatio }
  }

  if (
    options.modelIdentifier === WAN_27_IMAGE_CANONICAL_ID ||
    options.modelIdentifier === WAN_27_PRO_IMAGE_CANONICAL_ID
  ) {
    const wanPrompt = coerceWanImagePrompt(options.prompt)
    const wanNegative = String(options.negativePrompt ?? "").slice(0, 500)
    const boundedImageCount = Math.min(4, Math.max(1, options.numImages))
    const input: Record<string, unknown> = {
      prompt: wanPrompt,
      negative_prompt: wanNegative,
      enable_safety_checker: false,
      output_format: normalizeOutputFormat(options.outputFormat),
    }

    if (shouldIncludeImageSize) {
      input.image_size = imageSize
    }

    if (options.seed != null && !Number.isNaN(Number(options.seed))) {
      input.seed = Math.round(Number(options.seed))
    }

    if (isEdit) {
      input.image_urls = referenceImageUrls
      input.num_images = boundedImageCount
      // DashScope expansion can choke on huge / structured prompts; disable for very long inputs.
      const expansionDefault = options.enablePromptExpansion ?? true
      input.enable_prompt_expansion =
        expansionDefault && wanPrompt.length <= 3500 ? true : false
    } else {
      input.max_images = boundedImageCount
    }

    return { endpointId, input, resolvedAspectRatio }
  }

  if (isSeedreamFalImageModel(options.modelIdentifier)) {
    const boundedImageCount = Math.min(6, Math.max(1, options.numImages))
    const imageSize = aspectRatioToSeedreamImageSize(resolvedAspectRatio, {
      allowAuto: isEdit,
      resolutionPreset: options.resolutionPreset,
      supportsAuto3K: options.modelIdentifier === SEEDREAM_5_LITE_CANONICAL_ID,
    })
    const input: Record<string, unknown> = {
      prompt: options.prompt,
      image_size: imageSize,
      num_images: boundedImageCount,
      max_images: 1,
      enable_safety_checker: false,
    }

    if (options.seed != null && !Number.isNaN(Number(options.seed))) {
      input.seed = Math.round(Number(options.seed))
    }

    if (isEdit) {
      input.image_urls = referenceImageUrls
    }

    return { endpointId, input, resolvedAspectRatio }
  }

  if (options.modelIdentifier === NANO_BANANA_2_LITE_CANONICAL_ID) {
    const input: Record<string, unknown> = {
      prompt: options.prompt,
      aspect_ratio: normalizeNanoBananaLiteAspectRatio(resolvedAspectRatio, isEdit),
      num_images: Math.min(4, Math.max(1, options.numImages)),
      output_format: normalizeOutputFormat(options.outputFormat),
      safety_tolerance: "6",
      limit_generations: true,
    }

    if (options.seed != null && !Number.isNaN(Number(options.seed))) {
      input.seed = Math.round(Number(options.seed))
    }

    if (isEdit) {
      input.image_urls = referenceImageUrls
    }

    return { endpointId, input, resolvedAspectRatio }
  }

  throw new Error(`Unsupported Fal image model: ${options.modelIdentifier}`)
}

export async function submitFalImageQueue(
  endpointId: FalImageEndpoint,
  input: Record<string, unknown>,
): Promise<{ requestId: string; endpointId: FalImageEndpoint }> {
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
