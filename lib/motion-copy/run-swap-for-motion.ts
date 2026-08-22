import type { ImageUpload } from "@/components/shared/upload/photo-upload"
import { extractFirstFrame } from "@/lib/canvas/frame-extraction"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import { generateImageAndWait } from "@/lib/generate-image-client"
import { appendImageReferencesToFormData } from "@/lib/image/append-references-to-form-data"
import { resolveReferenceImageForGeneration } from "@/lib/image/resolve-reference-for-generation"
import { resolveReferenceVideoForGeneration } from "@/lib/video/resolve-reference-for-generation"
import { CHARACTER_SWAP_TOOL } from "@/lib/image/studio-tools/character-swap"
import { FACE_SWAP_TOOL } from "@/lib/image/studio-tools/face-swap"
import { buildStudioToolGenerationRequest } from "@/lib/image/studio-tools/build-generation-request"
import {
  appendCharacterSwapVisionHints,
  fetchCharacterSwapVisionHints,
} from "@/lib/image/studio-tools"
import { getStudioToolFalQualityParams } from "@/lib/image/studio-tools/moderation-fallback"
import type { MotionCopyActiveSwapMode } from "@/lib/motion-copy/swap-mode"
import type { ImageStudioToolDefinition } from "@/lib/image/studio-tools/types"

export type MotionCopySwapResult = {
  anchorFrameUrl: string
  swappedImageUrl: string
  generationIds?: string[]
}

export type MotionCopySwapProgress =
  | { phase: "extracting_frame" }
  | { phase: "uploading_frame" }
  | { phase: "swapping" }
  | { phase: "ready" }

function swapToolForMode(mode: MotionCopyActiveSwapMode): ImageStudioToolDefinition {
  return mode === "face_swap" ? FACE_SWAP_TOOL : CHARACTER_SWAP_TOOL
}

function swapFailureMessage(mode: MotionCopyActiveSwapMode): string {
  return mode === "face_swap" ? "Face swap did not return an image" : "Character swap did not return an image"
}

/**
 * Extract the driving-video first frame, run Character or Face Swap, and return
 * public URLs for the Motion Copy preview card.
 */
export async function runSwapForMotionCopy(input: {
  swapMode: MotionCopyActiveSwapMode
  characterImage: ImageUpload
  drivingVideo: ImageUpload
  onProgress?: (progress: MotionCopySwapProgress) => void
}): Promise<MotionCopySwapResult> {
  const studioTool = swapToolForMode(input.swapMode)

  const resolvedCharacter = await resolveReferenceImageForGeneration(input.characterImage)
  if (!resolvedCharacter?.url && !resolvedCharacter?.file) {
    throw new Error("Please upload a character image")
  }

  const resolvedVideo = await resolveReferenceVideoForGeneration(input.drivingVideo)
  if (!resolvedVideo?.url) {
    throw new Error("Please upload a driving video")
  }

  input.onProgress?.({ phase: "extracting_frame" })
  const frame = await extractFirstFrame(resolvedVideo.url, "motion-copy-swap")

  input.onProgress?.({ phase: "uploading_frame" })
  const frameFile = new File([frame.blob], frame.filename, { type: "image/png" })
  const uploadedFrame = await uploadFileToSupabase(frameFile, "motion-copy-swap-frames")
  if (!uploadedFrame?.url) {
    throw new Error(`Failed to upload video frame for ${input.swapMode === "face_swap" ? "face" : "character"} swap`)
  }

  const sceneImage: ImageUpload = {
    url: uploadedFrame.url,
    file: frameFile,
  }

  const studioRequest = buildStudioToolGenerationRequest(studioTool, {
    sourceImage: resolvedCharacter,
    sceneImage,
  })

  let prompt = studioRequest.prompt
  if (input.swapMode === "character_swap") {
    const hints = await fetchCharacterSwapVisionHints(resolvedCharacter, sceneImage)
    prompt = appendCharacterSwapVisionHints(studioRequest.prompt, hints)
  }

  const formData = new FormData()
  formData.append("prompt", prompt)
  formData.append("model", studioRequest.model)
  formData.append("tool", studioRequest.tool)
  formData.append("aspect_ratio", studioRequest.aspectRatio)
  formData.append("enhancePrompt", String(studioRequest.enhancePrompt))
  if (studioRequest.numImages != null) {
    formData.append("n", String(studioRequest.numImages))
  }
  if (studioRequest.resolution) {
    formData.append("resolution", studioRequest.resolution)
  }
  if (
    studioRequest.model === "openai/gpt-image-2" ||
    studioRequest.model === "google/nano-banana-2-lite" ||
    studioRequest.model === "bytedance/seedream-5-lite"
  ) {
    for (const [key, value] of Object.entries(getStudioToolFalQualityParams(studioRequest.model))) {
      if (value == null || value === "") continue
      formData.append(key, String(value))
    }
  }

  const resolvedRefs: ImageUpload[] = []
  for (const ref of studioRequest.referenceImages) {
    const resolved = await resolveReferenceImageForGeneration(ref)
    if (resolved) resolvedRefs.push(resolved)
  }
  appendImageReferencesToFormData(formData, resolvedRefs)

  input.onProgress?.({ phase: "swapping" })
  const result = await generateImageAndWait(formData)
  const swappedImageUrl =
    result.image?.url ??
    (Array.isArray(result.images) && result.images[0]?.url ? result.images[0].url : null)

  if (!swappedImageUrl) {
    throw new Error(swapFailureMessage(input.swapMode))
  }

  input.onProgress?.({ phase: "ready" })
  return {
    anchorFrameUrl: uploadedFrame.url,
    swappedImageUrl,
    generationIds: result.generationIds,
  }
}

/** @deprecated Use runSwapForMotionCopy */
export async function runCharacterSwapForMotionCopy(input: {
  characterImage: ImageUpload
  drivingVideo: ImageUpload
  onProgress?: (progress: MotionCopySwapProgress) => void
}): Promise<MotionCopySwapResult> {
  return runSwapForMotionCopy({
    swapMode: "character_swap",
    characterImage: input.characterImage,
    drivingVideo: input.drivingVideo,
    onProgress: input.onProgress,
  })
}
