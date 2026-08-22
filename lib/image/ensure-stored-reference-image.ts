import type { ImageUpload } from "@/components/shared/upload/photo-upload"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import { isStoredReferenceImageUrl } from "@/lib/image/is-stored-reference-image-url"
import { resolveReferenceImageForGeneration } from "@/lib/image/resolve-reference-for-generation"

/**
 * Persist a local reference image and return a stored URL without the File blob.
 * Vercel functions reject multi-MB payloads (FUNCTION_PAYLOAD_TOO_LARGE), so
 * analysis and generate-image must send URLs instead of raw files.
 */
export async function ensureStoredReferenceImage(
  image: ImageUpload | null | undefined,
): Promise<ImageUpload | null> {
  if (!image) return null

  if (image.url && isStoredReferenceImageUrl(image.url)) {
    return { url: image.url }
  }

  const resolved = image.file ? image : await resolveReferenceImageForGeneration(image)
  if (!resolved) return null

  if (resolved.url && isStoredReferenceImageUrl(resolved.url)) {
    return { url: resolved.url }
  }

  if (!resolved.file) {
    throw new Error("Could not prepare reference image")
  }

  const uploaded = await uploadFileToSupabase(resolved.file, "reference-images")
  if (!uploaded?.url) {
    throw new Error("Could not upload reference image")
  }

  return { url: uploaded.url }
}

export async function resolveAndStoreReferenceImage(
  image: ImageUpload | null | undefined,
): Promise<ImageUpload | null> {
  const resolved = await resolveReferenceImageForGeneration(image)
  return ensureStoredReferenceImage(resolved)
}
