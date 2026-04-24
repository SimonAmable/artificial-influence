import type { SupabaseClient } from "@supabase/supabase-js"
import type { ChatImageReference } from "@/lib/chat/tools/image-reference-types"
import { formatGenerationMediaId, formatUploadMediaId, parseMediaId } from "@/lib/chat/media-id"

export type ResolvedMediaRef = {
  bucket: string
  id: string
  kind: "upload" | "generation"
  label: string | null
  mimeType: string
  publicUrl: string
  storagePath: string
  /** Set when the row was found only after relaxing thread scope (user-owned, another thread). */
  crossThread?: boolean
}

export type ResolveMediaRefOptions = {
  /** When true and `threadId` is set, retry without `chat_thread_id` filter if not found in-thread. */
  allowCrossThread?: boolean
}

function getPublicUrl(supabase: SupabaseClient, bucket: string, storagePath: string) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath)
  return data.publicUrl
}

function inferGenerationMimeType(type: "image" | "video" | "audio", storagePath: string) {
  const lower = storagePath.toLowerCase()

  if (type === "video") {
    if (lower.endsWith(".webm")) return "video/webm"
    if (lower.endsWith(".mov")) return "video/quicktime"
    return "video/mp4"
  }

  if (type === "audio") {
    if (lower.endsWith(".wav")) return "audio/wav"
    if (lower.endsWith(".ogg")) return "audio/ogg"
    if (lower.endsWith(".m4a")) return "audio/mp4"
    return "audio/mpeg"
  }

  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".gif")) return "image/gif"
  if (lower.endsWith(".avif")) return "image/avif"
  return "image/png"
}

async function fetchUploadById(
  supabase: SupabaseClient,
  userId: string,
  threadId: string | undefined,
  uuid: string,
  scopedToThread: boolean,
): Promise<ResolvedMediaRef | null> {
  let q = supabase
    .from("uploads")
    .select("id, user_id, chat_thread_id, bucket, storage_path, mime_type, label")
    .eq("id", uuid)
    .eq("user_id", userId)

  if (scopedToThread && threadId) {
    q = q.eq("chat_thread_id", threadId)
  }

  const { data, error } = await q.maybeSingle()
  if (error || !data) return null

  const row = data as {
    id: string
    bucket: string
    storage_path: string
    mime_type: string
    label: string | null
  }

  return {
    bucket: row.bucket,
    id: formatUploadMediaId(row.id),
    kind: "upload",
    label: row.label,
    mimeType: row.mime_type,
    publicUrl: getPublicUrl(supabase, row.bucket, row.storage_path),
    storagePath: row.storage_path,
  }
}

async function fetchGenerationById(
  supabase: SupabaseClient,
  userId: string,
  threadId: string | undefined,
  uuid: string,
  scopedToThread: boolean,
): Promise<ResolvedMediaRef | null> {
  let q = supabase
    .from("generations")
    .select("id, user_id, chat_thread_id, supabase_storage_path, status, type, model")
    .eq("id", uuid)
    .eq("user_id", userId)
    .eq("status", "completed")

  if (scopedToThread && threadId) {
    q = q.eq("chat_thread_id", threadId)
  }

  const { data, error } = await q.maybeSingle()
  if (error || !data) return null

  const row = data as {
    id: string
    supabase_storage_path: string | null
    model: string | null
    type: "image" | "video" | "audio"
  }

  if (!row.supabase_storage_path) return null

  const mimeType = inferGenerationMimeType(row.type, row.supabase_storage_path)
  const label =
    row.type === "video"
      ? `Generated video (${row.model ?? "video"})`
      : row.type === "audio"
        ? `Generated audio (${row.model ?? "audio"})`
        : `Generated image (${row.model ?? "image"})`

  return {
    bucket: "public-bucket",
    id: formatGenerationMediaId(row.id),
    kind: "generation",
    label,
    mimeType,
    publicUrl: getPublicUrl(supabase, "public-bucket", row.supabase_storage_path),
    storagePath: row.supabase_storage_path,
  }
}

