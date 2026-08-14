import type { CarouselGenerationMode, CarouselShotsModelId } from "@/lib/carousel-shots/types"

/** Highest tier for fast (contact sheet) mode. */
export function getCarouselFastQualityParams(
  model: CarouselShotsModelId,
): Record<string, unknown> {
  switch (model) {
    case "openai/gpt-image-2":
      return { quality: "high" }
    case "google/nano-banana-2":
      return { resolution: "4k" }
    case "google/nano-banana-2-lite":
      return {}
    case "xai/grok-imagine-image-2.0":
      return { quality: "high", resolution: "2k" }
    case "bytedance/seedream-4.5":
      return { resolutionPreset: "4K" }
    case "bytedance/seedream-5-lite":
      return { resolutionPreset: "3K" }
    case "bytedance/seedream-5-pro":
      return { resolutionPreset: "2K" }
    default: {
      const _exhaustive: never = model
      return _exhaustive
    }
  }
}

/** Lowest tier for HD (per-shot) mode — each shot is a separate generation. */
export function getCarouselHdQualityParams(model: CarouselShotsModelId): Record<string, unknown> {
  switch (model) {
    case "openai/gpt-image-2":
      return { quality: "low" }
    case "google/nano-banana-2":
      return { resolution: "1k" }
    case "google/nano-banana-2-lite":
      return {}
    case "xai/grok-imagine-image-2.0":
      return { quality: "low", resolution: "1k" }
    case "bytedance/seedream-4.5":
      return { resolutionPreset: "2K" }
    case "bytedance/seedream-5-lite":
      return { resolutionPreset: "2K" }
    case "bytedance/seedream-5-pro":
      return { resolutionPreset: "1K" }
    default: {
      const _exhaustive: never = model
      return _exhaustive
    }
  }
}

export function getCarouselGenerationQualityParams(
  mode: CarouselGenerationMode,
  model: CarouselShotsModelId,
): Record<string, unknown> {
  return mode === "hd" ? getCarouselHdQualityParams(model) : getCarouselFastQualityParams(model)
}

export function getCarouselReplicateResolution(
  mode: CarouselGenerationMode,
  model: CarouselShotsModelId,
): string {
  if (model !== "google/nano-banana-2") {
    throw new Error(`getCarouselReplicateResolution only supports nano-banana-2, got ${model}`)
  }

  return mode === "hd" ? "1K" : "4K"
}

export function getCarouselFalQualityParams(
  mode: CarouselGenerationMode,
  model: CarouselShotsModelId,
): Record<string, unknown> {
  const params = getCarouselGenerationQualityParams(mode, model)

  if (model === "openai/gpt-image-2") {
    return { quality: params.quality as "high" | "medium" | "low" }
  }

  if (model === "google/nano-banana-2-lite") {
    return {}
  }

  return { resolutionPreset: params.resolutionPreset as string }
}
