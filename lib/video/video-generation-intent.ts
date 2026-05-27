import type { ImageUpload } from "@/components/shared/upload/photo-upload"
import type { AudioUploadValue } from "@/components/shared/upload/audio-upload"
import type { MultiShotItem } from "@/components/tools/video/multi-shot-editor"
import type { AttachedRef } from "@/lib/commands/types"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"

export const VIDEO_GENERATION_INTENT_STORAGE_KEY = "unican:video-generation-intent"

export type VideoGenerationIntent = {
  prompt: string
  negativePrompt: string
  attachedRefs: AttachedRef[]
  model: string
  parameters: Record<string, unknown>
  multiShotMode: boolean
  multiShotShots: MultiShotItem[]
  inputImageUrl: string | null
  lastFrameImageUrl: string | null
  inputVideoUrl: string | null
  inputAudioUrl: string | null
  referenceImageUrls: string[]
}

export function saveVideoGenerationIntent(intent: VideoGenerationIntent): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(VIDEO_GENERATION_INTENT_STORAGE_KEY, JSON.stringify(intent))
}

export function consumeVideoGenerationIntent(): VideoGenerationIntent | null {
  if (typeof window === "undefined") return null

  const raw = sessionStorage.getItem(VIDEO_GENERATION_INTENT_STORAGE_KEY)
  if (!raw) return null

  sessionStorage.removeItem(VIDEO_GENERATION_INTENT_STORAGE_KEY)

  try {
    return JSON.parse(raw) as VideoGenerationIntent
  } catch {
    return null
  }
}

export function buildVideoPageGenerateHref(): string {
  const params = new URLSearchParams({ generate: "1" })
  return `/video?${params.toString()}`
}

async function resolveUploadUrl(
  source: { url?: string | null; file?: File | null } | null | undefined
): Promise<string | null> {
  if (!source) return null
  if (source.url) return source.url
  if (!source.file) return null

  const result = await uploadFileToSupabase(source.file, "asset-library")
  return result?.url ?? null
}

export async function resolveVideoGenerationIntentUploads({
  inputImage,
  lastFrameImage,
  inputVideo,
  inputAudio,
  referenceImages,
}: {
  inputImage: ImageUpload | null
  lastFrameImage: ImageUpload | null
  inputVideo: ImageUpload | null
  inputAudio: AudioUploadValue | null
  referenceImages: ImageUpload[]
}): Promise<{
  inputImageUrl: string | null
  lastFrameImageUrl: string | null
  inputVideoUrl: string | null
  inputAudioUrl: string | null
  referenceImageUrls: string[]
}> {
  const [inputImageUrl, lastFrameImageUrl, inputVideoUrl, inputAudioUrl] = await Promise.all([
    resolveUploadUrl(inputImage),
    resolveUploadUrl(lastFrameImage),
    resolveUploadUrl(inputVideo),
    resolveUploadUrl(inputAudio),
  ])

  const referenceImageUrls = (
    await Promise.all(referenceImages.map((image) => resolveUploadUrl(image)))
  ).filter((url): url is string => Boolean(url))

  return {
    inputImageUrl,
    lastFrameImageUrl,
    inputVideoUrl,
    inputAudioUrl,
    referenceImageUrls: [...new Set(referenceImageUrls)],
  }
}
