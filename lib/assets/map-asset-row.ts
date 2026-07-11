import type { SupabaseClient } from "@supabase/supabase-js"
import type { AssetCategory, AssetType, AssetVisibility } from "@/lib/assets/types"
import {
  loadUploadsByIds,
  resolveAssetAccessUrl,
  resolveAssetThumbnailUrl,
  type AssetAccessRow,
} from "@/lib/assets/resolve-asset-access-url"

export async function mapAssetRowWithFreshUrl(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
  options?: {
    siteOrigin?: string | null
    uploadById?: Map<string, { id: string; bucket: string; storage_path: string }>
  },
) {
  const accessRow = row as AssetAccessRow
  const url = await resolveAssetAccessUrl(supabase, accessRow, options)
  const thumbnailUrl = await resolveAssetThumbnailUrl(supabase, accessRow, url, {
    siteOrigin: options?.siteOrigin,
  })

  return {
    id: row.id as string,
    userId: row.user_id as string,
    uploadId: (row.upload_id as string | null) || null,
    title: (row.title as string) || "Untitled Asset",
    description: (row.description as string | null) || null,
    assetType: row.asset_type as AssetType,
    category: row.category as AssetCategory,
    visibility: row.visibility as AssetVisibility,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    url,
    thumbnailUrl,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    sourceNodeType: (row.source_node_type as string | null) || null,
    sourceGenerationId: (row.source_generation_id as string | null) || null,
  }
}

export async function mapAssetRowsWithFreshUrls(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[],
  siteOrigin?: string | null,
) {
  const uploadIds = rows
    .map((row) => (typeof row.upload_id === "string" ? row.upload_id : ""))
    .filter(Boolean)
  const uploadById = await loadUploadsByIds(supabase, uploadIds)

  return Promise.all(
    rows.map((row) =>
      mapAssetRowWithFreshUrl(supabase, row, {
        siteOrigin,
        uploadById,
      }),
    ),
  )
}
