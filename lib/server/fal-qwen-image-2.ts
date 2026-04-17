import { fal } from "@fal-ai/client"

export const QWEN_IMAGE2_CANONICAL_ID = "fal-ai/qwen-image-2" as const
export const FAL_QWEN_T2I = "fal-ai/qwen-image-2/text-to-image" as const
export const FAL_QWEN_EDIT = "fal-ai/qwen-image-2/edit" as const

export type QwenRoute = typeof FAL_QWEN_T2I | typeof FAL_QWEN_EDIT

export function configureFal() {
  const key = process.env.FAL_KEY
  if (!key) {
    throw new Error("FAL_KEY is not configured.")
  }
  fal.config({ credentials: key })
}

/** Map app aspect ratio hints to Fal text-to-image `image_size` enum. */
export function aspectRatioToQwenImageSize(
  aspectRatio: string | null | undefined,
): string | { width: number; height: number } {
  const a = (aspectRatio || "1:1").trim()
  if (a === "16:9" || a === "21:9") return "landscape_16_9"
  if (a === "9:16") return "portrait_16_9"
  if (a === "4:3") return "landscape_4_3"
  if (a === "3:4") return "portrait_4_3"
  if (a === "1:1") return "square_hd"
  return "square_hd"
}

export interface QwenUnifiedParams {
  prompt: string
  negativePrompt?: string | null
  numImages: number
  seed?: number | null
  outputFormat: "png" | "jpeg" | "webp"
  enablePromptExpansion: boolean
  enableSafetyChecker: boolean
  imageSize: string | { width: number; height: number }
}

export function resolveQwenImage2Route(referenceImageUrls: string[]): {
  endpointId: QwenRoute
  isEdit: boolean
} {
  const urls = referenceImageUrls.filter((u) => typeof u === "string" && u.length > 0)
  if (urls.length > 0) {
    return { endpointId: FAL_QWEN_EDIT, isEdit: true }
  }
  return { endpointId: FAL_QWEN_T2I, isEdit: false }
}

export function buildQwenFalInput(
  endpointId: QwenRoute,
  params: QwenUnifiedParams,
  referenceImageUrls: string[],
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    prompt: params.prompt,
    negative_prompt: params.negativePrompt ?? "",
    num_images: Math.min(4, Math.max(1, params.numImages)),
    output_format: params.outputFormat,
    enable_prompt_expansion: params.enablePromptExpansion,
    enable_safety_checker: params.enableSafetyChecker,
  }
  if (params.seed != null && !Number.isNaN(Number(params.seed))) {
    base.seed = Math.round(Number(params.seed))
  }

  if (endpointId === FAL_QWEN_EDIT) {
    const urls = referenceImageUrls.filter((u) => typeof u === "string" && u.length > 0).slice(0, 3)
    if (urls.length < 1) {
      throw new Error("Qwen Image 2 edit requires at least one reference image URL.")
    }
    base.image_urls = urls
    if (typeof params.imageSize === "string") {
      base.image_size = params.imageSize
    } else {
      base.image_size = params.imageSize
    }
    return base
  }

  base.image_size =
    typeof params.imageSize === "string" ? params.imageSize : params.imageSize
  return base
}

export async function submitQwenImage2Queue(
  endpointId: QwenRoute,
  input: Record<string, unknown>,
): Promise<{ requestId: string; endpointId: QwenRoute }> {
  configureFal()
  const submitted = await fal.queue.submit(endpointId, { input })
  const requestId = submitted.request_id
  if (!requestId) {
    throw new Error("Fal queue submit did not return request_id")
  }
  return { requestId, endpointId }
}

