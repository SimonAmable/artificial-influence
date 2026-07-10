import type { SupabaseClient } from "@supabase/supabase-js"

import { fanvueApiRequest, fanvueApiRequestText, fanvueApiUploadPart } from "@/lib/fanvue/client"

export type FanvueMediaSource = "presence" | "fanvue"

export type FanvueMediaListItem = {
  uuid: string
  name?: string | null
  filename?: string | null
  caption?: string | null
  mediaType?: string | null
  status?: string | null
  thumbnailUrl?: string | null
  createdAt?: string | null
  mediaSource?: FanvueMediaSource | null
  recommendedPrice?: number | null
}

type UploadSessionResponse = {
  mediaUuid: string
  uploadId: string
  partSize: number
  maxParts: number
  totalParts: number | null
}

type CompleteUploadPart = {
  PartNumber: number
  ETag?: string
}

type MediaVariant = {
  variantType?: string
  url?: string
}

type MediaDetailResponse = {
  uuid?: string
  name?: string | null
  filename?: string | null
  caption?: string | null
  mediaType?: string | null
  status?: string | null
  thumbnailUrl?: string | null
  createdAt?: string | null
  recommendedPrice?: number | null
  variants?: MediaVariant[]
}

type FanvuePagination = {
  page?: number
  size?: number
  hasMore?: boolean
}

type MediaListResponse = {
  data?: MediaDetailResponse[]
  items?: MediaDetailResponse[]
  pagination?: FanvuePagination
  nextCursor?: string | null
  cursor?: string | null
}

const FANVUE_MEDIA_VARIANTS = "thumbnail,thumbnail_gallery,main"
const FANVUE_BULK_MEDIA_BATCH_SIZE = 20
const FANVUE_MEDIA_MAX_PAGES = 20

export function isFanvueMediaReadyStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? "").toLowerCase()
  return (
    normalized === "ready" ||
    normalized === "completed" ||
    normalized === "active" ||
    normalized === "finalised" ||
    normalized === "finalized"
  )
}

export function isFanvueMediaFailedStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? "").toLowerCase()
  return normalized === "failed" || normalized === "error"
}

export function isFanvueMediaProcessingStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? "").toLowerCase()
  return normalized === "processing" || normalized === "created" || normalized === "uploading"
}

export function isFanvueMediaIncompleteStatus(status: string | null | undefined): boolean {
  return isFanvueMediaFailedStatus(status) || isFanvueMediaProcessingStatus(status)
}

type FanvueMediaBrowsableFields = Pick<
  FanvueMediaListItem,
  "status" | "thumbnailUrl" | "name" | "filename"
>

export function isFanvueMediaBrowsable(item: FanvueMediaBrowsableFields): boolean {
  if (isFanvueMediaIncompleteStatus(item.status)) return false
  if (item.thumbnailUrl) return true
  if (isFanvueMediaReadyStatus(item.status)) return true
  return Boolean(item.name?.trim() || item.filename?.trim())
}

export function partitionFanvueMediaItems(items: FanvueMediaListItem[]): {
  browsable: FanvueMediaListItem[]
  hidden: FanvueMediaListItem[]
} {
  const browsable: FanvueMediaListItem[] = []
  const hidden: FanvueMediaListItem[] = []
  for (const item of items) {
    if (isFanvueMediaBrowsable(item)) {
      browsable.push(item)
    } else {
      hidden.push(item)
    }
  }
  return { browsable, hidden }
}

function resolveFanvuePageParams(params?: { cursor?: string; limit?: number }) {
  const parsedPage = Number(params?.cursor)
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1
  const size = Math.min(Math.max(params?.limit ?? 50, 1), 50)
  return { page, size }
}

function resolveNextPageCursor(pagination?: FanvuePagination): string | null {
  if (!pagination?.hasMore) return null
  return String((pagination.page ?? 1) + 1)
}

function pickThumbnailUrl(item: MediaDetailResponse): string | null {
  if (item.thumbnailUrl) return item.thumbnailUrl

  const variants = item.variants ?? []
  const thumbnail =
    variants.find((variant) => variant.variantType === "thumbnail") ??
    variants.find((variant) => variant.variantType === "thumbnail_gallery") ??
    variants.find((variant) => variant.variantType === "main")

  return thumbnail?.url ?? null
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
    caption: item.caption ?? null,
    mediaType: item.mediaType ?? null,
    status: item.status ?? null,
    thumbnailUrl: pickThumbnailUrl(item),
    createdAt: item.createdAt ?? null,
    recommendedPrice: item.recommendedPrice ?? null,
  }
}

