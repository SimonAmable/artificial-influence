import type { SupabaseClient } from "@supabase/supabase-js"
import type { UIMessage } from "ai"
import { inferStoragePathFromUrl } from "@/lib/assets/library"
import type { ChatImageReference } from "@/lib/chat/tools/generate-image-with-nano-banana"

export type ChatThreadMediaKind = "user_upload" | "generation"

export type ChatThreadMediaRow = {
  id: string
  user_id: string
  chat_thread_id: string
  media_kind: ChatThreadMediaKind
  mime_type: string
  public_url: string
  storage_path: string | null
  label: string | null
  generation_id: string | null
  created_at: string
}

function inferMimeFromStoragePath(path: string, fallback: string) {
  const lower = path.toLowerCase()
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".gif")) return "image/gif"
  if (lower.endsWith(".mp4")) return "video/mp4"
  if (lower.endsWith(".webm")) return "video/webm"
  if (lower.endsWith(".mov")) return "video/quicktime"
  if (lower.endsWith(".mp3")) return "audio/mpeg"
  if (lower.endsWith(".wav")) return "audio/wav"
  return fallback
}

function getPublicUrlForPath(supabase: SupabaseClient, storagePath: string) {
  const { data } = supabase.storage.from("public-bucket").getPublicUrl(storagePath)
  return data.publicUrl
}

function isHttpSupabasePublicUrl(url: string) {
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false
  return inferStoragePathFromUrl(url) != null
}

/**
 * Register file parts from an incoming user message as thread media (idempotent on URL).
 */
export async function registerThreadMediaFromUserMessageParts(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
  parts: UIMessage["parts"],
) {
  for (const part of parts) {
    if (part.type !== "file") continue
    const url = part.url
    if (typeof url !== "string" || !isHttpSupabasePublicUrl(url)) continue

    const storagePath = inferStoragePathFromUrl(url)
    if (!storagePath) continue

    const mimeType =
      typeof part.mediaType === "string" && part.mediaType.length > 0
        ? part.mediaType
        : inferMimeFromStoragePath(storagePath, "application/octet-stream")

    const filename = typeof part.filename === "string" ? part.filename : undefined
    const label =
      filename && filename.length > 0 ? `Uploaded: ${filename}` : "User upload"

    const { error } = await supabase.from("chat_thread_media").insert({
      user_id: userId,
      chat_thread_id: threadId,
      media_kind: "user_upload",
      mime_type: mimeType,
      public_url: url,
      storage_path: storagePath,
      label,
      generation_id: null,
    })

    if (error && error.code !== "23505") {
      console.error("[chat_thread_media] Failed to register upload:", error.message)
    }
  }
}

export async function listThreadMediaPage(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
  options?: { limit?: number; mediaKind?: ChatThreadMediaKind | "all" },
) {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100)
  const kind = options?.mediaKind ?? "all"

  let query = supabase
    .from("chat_thread_media")
    .select(
      "id, user_id, chat_thread_id, media_kind, mime_type, public_url, storage_path, label, generation_id, created_at",
    )
    .eq("user_id", userId)
    .eq("chat_thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (kind !== "all") {
    query = query.eq("media_kind", kind)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to list thread media: ${error.message}`)
  }

  return (data ?? []) as ChatThreadMediaRow[]
}

export type ComposeThreadMediaRow = {
  id: string
  mime_type: string
  public_url: string
  label: string | null
}

/**
 * Load thread media rows for timeline composition. Preserves the order of `mediaIds`.
 */
export async function resolveThreadMediaRowsForTimelineCompose(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
  mediaIds: string[],
): Promise<ComposeThreadMediaRow[]> {
  if (mediaIds.length === 0) {
    throw new Error("At least one media segment is required.")
  }

  const unique = new Set(mediaIds)
  if (unique.size !== mediaIds.length) {
    throw new Error("Duplicate media IDs in segments are not allowed.")
  }

  const { data, error } = await supabase
    .from("chat_thread_media")
    .select("id, mime_type, public_url, label")
    .eq("user_id", userId)
    .eq("chat_thread_id", threadId)
    .in("id", mediaIds)

  if (error) {
    throw new Error(`Failed to load thread media: ${error.message}`)
  }

  const rows = (data ?? []) as ComposeThreadMediaRow[]
  if (rows.length !== mediaIds.length) {
    throw new Error("One or more media IDs were not found on this thread or are inaccessible.")
  }

  const byId = new Map(rows.map((row) => [row.id, row]))
  return mediaIds.map((id) => {
    const row = byId.get(id)
    if (!row) {
      throw new Error(`Missing thread media row for id ${id}.`)
    }
    return row
  })
}

export async function resolveThreadMediaIdsToImageReferences(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
  mediaIds: string[],
): Promise<ChatImageReference[]> {
  if (mediaIds.length === 0) return []

  const { data, error } = await supabase
    .from("chat_thread_media")
    .select("id, mime_type, public_url, label")
    .eq("user_id", userId)
    .eq("chat_thread_id", threadId)
    .in("id", mediaIds)

  if (error) {
    throw new Error(`Failed to load thread media: ${error.message}`)
  }

  const rows = (data ?? []) as Array<{
    id: string
    mime_type: string
    public_url: string
    label: string | null
  }>

  if (rows.length !== mediaIds.length) {
    throw new Error("One or more media IDs were not found on this thread or are inaccessible.")
  }

  const imageRefs: ChatImageReference[] = []
  for (const row of rows) {
    if (!row.mime_type.startsWith("image/")) {
      throw new Error(
        `Media ${row.id} is not an image (${row.mime_type}). Use listThreadMedia to pick image items.`,
      )
    }
    imageRefs.push({
      url: row.public_url,
      mediaType: row.mime_type,
      filename: row.label ?? undefined,
    })
  }

  return imageRefs
}

export async function resolveThreadMediaIdToFrameExtractReference(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
  mediaId: string,
): Promise<{ url: string; mediaType: string; filename?: string }> {
  const { data, error } = await supabase
    .from("chat_thread_media")
    .select("id, mime_type, public_url, label")
    .eq("user_id", userId)
    .eq("chat_thread_id", threadId)
    .eq("id", mediaId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load thread media: ${error.message}`)
  }

  const row = data as
    | {
        id: string
        mime_type: string
        public_url: string
        label: string | null
      }
    | null

  if (!row) {
    throw new Error("That media id was not found on this thread or is inaccessible.")
  }

  const normalizedMime = row.mime_type.toLowerCase()
  if (!normalizedMime.startsWith("video/") && normalizedMime !== "image/gif") {
    throw new Error(
      `Media ${row.id} is not a video or GIF (${row.mime_type}). Use listThreadMedia to pick a video/GIF row, or attach one in this message.`,
    )
  }

  return {
    url: row.public_url,
    mediaType: row.mime_type,
    filename: row.label ?? undefined,
  }
}

