/**
 * Image Generation Models Configuration
 * This file contains hardcoded model data for image generation in the canvas
 */

export interface ImageModel {
  identifier: string
  name: string
  description: string
  aspectRatios: string[]
  defaultAspectRatio: string
}

export const IMAGE_MODELS: Record<string, ImageModel> = {
  "google/nano-banana": {
    identifier: "google/nano-banana",
    name: "Nano Banana",
    description: "High-quality image generation by Google",
    aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    defaultAspectRatio: "1:1",
  },
  "prunaai/flux-kontext-fast": {
    identifier: "prunaai/flux-kontext-fast",
    name: "Flux Kontext",
    description: "Ultra fast flux kontext endpoint",
    aspectRatios: ["match_input_image", "1:1", "16:9", "9:16", "4:3", "3:4"],
    defaultAspectRatio: "1:1",
  },
  "google/nano-banana-pro": {
    identifier: "google/nano-banana-pro",
    name: "Nano Banana Pro",
    description: "State of the art image generation and editing",
    aspectRatios: ["auto", "1:1", "16:9", "9:16", "3:2", "2:3", "4:3", "3:4"],
    defaultAspectRatio: "1:1",
  },
  "openai/gpt-image-1.5": {
    identifier: "openai/gpt-image-1.5",
    name: "GPT Image 1.5",
    description: "OpenAI's latest image generation model",
    aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    defaultAspectRatio: "1:1",
  },
  "bytedance/seedream-4.5": {
    identifier: "bytedance/seedream-4.5",
    name: "Seedream 4.5",
    description: "Upgraded Bytedance image model",
    aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    defaultAspectRatio: "1:1",
  },
}

export const AVAILABLE_IMAGE_MODELS = Object.values(IMAGE_MODELS)

export const DEFAULT_IMAGE_MODEL = "google/nano-banana"

/**
 * Get a model by its identifier
 */
export function getImageModel(identifier: string): ImageModel | undefined {
  return IMAGE_MODELS[identifier]
}

/**
 * Get supported aspect ratios for a specific model
 */
export function getModelAspectRatios(modelIdentifier: string): string[] {
  const model = getImageModel(modelIdentifier)
  return model?.aspectRatios || ["1:1", "16:9", "9:16", "4:3", "3:4"]
}