function mergeFanvueMediaItem(
  base: FanvueMediaListItem,
  patch: FanvueMediaListItem | null | undefined
): FanvueMediaListItem {
  if (!patch) return base
  return {
    ...base,
    name: patch.name ?? base.name,
    filename: patch.filename ?? base.filename,
    caption: patch.caption ?? base.caption,
    mediaType: patch.mediaType ?? base.mediaType,
    status: patch.status ?? base.status,
    thumbnailUrl: patch.thumbnailUrl ?? base.thumbnailUrl,
    createdAt: patch.createdAt ?? base.createdAt,
    recommendedPrice: patch.recommendedPrice ?? base.recommendedPrice,
    mediaSource: base.mediaSource ?? patch.mediaSource,
  }
}

function mediaItemNeedsHydration(item: FanvueMediaListItem): boolean {
  if (!item.thumbnailUrl) return true
  if (!item.name && !item.filename) return true
  if (isFanvueMediaProcessingStatus(item.status)) return true
  return false
}

/**
 * Creator OAuth uploads use the authenticated-user media endpoints from Fanvue's
 * multipart tutorial (`POST/GET/PATCH /media/uploads`), not the agency
 * `/creators/{uuid}/media/uploads` routes.
 */
const FANVUE_SELF_MEDIA_UPLOAD_PATHS = {
  createSessionPath: "/media/uploads",
  completeSessionPath: (uploadId: string) => `/media/uploads/${encodeURIComponent(uploadId)}`,
  partUploadPath: (uploadId: string, partNumber: number) =>
    `/media/uploads/${encodeURIComponent(uploadId)}/parts/${partNumber}/url`,
} as const

async function resolveSignedPartUploadUrl(params: {
  accessToken: string
  uploadId: string
  partNumber: number
}): Promise<string> {
  const url = await fanvueApiRequestText({
    accessToken: params.accessToken,
    path: FANVUE_SELF_MEDIA_UPLOAD_PATHS.partUploadPath(params.uploadId, params.partNumber),
  })
  if (!url) {
    throw new Error(`Fanvue did not return an upload URL for part ${params.partNumber}.`)
  }
  return url
}

export async function getFanvueBulkMedia(
  accessToken: string,
  mediaUuids: string[]
): Promise<FanvueMediaListItem[]> {
  const uniqueUuids = Array.from(new Set(mediaUuids.map((uuid) => uuid.trim()).filter(Boolean)))
  if (uniqueUuids.length === 0) return []

  const response = await fanvueApiRequest<MediaListResponse>({
    accessToken,
    path: "/media/bulk",
    searchParams: {
      mediaUuids: uniqueUuids.join(","),
      variants: FANVUE_MEDIA_VARIANTS,
    },
  })

  const raw = response.data ?? response.items ?? []
  return raw.map(normalizeMediaItem).filter((item): item is FanvueMediaListItem => item !== null)
}

export async function enrichFanvueMediaList(
  accessToken: string,
  items: FanvueMediaListItem[],
  options?: { forceHydrateUuids?: ReadonlySet<string> }
): Promise<FanvueMediaListItem[]> {
  const uuidsToHydrate = items
    .filter(
      (item) => mediaItemNeedsHydration(item) || options?.forceHydrateUuids?.has(item.uuid)
    )
    .map((item) => item.uuid)
  if (uuidsToHydrate.length === 0) return items

  const hydratedByUuid = new Map<string, FanvueMediaListItem>()
  for (let index = 0; index < uuidsToHydrate.length; index += FANVUE_BULK_MEDIA_BATCH_SIZE) {
    const batch = uuidsToHydrate.slice(index, index + FANVUE_BULK_MEDIA_BATCH_SIZE)
    const batchItems = await getFanvueBulkMedia(accessToken, batch)
    for (const item of batchItems) {
      hydratedByUuid.set(item.uuid, item)
    }
  }

  return items.map((item) => mergeFanvueMediaItem(item, hydratedByUuid.get(item.uuid)))
}

