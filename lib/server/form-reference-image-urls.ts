import { inferStoragePathFromUrl } from "@/lib/assets/library"
import { validateStoredReferenceImageUrl } from "@/lib/image/stored-reference-url"
import { isReplicateGptImage2Model } from "@/lib/server/replicate-gpt-image"
import { validateExternalReferenceUrl } from "@/lib/server/external-reference-url"

const MAX_REFERENCE_SIZE_BYTES = 10 * 1024 * 1024

export function parseReferenceImageUrlsFromForm(formData: FormData): string[] {
  const seen = new Set<string>()
  const urls: string[] = []

  for (const value of formData.getAll("referenceImageUrls")) {
    if (typeof value !== "string") continue
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    urls.push(trimmed)
  }

  return urls
}

export async function resolveFormReferenceImageUrl(
  url: string,
  options: {
    modelIdentifier: string
    replicateGptImage2ReferenceImages: File[]
  },
): Promise<{ url: string; storagePath: string | null }> {
  validateStoredReferenceImageUrl(url)

  const safeUrl = url.startsWith("data:")
    ? url
    : await validateExternalReferenceUrl({
        url,
        expectedKind: "image",
        maxContentLengthBytes: MAX_REFERENCE_SIZE_BYTES,
      })

  const storagePath = inferStoragePathFromUrl(safeUrl)

  if (isReplicateGptImage2Model(options.modelIdentifier)) {
    const response = await fetch(safeUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch reference image: HTTP ${response.status}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > MAX_REFERENCE_SIZE_BYTES) {
      throw new Error("Reference image is too large. Maximum size is 10MB.")
    }

    const contentType = response.headers.get("content-type") || "image/png"
    options.replicateGptImage2ReferenceImages.push(
      new File([buffer], "reference.png", { type: contentType }),
    )
  }

  return { url: safeUrl, storagePath }
}
