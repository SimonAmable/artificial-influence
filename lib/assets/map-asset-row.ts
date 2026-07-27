import type { SupabaseClient } from "@supabase/supabase-js"
import type { AssetCategory, AssetType, AssetVisibility } from "@/lib/assets/types"
import { loadPrivateVoiceSummariesByIds } from "@/lib/assets/private-voice"
import {
  loadUploadsByIds,
  resolveAssetAccessUrl,
  resolveAssetThumbnailUrl,
  type AssetAccessRow,
} from "@/lib/assets/resolve-asset-access-url"

function prettyVoiceLabel(voiceId: string) {
  if (voiceId.startsWith("private:")) return "Private voice"
  return voiceId.replace(/_/g, " ")
}

export async function mapAssetRowWithFreshUrl(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
  options?: {
    siteOrigin?: string | null
    uploadById?: Map<string, { id: string; bucket: string; storage_path: string }>
    privateVoiceById?: Map<
      string,
      {
        id: string
        name: string
        provider: string
        previewUrl: string | null
      }
    >
  },
) {
  const accessRow = row as AssetAccessRow
  const url = await resolveAssetAccessUrl(supabase, accessRow, options)
  const thumbnailUrl = await resolveAssetThumbnailUrl(supabase, accessRow, url, {
    siteOrigin: options?.siteOrigin,
  })
  const privateVoiceId =
    typeof row.private_voice_id === "string" && row.private_voice_id.trim()
      ? row.private_voice_id
      : null

  let privateVoiceById = options?.privateVoiceById
  if (privateVoiceId && !privateVoiceById?.has(privateVoiceId)) {
    privateVoiceById = await loadPrivateVoiceSummariesByIds(supabase, [privateVoiceId])
  }
  const privateVoice = privateVoiceId ? privateVoiceById?.get(privateVoiceId) : undefined

  const storedVoiceId =
    typeof row.voice_id === "string" && row.voice_id.trim() ? row.voice_id.trim() : null
  const storedVoiceProvider =
    typeof row.voice_provider === "string" && row.voice_provider.trim()
      ? row.voice_provider.trim()
      : null

  const voiceId =
    storedVoiceId ||
    (privateVoiceId ? `private:${privateVoiceId}` : null)
  const voiceProvider =
    storedVoiceProvider ||
    privateVoice?.provider ||
    null

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
    voiceId,
    voiceProvider,
    privateVoiceId,
    privateVoiceName: privateVoice?.name ?? (voiceId ? prettyVoiceLabel(voiceId) : null),
    privateVoicePreviewUrl: privateVoice?.previewUrl ?? null,
    privateVoiceProvider: privateVoice?.provider ?? voiceProvider,
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
  const privateVoiceIds = rows
    .map((row) =>
      typeof row.private_voice_id === "string" ? row.private_voice_id : "",
    )
    .filter(Boolean)

  const [uploadById, privateVoiceById] = await Promise.all([
    loadUploadsByIds(supabase, uploadIds),
    loadPrivateVoiceSummariesByIds(supabase, privateVoiceIds),
  ])

  return Promise.all(
    rows.map((row) =>
      mapAssetRowWithFreshUrl(supabase, row, {
        siteOrigin,
        uploadById,
        privateVoiceById,
      }),
    ),
  )
}
