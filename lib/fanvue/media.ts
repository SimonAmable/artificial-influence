import type { SupabaseClient } from "@supabase/supabase-js"

import { fanvueApiRequest, fanvueApiUploadPart } from "@/lib/fanvue/client"

export type FanvueMediaListItem = {
  uuid: string
  name?: string | null
  filename?: string | null
  mediaType?: string | null
  status?: string | null
  thumbnailUrl?: string | null
  createdAt?: string | null
}

type UploadSessionResponse = {
  mediaUuid: string
  uploadId: string
  partSize: number
  maxParts: number
  totalParts: number | null
}

type SignedPartResponse = {
  url: string
}

type MediaDetailResponse = {
  uuid?: string
  name?: string | null
  filename?: string | null
  mediaType?: string | null
  status?: string | null
  thumbnailUrl?: string | null
  createdAt?: string | null
}

type MediaListResponse = {
  data?: MediaDetailResponse[]
  items?: MediaDetailResponse[]
  nextCursor?: string | null
  cursor?: string | null
}

function inferFanvueMediaType(mimeType: string): "image" | "video" | "audio" | "document" {
  if (mimeType.startsWith("video/")) return "video"
  if (mimeType.startsWith("audio/")) return "audio"
  if (mimeType.startsWith("image/")) return "image"
  return "document"
}

function normalizeMediaItem(item: MediaDetailResponse): FanvueMediaListItem | null {
  if (!item.uuid) return null
  return {
    uuid: item.uuid,
    name: item.name ?? null,
    filename: item.filename ?? null,
    mediaType: item.mediaType ?? null,
    status: item.status ?? null,
    thumbnailUrl: item.thumbnailUrl ?? null,
    createdAt: item.createdAt ?? null,
  }
}

export async function listFanvueMedia(
  accessToken: string,
  params?: { cursor?: string; limit?: number }
): Promise<{ items: FanvueMediaListItem[]; nextCursor: string | null }> {
  const response = await fanvueApiRequest<MediaListResponse>({
    accessToken,
    path: "/users/media",
    searchParams: {
      cursor: params?.cursor,
      limit: params?.limit ?? 50,
    },
  })

  const raw = response.data ?? response.items ?? []
  const items = raw.map(normalizeMediaItem).filter((item): item is FanvueMediaListItem => item !== null)
  return { items, nextCursor: response.nextCursor ?? response.cursor ?? null }
}

export async function getFanvueMedia(accessToken: string, mediaUuid: string): Promise<FanvueMediaListItem | null> {
  const response = await fanvueApiRequest<MediaDetailResponse>({
    accessToken,
    path: `/media/${encodeURIComponent(mediaUuid)}`,
  })
  return normalizeMediaItem(response)
}

export async function waitForFanvueMediaReady(
  accessToken: string,
  mediaUuid: string,
  options?: { timeoutMs?: number; intervalMs?: number }
): Promise<FanvueMediaListItem> {
  const timeoutMs = options?.timeoutMs ?? 120_000
  const intervalMs = options?.intervalMs ?? 2_000
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    const media = await getFanvueMedia(accessToken, mediaUuid)
    const status = (media?.status ?? "").toLowerCase()
    if (media && (status === "ready" || status === "completed" || status === "active")) {
      return media
    }
    if (status === "failed" || status === "error") {
      throw new Error("Fanvue media processing failed.")
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error("Timed out waiting for Fanvue media to finish processing.")
}

export async function uploadFanvueMediaBuffer(params: {
  accessToken: string
  filename: string
  mimeType: string
  buffer: Buffer
  displayName?: string
}): Promise<FanvueMediaListItem> {
  const mediaType = inferFanvueMediaType(params.mimeType)
  const session = await fanvueApiRequest<UploadSessionResponse>({
    accessToken: params.accessToken,
    path: "/media/uploads",
    body: {
      name: params.displayName?.trim() || params.filename,
      filename: params.filename,
      mediaType,
      sizeBytes: params.buffer.byteLength,
    },
  })

  const partSize = session.partSize
  const totalParts =
    session.totalParts ?? Math.max(1, Math.ceil(params.buffer.byteLength / Math.max(partSize, 1)))

  for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
    const start = (partNumber - 1) * partSize
    const end = Math.min(start + partSize, params.buffer.byteLength)
    const chunk = params.buffer.subarray(start, end)

    const signed = await fanvueApiRequest<SignedPartResponse>({
      accessToken: params.accessToken,
      path: `/media/uploads/${encodeURIComponent(session.uploadId)}/parts/${partNumber}`,
    })

    await fanvueApiUploadPart(signed.url, chunk, params.mimeType)
  }

  await fanvueApiRequest({
    accessToken: params.accessToken,
    method: "POST",
    path: `/media/uploads/${encodeURIComponent(session.uploadId)}/complete`,
    body: {},
  })

  return waitForFanvueMediaReady(params.accessToken, session.mediaUuid)
}

export async function upsertFanvueMediaCache(
  supabase: SupabaseClient,
  row: {
    userId: string
    socialConnectionId: string
    media: FanvueMediaListItem
  }
) {
  const { error } = await supabase.from("fanvue_media_cache").upsert(
    {
      user_id: row.userId,
      social_connection_id: row.socialConnectionId,
      fanvue_media_uuid: row.media.uuid,
      name: row.media.name,
      filename: row.media.filename,
      media_type: row.media.mediaType,
      status: row.media.status ?? "processing",
      thumbnail_url: row.media.thumbnailUrl,
      metadata: {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "social_connection_id,fanvue_media_uuid" }
  )

  if (error) {
    console.error("[fanvue/media-upload] cache upsert failed:", error)
  }
}

export type FanvueVaultFolder = {
  name: string
  mediaCount?: number | null
}

type VaultFoldersResponse = {
  data?: Array<{ name?: string; mediaCount?: number }>
  items?: Array<{ name?: string; mediaCount?: number }>
}

export async function listFanvueVaultFolders(accessToken: string): Promise<FanvueVaultFolder[]> {
  const response = await fanvueApiRequest<VaultFoldersResponse>({
    accessToken,
    path: "/vault/folders",
  })
  const raw = response.data ?? response.items ?? []
  return raw
    .map((folder) => ({
      name: folder.name?.trim() ?? "",
      mediaCount: folder.mediaCount ?? null,
    }))
    .filter((folder) => folder.name.length > 0)
}

export async function listFanvueVaultFolderMedia(
  accessToken: string,
  folderName: string,
  params?: { cursor?: string; limit?: number }
): Promise<{ items: FanvueMediaListItem[]; nextCursor: string | null }> {
  const response = await fanvueApiRequest<MediaListResponse>({
    accessToken,
    path: `/vault/folders/${encodeURIComponent(folderName)}/media`,
    searchParams: {
      cursor: params?.cursor,
      limit: params?.limit ?? 50,
    },
  })

  const raw = response.data ?? response.items ?? []
  const items = raw.map(normalizeMediaItem).filter((item): item is FanvueMediaListItem => item !== null)
  return { items, nextCursor: response.nextCursor ?? response.cursor ?? null }
}
