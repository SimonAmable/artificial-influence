import type { ImageUpload } from "@/components/shared/upload/photo-upload"
import { isStoredReferenceImageUrl } from "@/lib/image/is-stored-reference-image-url"

async function urlToImageFile(url: string, fileName = "reference.jpg"): Promise<File> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Could not load reference image (HTTP ${response.status})`)
  }

  const blob = await response.blob()
  if (!blob.type.startsWith("image/")) {
    throw new Error("Reference must be an image file")
  }

  const extension = blob.type.split("/")[1]?.split("+")[0] || "jpg"
  return new File([blob], fileName.replace(/\.[^.]+$/, "") + `.${extension}`, {
    type: blob.type,
  })
}

async function ingestExternalReferenceUrl(imageUrl: string): Promise<string> {
  const response = await fetch("/api/extension/capture-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl }),
  })

  const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!response.ok || !payload.url) {
    throw new Error(payload.error ?? "Could not import reference image")
  }

  return payload.url
}

/**
 * Ensures a reference image can be sent to generate-image: stored URLs pass through,
 * blob/data URLs become files, and external URLs are ingested server-side first.
 */
export async function resolveReferenceImageForGeneration(
  image: ImageUpload | null | undefined,
): Promise<ImageUpload | null> {
  if (!image) return null
  if (image.file) return image
  if (!image.url) return null

  if (isStoredReferenceImageUrl(image.url)) {
    return image
  }

  const trimmed = image.url.trim()
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) {
    const file = await urlToImageFile(trimmed)
    return { url: trimmed, file }
  }

  const storedUrl = await ingestExternalReferenceUrl(trimmed)
  return { url: storedUrl }
}
