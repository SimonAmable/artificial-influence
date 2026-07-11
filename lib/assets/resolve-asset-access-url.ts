import type { SupabaseClient } from "@supabase/supabase-js"
import { absolutizeAssetUrl } from "@/lib/assets/absolutize-asset-url"
import {
  DEFAULT_UPLOAD_BUCKET,
  PRIVATE_UPLOAD_BUCKET,
  type UploadBucket,
} from "@/lib/uploads/shared"
import { extractStorageObjectRef } from "@/lib/uploads/storage-ref"
import { resolveStoredObjectUrl } from "@/lib/uploads/resolve-stored-object-url"

export { absolutizeAssetUrl } from "@/lib/assets/absolutize-asset-url"

export type AssetAccessRow = {
  asset_url?: string | null
  thumbnail_url?: string | null
  upload_id?: string | null
  supabase_storage_path?: string | null
  visibility?: string | null
}

export type UploadLookupRow = {
  id: string
  bucket: string
  storage_path: string
}

function trimUrl(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : ""
}

function defaultBucketForAsset(row: AssetAccessRow): UploadBucket {
  if (row.visibility === "public") return DEFAULT_UPLOAD_BUCKET
  return PRIVATE_UPLOAD_BUCKET
}

function inferBucketAndPath(row: AssetAccessRow): { bucket: UploadBucket; storagePath: string } | null {
  const storagePath = trimUrl(row.supabase_storage_path)
  const rawUrl = absolutizeAssetUrl(trimUrl(row.asset_url))
  const fromUrl = rawUrl ? extractStorageObjectRef(rawUrl) : null

  if (storagePath) {
    return {
      bucket: fromUrl?.bucket || defaultBucketForAsset(row),
      storagePath,
    }
  }

  if (fromUrl) {
    return fromUrl
  }

  return null
}

/**
 * Resolve a fresh, absolute access URL for an asset row.
 * Prefer upload linkage / storage path over the cached `asset_url` (which may be an expired signed URL).
 */
export async function resolveAssetAccessUrl(
  supabase: SupabaseClient,
  row: AssetAccessRow,
  options?: {
    siteOrigin?: string | null
    uploadById?: Map<string, UploadLookupRow>
  },
): Promise<string> {
  const siteOrigin = options?.siteOrigin
  const uploadId = trimUrl(row.upload_id)

  if (uploadId) {
    let upload = options?.uploadById?.get(uploadId)
    if (!upload) {
      const { data } = await supabase
        .from("uploads")
        .select("id, bucket, storage_path")
        .eq("id", uploadId)
        .maybeSingle()
      if (data) {
        upload = data as UploadLookupRow
      }
    }

    if (upload?.storage_path) {
      return resolveStoredObjectUrl(supabase, upload.bucket, upload.storage_path)
    }
  }

  const inferred = inferBucketAndPath(row)
  if (inferred) {
    try {
      return await resolveStoredObjectUrl(supabase, inferred.bucket, inferred.storagePath)
    } catch {
      // Fall through to cached URL
    }
  }

  return absolutizeAssetUrl(trimUrl(row.asset_url), siteOrigin)
}

export async function resolveAssetThumbnailUrl(
  supabase: SupabaseClient,
  row: AssetAccessRow,
  accessUrl: string,
  options?: {
    siteOrigin?: string | null
  },
): Promise<string | null> {
  const rawThumb = trimUrl(row.thumbnail_url)
  if (!rawThumb) return null

  const absoluteThumb = absolutizeAssetUrl(rawThumb, options?.siteOrigin)
  const thumbRef = extractStorageObjectRef(absoluteThumb)
  if (thumbRef) {
    try {
      return await resolveStoredObjectUrl(supabase, thumbRef.bucket, thumbRef.storagePath)
    } catch {
      return absoluteThumb || accessUrl
    }
  }

  return absoluteThumb || null
}

export async function loadUploadsByIds(
  supabase: SupabaseClient,
  uploadIds: string[],
): Promise<Map<string, UploadLookupRow>> {
  const unique = [...new Set(uploadIds.map((id) => id.trim()).filter(Boolean))]
  const map = new Map<string, UploadLookupRow>()
  if (unique.length === 0) return map

  const { data, error } = await supabase
    .from("uploads")
    .select("id, bucket, storage_path")
    .in("id", unique)

  if (error || !data) return map

  for (const row of data) {
    map.set(String(row.id), row as UploadLookupRow)
  }
  return map
}
