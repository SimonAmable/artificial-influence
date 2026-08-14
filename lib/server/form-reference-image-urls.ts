import { inferStoragePathFromUrl } from "@/lib/assets/library"
import { absolutizeAssetUrl } from "@/lib/assets/resolve-asset-access-url"
import { validateStoredReferenceImageUrl } from "@/lib/image/stored-reference-url"
import { isReplicateGptImage2Model } from "@/lib/server/replicate-gpt-image"
import { validateExternalReferenceUrl } from "@/lib/server/external-reference-url"
import { extractStorageObjectRef } from "@/lib/uploads/storage-ref"
import { resolveStoredObjectUrl } from "@/lib/uploads/server"
import {
  DEFAULT_UPLOAD_BUCKET,
  PRIVATE_UPLOAD_BUCKET,
  type UploadBucket,
} from "@/lib/uploads/shared"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { createClient } from "@/lib/supabase/server"

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

async function refreshStoredReferenceUrlIfNeeded(url: string): Promise<string> {
  if (url.startsWith("data:")) return url

  const absolute = absolutizeAssetUrl(url)
  const ref = extractStorageObjectRef(absolute)
  if (!ref) return absolute

  // Public bucket URLs are durable; signed/private need a fresh URL.
  if (absolute.includes("/object/public/")) return absolute

  try {
    const supabase = createServiceRoleClient() ?? (await createClient())
    return await resolveStoredObjectUrl(supabase, ref.bucket, ref.storagePath)
  } catch {
    return absolute
  }
}

async function readReferenceImageBytes(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const absoluteUrl = absolutizeAssetUrl(url)
  const storageRef = extractStorageObjectRef(absoluteUrl)

  if (storageRef) {
    const supabase = createServiceRoleClient() ?? (await createClient())
    const bucketsToTry: UploadBucket[] = storageRef.bucket
      ? [storageRef.bucket]
      : [DEFAULT_UPLOAD_BUCKET, PRIVATE_UPLOAD_BUCKET]

    let lastError: string | null = null
    for (const bucket of bucketsToTry) {
      const { data, error } = await supabase.storage.from(bucket).download(storageRef.storagePath)
      if (!error && data) {
        const buffer = Buffer.from(await data.arrayBuffer())
        if (buffer.length > MAX_REFERENCE_SIZE_BYTES) {
          throw new Error("Reference image is too large. Maximum size is 10MB.")
        }

        return {
          buffer,
          contentType: data.type || "image/png",
        }
      }
      lastError = error?.message ?? "Unknown error"
    }

    throw new Error(`Failed to download reference image: ${lastError ?? "Unknown error"}`)
  }

  if (url.startsWith("data:")) {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch reference image: HTTP ${response.status}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > MAX_REFERENCE_SIZE_BYTES) {
      throw new Error("Reference image is too large. Maximum size is 10MB.")
    }

    return {
      buffer,
      contentType: response.headers.get("content-type") || "image/png",
    }
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch reference image: HTTP ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length > MAX_REFERENCE_SIZE_BYTES) {
    throw new Error("Reference image is too large. Maximum size is 10MB.")
  }

  return {
    buffer,
    contentType: response.headers.get("content-type") || "image/png",
  }
}

export async function resolveFormReferenceImageUrl(
  url: string,
  options: {
    modelIdentifier: string
    replicateGptImage2ReferenceImages: File[]
  },
): Promise<{ url: string; storagePath: string | null }> {
  const absoluteUrl = absolutizeAssetUrl(url)
  validateStoredReferenceImageUrl(absoluteUrl)

  const refreshed = await refreshStoredReferenceUrlIfNeeded(absoluteUrl)

  const safeUrl = refreshed.startsWith("data:")
    ? refreshed
    : await validateExternalReferenceUrl({
        url: refreshed,
        expectedKind: "image",
        maxContentLengthBytes: MAX_REFERENCE_SIZE_BYTES,
      })

  const storagePath = inferStoragePathFromUrl(safeUrl)

  if (isReplicateGptImage2Model(options.modelIdentifier)) {
    const { buffer, contentType } = await readReferenceImageBytes(safeUrl)
    options.replicateGptImage2ReferenceImages.push(
      new File([buffer], "reference.png", { type: contentType }),
    )
  }

  return { url: safeUrl, storagePath }
}
