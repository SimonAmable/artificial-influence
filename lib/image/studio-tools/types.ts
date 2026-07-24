import type { ImageUpload } from "@/components/shared/upload/photo-upload"

export type ImageStudioToolInputKind = "dual-reference-swap" | "standard"

export interface ImageStudioReferenceSlot {
  key: string
  label: string
  description?: string
}

export interface ImageStudioToolDefinition {
  id: string
  uiModelIdentifier: `custom/${string}`
  baseModelIdentifier: string
  name: string
  description: string
  historyToolTag: string
  canonicalPrompt: string
  generation: {
    aspectRatio: string
    numImages: number
    enhancePrompt: boolean
  }
  referenceSlots: ImageStudioReferenceSlot[]
  inputKind: ImageStudioToolInputKind
  icon?: "product" | string
}

export interface DualReferenceSwapToolState {
  sourceImage: ImageUpload | null
  sceneImage: ImageUpload | null
}

export interface ImageStudioToolGenerationRequest {
  prompt: string
  tool: string
  model: string
  aspectRatio: string
  numImages: number
  enhancePrompt: boolean
  referenceImages: ImageUpload[]
}
