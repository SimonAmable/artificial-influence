import { fal } from "@fal-ai/client"

export const QWEN_IMAGE2_CANONICAL_ID = "fal-ai/qwen-image-2" as const
export const WAN_27_IMAGE_CANONICAL_ID = "fal-ai/wan/v2.7" as const
export const WAN_27_PRO_IMAGE_CANONICAL_ID = "fal-ai/wan/v2.7/pro" as const

export const FAL_QWEN_T2I = "fal-ai/qwen-image-2/text-to-image" as const
export const FAL_QWEN_EDIT = "fal-ai/qwen-image-2/edit" as const
export const FAL_WAN_27_T2I = "fal-ai/wan/v2.7/text-to-image" as const
export const FAL_WAN_27_EDIT = "fal-ai/wan/v2.7/edit" as const
export const FAL_WAN_27_PRO_T2I = "fal-ai/wan/v2.7/pro/text-to-image" as const
export const FAL_WAN_27_PRO_EDIT = "fal-ai/wan/v2.7/pro/edit" as const

export type SupportedFalImageModelIdentifier =
  | typeof QWEN_IMAGE2_CANONICAL_ID
  | typeof WAN_27_IMAGE_CANONICAL_ID
  | typeof WAN_27_PRO_IMAGE_CANONICAL_ID

export type FalImageEndpoint =
  | typeof FAL_QWEN_T2I
  | typeof FAL_QWEN_EDIT
  | typeof FAL_WAN_27_T2I
  | typeof FAL_WAN_27_EDIT
  | typeof FAL_WAN_27_PRO_T2I
  | typeof FAL_WAN_27_PRO_EDIT

const FAL_IMAGE_MODEL_CONFIG: Record<
  SupportedFalImageModelIdentifier,
  {
    editEndpointId: FalImageEndpoint
    maxReferenceImages: number
    textEndpointId: FalImageEndpoint
  }
> = {
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
  referenceImageUrls: string[]
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

export function aspectRatioToFalImageSize(aspectRatio: string | null | undefined) {
  const a = (aspectRatio || "1:1").trim()
  if (a === "16:9" || a === "21:9") return "landscape_16_9"
  if (a === "9:16") return "portrait_16_9"
  if (a === "4:3") return "landscape_4_3"
  if (a === "3:4") return "portrait_4_3"
  if (a === "1:1") return "square_hd"
  return "square_hd"
}

function normalizeOutputFormat(
  outputFormat: FalImageRequestOptions["outputFormat"],
): "png" | "jpeg" | "webp" {
  if (outputFormat === "jpeg" || outputFormat === "webp") return outputFormat
  return "png"
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
    resolvedAspectRatio === "match_input_image" && isEdit
      ? undefined
      : aspectRatioToFalImageSize(resolvedAspectRatio)

  if (options.modelIdentifier === QWEN_IMAGE2_CANONICAL_ID) {
    const input: Record<string, unknown> = {
      prompt: options.prompt,
      negative_prompt: options.negativePrompt ?? "",
      num_images: Math.min(4, Math.max(1, options.numImages)),
      output_format: normalizeOutputFormat(options.outputFormat),
      enable_prompt_expansion: options.enablePromptExpansion ?? true,
      enable_safety_checker: options.enableSafetyChecker ?? false,
    }

    if (options.seed != null && !Number.isNaN(Number(options.seed))) {
      input.seed = Math.round(Number(options.seed))
    }

    if (imageSize) {
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
    const boundedImageCount = Math.min(4, Math.max(1, options.numImages))
    const input: Record<string, unknown> = {
      prompt: options.prompt,
      negative_prompt: options.negativePrompt ?? "",
      enable_safety_checker: false,
    }

    if (imageSize) {
      input.image_size = imageSize
    }

    if (options.seed != null && !Number.isNaN(Number(options.seed))) {
      input.seed = Math.round(Number(options.seed))
    }

    if (isEdit) {
      input.image_urls = referenceImageUrls
      input.num_images = boundedImageCount
      input.enable_prompt_expansion = options.enablePromptExpansion ?? true
    } else {
      input.max_images = boundedImageCount
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
  const submitted = await fal.queue.submit(endpointId, {
    input: input as never,
  })
  const requestId = submitted.request_id
  if (!requestId) {
    throw new Error("Fal queue submit did not return request_id")
  }

  return { requestId, endpointId }
}