/**
 * Sync `chat_thread_media` rows for all completed generation outputs tied to a Replicate prediction.
 */
export async function syncChatThreadMediaForPrediction(
  supabase: SupabaseClient,
  predictionId: string,
) {
  const { data: rows, error } = await supabase
    .from("generations")
    .select("id, user_id, chat_thread_id, type, tool, model, supabase_storage_path, status")
    .eq("replicate_prediction_id", predictionId)
    .eq("status", "completed")

  if (error) {
    console.error("[chat_thread_media] Failed to load generations for sync:", error.message)
    return
  }

  const list = (rows ?? []) as Array<{
    id: string
    user_id: string
    chat_thread_id: string | null
    type: "image" | "video"
    tool: string | null
    model: string | null
    supabase_storage_path: string | null
  }>

  for (const row of list) {
    if (!row.chat_thread_id || !row.supabase_storage_path) continue

    const publicUrl = getPublicUrlForPath(supabase, row.supabase_storage_path)
    const mimeType = inferMimeFromStoragePath(
      row.supabase_storage_path,
      row.type === "video" ? "video/mp4" : "image/png",
    )
    const label =
      row.type === "video"
        ? `Generated video (${row.model ?? "video"})`
        : `Generated image (${row.model ?? "image"})`

    const { error: insertError } = await supabase.from("chat_thread_media").insert({
      user_id: row.user_id,
      chat_thread_id: row.chat_thread_id,
      media_kind: "generation",
      mime_type: mimeType,
      public_url: publicUrl,
      storage_path: row.supabase_storage_path,
      label,
      generation_id: row.id,
    })

    if (insertError && insertError.code !== "23505") {
      console.error("[chat_thread_media] Insert failed:", insertError.message)
    }
  }
}

/**
 * Ensures every completed chat-bound generation on this thread has a `chat_thread_media` row.
 * Covers synchronous/polling completions and webhook/bind races.
 */
export async function syncMissingChatThreadMediaForThread(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
) {
  const { data: rows, error } = await supabase
    .from("generations")
    .select("id, user_id, chat_thread_id, type, model, supabase_storage_path, status")
    .eq("user_id", userId)
    .eq("chat_thread_id", threadId)
    .eq("status", "completed")

  if (error) {
    console.error("[chat_thread_media] Failed to load generations for backfill:", error.message)
    return
  }

  const list = (rows ?? []).filter((row) => {
    const path = (row as { supabase_storage_path?: string | null }).supabase_storage_path
    return typeof path === "string" && path.length > 0
  }) as Array<{
    id: string
    user_id: string
    type: "image" | "video"
    model: string | null
    supabase_storage_path: string
  }>

  for (const row of list) {
    const { data: existing } = await supabase
      .from("chat_thread_media")
      .select("id")
      .eq("generation_id", row.id)
      .maybeSingle()

    if (existing) continue

    const publicUrl = getPublicUrlForPath(supabase, row.supabase_storage_path)
    const mimeType = inferMimeFromStoragePath(
      row.supabase_storage_path,
      row.type === "video" ? "video/mp4" : "image/png",
    )
    const label =
      row.type === "video"
        ? `Generated video (${row.model ?? "video"})`
        : `Generated image (${row.model ?? "image"})`

    const { error: insertError } = await supabase.from("chat_thread_media").insert({
      user_id: row.user_id,
      chat_thread_id: threadId,
      media_kind: "generation",
      mime_type: mimeType,
      public_url: publicUrl,
      storage_path: row.supabase_storage_path,
      label,
      generation_id: row.id,
    })

    if (insertError && insertError.code !== "23505") {
      console.error("[chat_thread_media] Backfill insert failed:", insertError.message)
    }
  }
}
