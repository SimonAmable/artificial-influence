import { IMAGE_STUDIO_TOOLS } from "@/lib/image/studio-tools/registry"
import { isContentModerationMessage } from "@/lib/generate-image-client"

/** Lowest-quality rescue ladder for proprietary studio tools. */
export const STUDIO_IMAGE_FALLBACK_CHAIN = [
  "google/nano-banana-2-lite",
  "openai/gpt-image-2",
  "bytedance/seedream-5-lite",
] as const

export type StudioImageFallbackModelId = (typeof STUDIO_IMAGE_FALLBACK_CHAIN)[number]

export type StudioToolImageFallbackMetadata = {
  deliveredModel: StudioImageFallbackModelId
  fallbackReason?: "content_moderation"
  fallbackUsed: boolean
  requestedModel: StudioImageFallbackModelId
}

export function isStudioImageToolTag(tool: string | null | undefined): boolean {
  if (!tool) return false
  return IMAGE_STUDIO_TOOLS.some((entry) => entry.historyToolTag === tool)
}

export function isModerationGenerationFailure(error: unknown): boolean {
  if (error instanceof Error) {
    return isContentModerationMessage(error.message)
  }
  return isContentModerationMessage(String(error))
}

export function getStudioToolFalQualityParams(
  model: StudioImageFallbackModelId,
): Record<string, unknown> {
  switch (model) {
    case "google/nano-banana-2-lite":
      return {}
    case "openai/gpt-image-2":
      return { quality: "low" as const }
    case "bytedance/seedream-5-lite":
      return { resolutionPreset: "2K" }
    default: {
      const _exhaustive: never = model
      return _exhaustive
    }
  }
}
