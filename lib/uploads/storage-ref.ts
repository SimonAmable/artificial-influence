import { DEFAULT_UPLOAD_BUCKET, type UploadBucket } from "@/lib/uploads/shared"

export type StorageObjectRef = {
  bucket: UploadBucket
  storagePath: string
}

function trimLeadingSlash(value: string) {
  return value.replace(/^\/+/, "")
}

export function buildPublicObjectUrl(
  supabaseUrl: string,
  bucket: UploadBucket,
  storagePath: string,
) {
  const normalizedPath = trimLeadingSlash(storagePath)
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${normalizedPath}`
}

export function extractStorageObjectRef(url: string): StorageObjectRef | null {
  if (!url) return null

  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname

    const publicMatch = pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/)
    if (publicMatch) {
      return {
        bucket: decodeURIComponent(publicMatch[1]!),
        storagePath: decodeURIComponent(publicMatch[2]!),
      }
    }

    const signedMatch = pathname.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+)/)
    if (signedMatch) {
      return {
        bucket: decodeURIComponent(signedMatch[1]!),
        storagePath: decodeURIComponent(signedMatch[2]!),
      }
    }

    const renderPublicMatch = pathname.match(/\/storage\/v1\/render\/image\/public\/([^/]+)\/(.+)/)
    if (renderPublicMatch) {
      return {
        bucket: decodeURIComponent(renderPublicMatch[1]!),
        storagePath: decodeURIComponent(renderPublicMatch[2]!),
      }
    }

    const fallbackBucketMatch = pathname.match(/\/(public-bucket|private-bucket)\/(.+)/)
    if (fallbackBucketMatch) {
      return {
        bucket: decodeURIComponent(fallbackBucketMatch[1]!),
        storagePath: decodeURIComponent(fallbackBucketMatch[2]!),
      }
    }
  } catch {
    return null
  }

  return null
}

export function inferStoragePathFromUrl(url: string): string | null {
  return extractStorageObjectRef(url)?.storagePath ?? null
}

export function isPublicBucket(bucket: UploadBucket) {
  return bucket === DEFAULT_UPLOAD_BUCKET
}