async function listAllFanvueMediaPages(
  loader: (cursor?: string) => Promise<{ items: FanvueMediaListItem[]; nextCursor: string | null }>,
  options?: { cursor?: string; singlePage?: boolean }
): Promise<{ items: FanvueMediaListItem[]; nextCursor: string | null }> {
  if (options?.singlePage) {
    return loader(options.cursor)
  }

  const merged: FanvueMediaListItem[] = []
  let cursor = options?.cursor
  let nextCursor: string | null = null

  for (let page = 0; page < FANVUE_MEDIA_MAX_PAGES; page += 1) {
    const result = await loader(cursor)
    merged.push(...result.items)
    nextCursor = result.nextCursor
    if (!result.nextCursor) break
    cursor = result.nextCursor
  }

  return { items: merged, nextCursor }
}

export async function listAllFanvueMedia(
  accessToken: string,
  params?: { cursor?: string; limit?: number; singlePage?: boolean }
): Promise<{ items: FanvueMediaListItem[]; nextCursor: string | null }> {
  return listAllFanvueMediaPages(
    (cursor) => listFanvueMedia(accessToken, { cursor, limit: params?.limit }),
    { cursor: params?.cursor, singlePage: params?.singlePage }
  )
}

export async function listAllFanvueVaultFolderMedia(
  accessToken: string,
  folderName: string,
  params?: { cursor?: string; limit?: number; singlePage?: boolean }
): Promise<{ items: FanvueMediaListItem[]; nextCursor: string | null }> {
  return listAllFanvueMediaPages(
    (cursor) => listFanvueVaultFolderMedia(accessToken, folderName, { cursor, limit: params?.limit }),
    { cursor: params?.cursor, singlePage: params?.singlePage }
  )
}

type FanvueMediaCacheRow = {
  fanvue_media_uuid: string
  name: string | null
  filename: string | null
  thumbnail_url: string | null
  status: string | null
}

export async function listFanvueMediaCacheRows(
  supabase: SupabaseClient,
  params: { userId: string; socialConnectionId: string }
): Promise<Map<string, FanvueMediaCacheRow>> {
  const { data, error } = await supabase
    .from("fanvue_media_cache")
    .select("fanvue_media_uuid, name, filename, thumbnail_url, status")
    .eq("user_id", params.userId)
    .eq("social_connection_id", params.socialConnectionId)

  if (error) {
    console.error("[fanvue/media] cache rows lookup failed:", error)
    return new Map()
  }

  return new Map(
    (data ?? [])
      .filter((row) => row.fanvue_media_uuid)
      .map((row) => [row.fanvue_media_uuid as string, row as FanvueMediaCacheRow])
  )
}

export function mergeFanvueMediaWithCache(
  items: FanvueMediaListItem[],
  cacheRows: Map<string, FanvueMediaCacheRow>
): FanvueMediaListItem[] {
  return items.map((item) => {
    const cached = cacheRows.get(item.uuid)
    if (!cached) return item

    return mergeFanvueMediaItem(
      {
        uuid: item.uuid,
        name: cached.name,
        filename: cached.filename,
        thumbnailUrl: cached.thumbnail_url,
        status: cached.status,
      },
      item
    )
  })
}

export async function loadHydratedFanvueMedia(params: {
  supabase: SupabaseClient
  accessToken: string
  userId: string
  socialConnectionId: string
  folderName?: string
  cursor?: string
  limit?: number
  singlePage?: boolean
}): Promise<{ items: FanvueMediaListItem[]; nextCursor: string | null }> {
  const listed = params.folderName
    ? await listAllFanvueVaultFolderMedia(params.accessToken, params.folderName, {
        cursor: params.cursor,
        limit: params.limit,
        singlePage: params.singlePage,
      })
    : await listAllFanvueMedia(params.accessToken, {
        cursor: params.cursor,
        limit: params.limit,
        singlePage: params.singlePage,
      })

  const presenceUuids = await listPresenceUploadedMediaUuids(params.supabase, {
    userId: params.userId,
    socialConnectionId: params.socialConnectionId,
  })

  const enriched = await enrichFanvueMediaList(params.accessToken, listed.items, {
    forceHydrateUuids: presenceUuids,
  })
  const cacheRows = await listFanvueMediaCacheRows(params.supabase, {
    userId: params.userId,
    socialConnectionId: params.socialConnectionId,
  })
  const merged = mergeFanvueMediaWithCache(enriched, cacheRows)

  await Promise.all(
    merged
      .filter((item) => presenceUuids.has(item.uuid) && item.thumbnailUrl)
      .map((item) =>
        upsertFanvueMediaCache(params.supabase, {
          userId: params.userId,
          socialConnectionId: params.socialConnectionId,
          media: item,
        })
      )
  )

  return {
    items: annotateFanvueMediaSources(merged, presenceUuids),
    nextCursor: listed.nextCursor,
  }
}

