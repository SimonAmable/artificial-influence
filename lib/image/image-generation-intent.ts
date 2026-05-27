import type { AttachedRef } from "@/lib/commands/types"
import type { ImageUpload } from "@/components/shared/upload/photo-upload"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"

export const IMAGE_GENERATION_INTENT_STORAGE_KEY = "unican:image-generation-intent"

export type ImageGenerationIntent = {
  prompt: string
  attachedRefs: AttachedRef[]
  referenceImageUrls: string[]
  enhancePrompt: boolean
  model: string
  aspectRatio: string
  numImages: number
}

export function saveImageGenerationIntent(intent: ImageGenerationIntent): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(IMAGE_GENERATION_INTENT_STORAGE_KEY, JSON.stringify(intent))
}

export function consumeImageGenerationIntent(): ImageGenerationIntent | null {
  if (typeof window === "undefined") return null

  const raw = sessionStorage.getItem(IMAGE_GENERATION_INTENT_STORAGE_KEY)
  if (!raw) return null

  sessionStorage.removeItem(IMAGE_GENERATION_INTENT_STORAGE_KEY)

  try {
    return JSON.parse(raw) as ImageGenerationIntent
  } catch {
    return null
  }
}

export function buildImagePageGenerateHref(): string {
  const params = new URLSearchParams({ generate: "1" })
  return `/image?${params.toString()}`
}

/** Resolve reference uploads to public URLs so intent survives a route change. */
export async function resolveReferenceImageUrls(
  referenceImages: ImageUpload[],
  referenceImage: ImageUpload | null
): Promise<string[]> {
  const sources =
    referenceImages.length > 0
      ? referenceImages
      : referenceImage
        ? [referenceImage]
        : []

  const urls: string[] = []

  for (const image of sources) {
    if (image.url) {
      urls.push(image.url)
      continue
    }

    if (!image.file) continue

    const result = await uploadFileToSupabase(image.file, "asset-library")
    if (result?.url) {
      urls.push(result.url)
    }
  }

  return [...new Set(urls)]
}
