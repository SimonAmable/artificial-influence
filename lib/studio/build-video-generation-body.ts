import type { AudioUploadValue } from "@/components/shared/upload/audio-upload"
import type { ImageUpload } from "@/components/shared/upload/photo-upload"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import {
  isHappyHorseModelIdentifier,
  isMinimaxH3ModelIdentifier,
  isSeedanceVideoModelIdentifier,
  usesFalMultimodalVideoInputs,
} from "@/lib/constants/models"
import type { StudioBoardFields } from "@/lib/studio/types"

async function resolveMediaUrl(
  media: { file?: File; url?: string } | null | undefined,
  prefix: string,
): Promise<string | null> {
  if (!media) return null
  if (media.file) {
    const uploaded = await uploadFileToSupabase(media.file, prefix)
    if (!uploaded) {
      throw new Error("Failed to upload file")
    }
    return uploaded.url
  }
  const url = media.url?.trim()
  return url || null
}

export async function buildStudioVideoGenerationBody(options: {
  modelIdentifier: string
  prompt: string
  negativePrompt: string
  parameters: Record<string, unknown>
  inputImage: ImageUpload | null
  lastFrameImage: ImageUpload | null
  inputVideo: ImageUpload | null
  inputAudio: AudioUploadValue | null
  referenceImages: ImageUpload[]
  studio: StudioBoardFields
}): Promise<Record<string, unknown>> {
  const modelId = options.modelIdentifier
  const otherParameters = { ...options.parameters }
  delete otherParameters.image
  delete otherParameters.video

  const body: Record<string, unknown> = {
    model: modelId,
    prompt: options.prompt,
    tool: "video",
    studioProjectId: options.studio.studio_project_id,
    studioX: options.studio.studio_x,
    studioY: options.studio.studio_y,
    studioWidth: options.studio.studio_width,
    studioHeight: options.studio.studio_height,
    ...otherParameters,
  }

  if (options.negativePrompt.trim()) {
    body.negative_prompt = options.negativePrompt.trim()
  }

  if (isHappyHorseModelIdentifier(modelId) || isMinimaxH3ModelIdentifier(modelId)) {
    body.enable_safety_checker = false
  }

  const startUrl = await resolveMediaUrl(options.inputImage, "studio-video-start")
  const lastUrl = await resolveMediaUrl(options.lastFrameImage, "studio-video-last")
  const videoUrl = await resolveMediaUrl(options.inputVideo, "studio-video-ref")
  const audioUrl = await resolveMediaUrl(options.inputAudio, "studio-video-audio")

  const isKlingV3 = modelId === "kwaivgi/kling-v3-video"
  const isKlingV3Omni = modelId === "kwaivgi/kling-v3-omni-video"
  const isKling26 = modelId === "kwaivgi/kling-v2.6"
  const isSeedance = isSeedanceVideoModelIdentifier(modelId)
  const isMinimax = isMinimaxH3ModelIdentifier(modelId)
  const isFalMulti = usesFalMultimodalVideoInputs(modelId)
  const isHailuo = modelId === "minimax/hailuo-2.3-fast"

  if (startUrl) {
    if (isKling26 || isKlingV3 || isKlingV3Omni) {
      body.start_image = startUrl
    } else if (isHailuo) {
      body.first_frame_image = startUrl
    } else {
      body.image = startUrl
    }
  }

  if (lastUrl) {
    body.last_frame = lastUrl
    if (isSeedance || isMinimax) body.last_frame_image = lastUrl
    if (isKlingV3 || isKlingV3Omni) body.end_image = lastUrl
  }

  if (videoUrl) {
    if (isSeedance || isMinimax) {
      body.reference_videos = [videoUrl]
    } else {
      body.video = videoUrl
    }
  }

  if (audioUrl) {
    if (isSeedance || isMinimax) {
      body.reference_audios = [audioUrl]
    } else {
      body.audio = audioUrl
    }
  }

  if ((isKlingV3Omni || isSeedance || isFalMulti) && options.referenceImages.length > 0) {
    const urls: string[] = []
    for (const image of options.referenceImages) {
      const url = await resolveMediaUrl(image, "studio-video-refs")
      if (url) urls.push(url)
    }
    if (urls.length > 0) body.reference_images = urls
  }

  return body
}