export async function listFanvueMedia(
  accessToken: string,
  params?: { cursor?: string; limit?: number }
): Promise<{ items: FanvueMediaListItem[]; nextCursor: string | null }> {
  const { page, size } = resolveFanvuePageParams(params)
  const response = await fanvueApiRequest<MediaListResponse>({
    accessToken,
    path: "/media",
    searchParams: {
      page,
      size,
      variants: FANVUE_MEDIA_VARIANTS,
    },
  })

  const raw = response.data ?? response.items ?? []
  const items = raw.map(normalizeMediaItem).filter((item): item is FanvueMediaListItem => item !== null)
  return {
    items,
    nextCursor: resolveNextPageCursor(response.pagination) ?? response.nextCursor ?? response.cursor ?? null,
  }
}

export async function getFanvueMedia(accessToken: string, mediaUuid: string): Promise<FanvueMediaListItem | null> {
  const response = await fanvueApiRequest<MediaDetailResponse>({
    accessToken,
    path: `/media/${encodeURIComponent(mediaUuid)}`,
    searchParams: {
      variants: FANVUE_MEDIA_VARIANTS,
    },
  })
  return normalizeMediaItem(response)
}

type UpdateFanvueMediaInput = {
  name?: string | null
  caption?: string | null
  recommendedPrice?: number | null
}

export async function updateFanvueMedia(
  accessToken: string,
  mediaUuid: string,
  input: UpdateFanvueMediaInput
): Promise<FanvueMediaListItem> {
  const body: UpdateFanvueMediaInput = {}
  if ("name" in input) body.name = input.name
  if ("caption" in input) body.caption = input.caption
  if ("recommendedPrice" in input) body.recommendedPrice = input.recommendedPrice

  if (!("name" in body) && !("caption" in body) && !("recommendedPrice" in body)) {
    throw new Error("At least one field must be provided to update media.")
  }

  const response = await fanvueApiRequest<{
    uuid?: string
    name?: string | null
    caption?: string | null
    recommendedPrice?: number | null
  }>({
    accessToken,
    method: "PATCH",
    path: `/media/${encodeURIComponent(mediaUuid)}`,
    body,
  })

  const media = await getFanvueMedia(accessToken, response.uuid ?? mediaUuid)
  if (!media) {
    throw new Error("Updated media could not be loaded.")
  }
  return media
}

type UpdateFanvueVaultFolderMediaInput = {
  name?: string | null
  recommendedPrice?: number | null
}