async function resolveMediaRefScoped(
  supabase: SupabaseClient,
  userId: string,
  threadId: string | undefined,
  rawId: string,
  scopedToThread: boolean,
): Promise<ResolvedMediaRef | null> {
  const parsed = parseMediaId(rawId)

  if (parsed.namespace === "upload") {
    return fetchUploadById(supabase, userId, threadId, parsed.uuid, scopedToThread)
  }

  if (parsed.namespace === "generation") {
    return fetchGenerationById(supabase, userId, threadId, parsed.uuid, scopedToThread)
  }

  const upload = await fetchUploadById(supabase, userId, threadId, parsed.uuid, scopedToThread)
  if (upload) return upload
  return fetchGenerationById(supabase, userId, threadId, parsed.uuid, scopedToThread)
}

/**
 * Resolve a thread media id to a public URL + storage metadata.
 * Supports `upl_<uuid>`, `gen_<uuid>`, or legacy raw UUID (upload row first, then generation).
 */
export async function resolveMediaRef(
  supabase: SupabaseClient,
  userId: string,
  threadId: string | undefined,
  rawId: string,
  options?: ResolveMediaRefOptions,
): Promise<ResolvedMediaRef> {
  const allowCrossThread = options?.allowCrossThread ?? false

  let resolved = await resolveMediaRefScoped(supabase, userId, threadId, rawId, true)
  if (resolved) {
    return resolved
  }

  if (allowCrossThread && threadId) {
    resolved = await resolveMediaRefScoped(supabase, userId, threadId, rawId, false)
    if (resolved) {
      return { ...resolved, crossThread: true }
    }
  }

  const parsed = parseMediaId(rawId)
  if (parsed.namespace === "upload") {
    throw new Error(`Upload media id not found: ${rawId}`)
  }
  if (parsed.namespace === "generation") {
    throw new Error(`Generation media id not found or not completed: ${rawId}`)
  }

  throw new Error(`Media id not found on this thread or inaccessible: ${rawId}`)
}

export async function resolveMediaIdsToImageReferences(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
  mediaIds: string[],
): Promise<ChatImageReference[]> {
  if (mediaIds.length === 0) return []

  const refs: ChatImageReference[] = []
  for (const rawId of mediaIds) {
    const resolved = await resolveMediaRef(supabase, userId, threadId, rawId)
    if (!resolved.mimeType.startsWith("image/")) {
      throw new Error(
        `Media ${rawId} is not an image (${resolved.mimeType}). Use listThreadMedia to pick image items.`,
      )
    }
    refs.push({
      url: resolved.publicUrl,
      mediaType: resolved.mimeType,
      filename: resolved.label ?? undefined,
    })
  }

  return refs
}

export type TimelineComposeMediaRow = {
  id: string
  label: string | null
  mime_type: string
  public_url: string
}

/**
 * Load thread media rows for timeline composition. Preserves the order of `mediaIds`.
 */
export async function resolveMediaRowsForTimelineCompose(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
  mediaIds: string[],
): Promise<TimelineComposeMediaRow[]> {
  if (mediaIds.length === 0) {
    throw new Error("At least one media segment is required.")
  }

  const unique = new Set(mediaIds)
  if (unique.size !== mediaIds.length) {
    throw new Error("Duplicate media IDs in segments are not allowed.")
  }

  const rows: TimelineComposeMediaRow[] = []
  for (const rawId of mediaIds) {
    const resolved = await resolveMediaRef(supabase, userId, threadId, rawId)
    rows.push({
      id: resolved.id,
      label: resolved.label,
      mime_type: resolved.mimeType,
      public_url: resolved.publicUrl,
    })
  }

  return rows
}

export async function resolveMediaIdToFrameExtractReference(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
  mediaId: string,
): Promise<{ url: string; mediaType: string; filename?: string }> {
  const resolved = await resolveMediaRef(supabase, userId, threadId, mediaId)
  const normalizedMime = resolved.mimeType.toLowerCase()
  if (!normalizedMime.startsWith("video/") && normalizedMime !== "image/gif") {
    throw new Error(
      `Media ${mediaId} is not a video or GIF (${resolved.mimeType}). Use listThreadMedia to pick a video/GIF row, or attach one in this message.`,
    )
  }

  return {
    url: resolved.publicUrl,
    mediaType: resolved.mimeType,
    filename: resolved.label ?? undefined,
  }
}
