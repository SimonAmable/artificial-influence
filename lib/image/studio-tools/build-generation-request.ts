import type { ImageUpload } from "@/components/shared/upload/photo-upload"
import type {
  DualReferenceSwapToolState,
  ImageStudioToolDefinition,
  ImageStudioToolGenerationRequest,
} from "./types"
import { resolveBackendModelIdentifier } from "./registry"

export interface StudioToolValidationError {
  field: "source" | "scene"
  message: string
}

export function validateDualReferenceSwapState(
  tool: ImageStudioToolDefinition,
  state: DualReferenceSwapToolState,
): StudioToolValidationError | null {
  const sourceSlot = tool.referenceSlots[0]
  const sceneSlot = tool.referenceSlots[1]

  if (!state.sourceImage?.file && !state.sourceImage?.url) {
    return {
      field: "source",
      message: `Please upload a ${sourceSlot?.label?.toLowerCase() ?? "source"} image`,
    }
  }

  if (!state.sceneImage?.file && !state.sceneImage?.url) {
    return {
      field: "scene",
      message: `Please upload a ${sceneSlot?.label?.toLowerCase() ?? "scene"} image`,
    }
  }

  return null
}

export function buildStudioToolGenerationRequest(
  tool: ImageStudioToolDefinition,
  state: DualReferenceSwapToolState,
): ImageStudioToolGenerationRequest {
  const generationImages = tool.includeSceneReferenceInGeneration === false
    ? [state.sourceImage]
    : [state.sourceImage, state.sceneImage]
  const referenceImages = generationImages.filter(
    (image): image is ImageUpload => Boolean(image),
  )

  return {
    prompt: tool.canonicalPrompt,
    tool: tool.historyToolTag,
    model: resolveBackendModelIdentifier(tool.uiModelIdentifier),
    aspectRatio: tool.generation.aspectRatio,
    numImages: tool.generation.numImages,
    enhancePrompt: tool.generation.enhancePrompt,
    resolution: tool.generation.resolution,
    referenceImages,
  }
}