export async function updateFanvueVaultFolderMedia(
  accessToken: string,
  folderName: string,
  mediaUuid: string,
  input: UpdateFanvueVaultFolderMediaInput
): Promise<void> {
  const body: UpdateFanvueVaultFolderMediaInput = {}
  if ("name" in input) body.name = input.name
  if ("recommendedPrice" in input) body.recommendedPrice = input.recommendedPrice

  if (!("name" in body) && !("recommendedPrice" in body)) {
    throw new Error("At least one field must be provided to update folder media.")
  }

  await fanvueApiRequest({
    accessToken,
    method: "PATCH",
    path: `/vault/folders/${encodeURIComponent(folderName)}/media/${encodeURIComponent(mediaUuid)}`,
    body,
  })
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
    if (media && isFanvueMediaReadyStatus(status)) {
      return media
    }
    if (isFanvueMediaFailedStatus(status)) {
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
    path: FANVUE_SELF_MEDIA_UPLOAD_PATHS.createSessionPath,
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
  const completedParts: CompleteUploadPart[] = []

  for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
    const start = (partNumber - 1) * partSize
    const end = Math.min(start + partSize, params.buffer.byteLength)
    const chunk = params.buffer.subarray(start, end)

    const signedUrl = await resolveSignedPartUploadUrl({
      accessToken: params.accessToken,
      uploadId: session.uploadId,
      partNumber,
    })

    const etag = await fanvueApiUploadPart(signedUrl, chunk)
    completedParts.push({
      PartNumber: partNumber,
      ETag: etag,
    })
  }

  const completion = await fanvueApiRequest<{ status?: string }>({
    accessToken: params.accessToken,
    method: "PATCH",
    path: FANVUE_SELF_MEDIA_UPLOAD_PATHS.completeSessionPath(session.uploadId),
    body: { parts: completedParts },
  })

  const completionStatus = (completion.status ?? "").toLowerCase()
  if (completionStatus === "error" || completionStatus === "failed") {
    throw new Error("Fanvue rejected the completed media upload.")
  }

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
      metadata: { source: "presence" },
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
  const { page, size } = resolveFanvuePageParams(params)
  const response = await fanvueApiRequest<MediaListResponse>({
    accessToken,
    path: `/vault/folders/${encodeURIComponent(folderName)}/media`,
    searchParams: {
      page,
      size,
      variants: FANVUE_MEDIA_VARIANTS,
    },
  })

  const raw = response.data ?? response.items ?? []
  const items = raw.map(normalizeMediaItem).filter((item): item is FanvueMediaListItem => item !== null)
  return {
    items,
    nextCursor: resolveNextPageCursor(response.pagination) ?? response.nextCursor ?? response.cursor ?? null,
  }
}

export async function createFanvueVaultFolder(accessToken: string, name: string): Promise<FanvueVaultFolder> {
  const response = await fanvueApiRequest<{ name?: string; mediaCount?: number }>({
    accessToken,
    method: "POST",
    path: "/vault/folders",
    body: { name: name.trim() },
  })
  return {
    name: response.name?.trim() || name.trim(),
    mediaCount: response.mediaCount ?? 0,
  }
}

export async function renameFanvueVaultFolder(
  accessToken: string,
  folderName: string,
  nextName: string
): Promise<FanvueVaultFolder> {
  const response = await fanvueApiRequest<{ name?: string; mediaCount?: number }>({
    accessToken,
    method: "PATCH",
    path: `/vault/folders/${encodeURIComponent(folderName)}`,
    body: { name: nextName.trim() },
  })
  return {
    name: response.name?.trim() || nextName.trim(),
    mediaCount: response.mediaCount ?? null,
  }
}

export async function deleteFanvueVaultFolder(accessToken: string, folderName: string): Promise<void> {
  await fanvueApiRequest({
    accessToken,
    method: "DELETE",
    path: `/vault/folders/${encodeURIComponent(folderName)}`,
  })
}

export async function addMediaToFanvueVaultFolder(
  accessToken: string,
  folderName: string,
  mediaUuids: string[]
): Promise<void> {
  await fanvueApiRequest({
    accessToken,
    method: "POST",
    path: `/vault/folders/${encodeURIComponent(folderName)}/media`,
    body: { mediaUuids },
  })
}

export async function removeMediaFromFanvueVaultFolder(
  accessToken: string,
  folderName: string,
  mediaUuid: string
): Promise<void> {
  await fanvueApiRequest({
    accessToken,
    method: "DELETE",
    path: `/vault/folders/${encodeURIComponent(folderName)}/media/${encodeURIComponent(mediaUuid)}`,
  })
}

export async function listPresenceUploadedMediaUuids(
  supabase: SupabaseClient,
  params: { userId: string; socialConnectionId: string }
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("fanvue_media_cache")
    .select("fanvue_media_uuid")
    .eq("user_id", params.userId)
    .eq("social_connection_id", params.socialConnectionId)

  if (error) {
    console.error("[fanvue/media] cache lookup failed:", error)
    return new Set()
  }

  return new Set((data ?? []).map((row) => row.fanvue_media_uuid).filter(Boolean))
}

export function annotateFanvueMediaSources(
  items: FanvueMediaListItem[],
  presenceUuids: Set<string>
): FanvueMediaListItem[] {
  return items.map((item) => ({
    ...item,
    mediaSource: presenceUuids.has(item.uuid) ? "presence" : "fanvue",
  }))
}
