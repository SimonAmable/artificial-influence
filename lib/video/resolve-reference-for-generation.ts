import type { ImageUpload } from "@/components/shared/upload/photo-upload"
import { isStoredReferenceImageUrl } from "@/lib/image/is-stored-reference-image-url"

/**
 * Ensures a reference video can be sent to video generation: stored URLs pass through,
 * blob/data URLs become files for upload.
 */
export async function resolveReferenceVideoForGeneration(
  video: ImageUpload | null | undefined,
): Promise<ImageUpload | null> {
  if (!video) return null
  if (video.file) return video
  if (!video.url) return null

  if (isStoredReferenceImageUrl(video.url)) {
    return video
  }

  const trimmed = video.url.trim()
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) {
    const response = await fetch(trimmed)
    if (!response.ok) {
      throw new Error(`Could not load reference video (HTTP ${response.status})`)
    }
    const blob = await response.blob()
    if (!blob.type.startsWith("video/")) {
      throw new Error("Reference must be a video file")
    }
    const extension = blob.type.split("/")[1]?.split("+")[0] || "mp4"
    const file = new File([blob], `reference.${extension}`, { type: blob.type })
    return { url: trimmed, file }
  }

  return video
}
