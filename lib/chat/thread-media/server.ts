import type { SupabaseClient } from "@supabase/supabase-js"
import type { UIMessage } from "ai"
import { inferStoragePathFromUrl } from "@/lib/assets/library"
import { DEFAULT_UPLOAD_BUCKET } from "@/lib/uploads/shared"
import { extractStorageObjectRef } from "@/lib/uploads/storage-ref"
import { formatGenerationMediaId, formatUploadMediaId } from "@/lib/chat/media-id"
import {
  resolveMediaIdToFrameExtractReference as resolveMediaIdToFrameExtractReferenceImpl,
  resolveMediaIdsToImageReferences as resolveMediaIdsToImageReferencesImpl,
  resolveMediaRowsForTimelineCompose as resolveMediaRowsForTimelineComposeImpl,
} from "@/lib/chat/resolve-media-ref"
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

function inferGenerationMimeType(type: "image" | "video" | "audio", storagePath: string) {
  if (type === "video") {
    return inferMimeFromStoragePath(storagePath, "video/mp4")
  }

  if (type === "audio") {
    return inferMimeFromStoragePath(storagePath, "audio/mpeg")
  }

  return inferMimeFromStoragePath(storagePath, "image/png")
}

function buildGenerationLabel(type: "image" | "video" | "audio", model: string | null) {
  if (type === "video") return `Generated video (${model ?? "video"})`
  if (type === "audio") return `Generated audio (${model ?? "audio"})`
  return `Generated image (${model ?? "image"})`
}

function getPublicUrlForPath(supabase: SupabaseClient, bucket: string, storagePath: string) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath)
  return data.publicUrl
}

function isHttpSupabasePublicUrl(url: string) {
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false
  return inferStoragePathFromUrl(url) != null
}

/**
 * Register file parts from an incoming user message as uploads (idempotent on storage path).
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

    const storageRef = extractStorageObjectRef(url)
    const storagePath = storageRef?.storagePath ?? inferStoragePathFromUrl(url)
    if (!storagePath) continue
    const bucket = storageRef?.bucket ?? DEFAULT_UPLOAD_BUCKET

    const mimeType =
      typeof part.mediaType === "string" && part.mediaType.length > 0
        ? part.mediaType
        : inferMimeFromStoragePath(storagePath, "application/octet-stream")

    const filename = typeof part.filename === "string" ? part.filename : undefined
    const label =
      filename && filename.length > 0 ? `Uploaded: ${filename}` : "User upload"

    const { error } = await supabase.from("uploads").insert({
      user_id: userId,
      chat_thread_id: threadId,
      source: "chat",
      bucket,
      mime_type: mimeType,
      storage_path: storagePath,
      label,
    })

    if (!error) continue

    // finalizeUploadedObject often inserts the row first without chat_thread_id; linking it here hits 23505.
    if (error.code === "23505") {
      const { error: patchError } = await supabase
        .from("uploads")
        .update({ chat_thread_id: threadId, source: "chat", label })
        .eq("user_id", userId)
        .eq("storage_path", storagePath)

      if (patchError) {
        console.error("[uploads] Failed to attach upload to thread:", patchError.message)
      }
      continue
    }

    console.error("[uploads] Failed to register upload:", error.message)
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
  const fetchCap = Math.min(limit * 3, 200)

  const uploadRows: ChatThreadMediaRow[] = []
  const generationRows: ChatThreadMediaRow[] = []

  if (kind === "all" || kind === "user_upload") {
    const { data, error } = await supabase
      .from("uploads")
      .select("id, user_id, chat_thread_id, bucket, storage_path, mime_type, label, created_at")
      .eq("user_id", userId)
      .eq("chat_thread_id", threadId)
      .order("created_at", { ascending: false })
      .limit(fetchCap)

    if (error) {
      throw new Error(`Failed to list uploads: ${error.message}`)
    }

    for (const row of data ?? []) {
      const r = row as {
        id: string
        user_id: string
        chat_thread_id: string | null
        bucket: string
        storage_path: string
        mime_type: string
        label: string | null
        created_at: string
      }
      if (!r.chat_thread_id) continue
      uploadRows.push({
        id: formatUploadMediaId(r.id),
        user_id: r.user_id,
        chat_thread_id: r.chat_thread_id,
        media_kind: "user_upload",
        mime_type: r.mime_type,
        public_url: getPublicUrlForPath(supabase, r.bucket, r.storage_path),
        storage_path: r.storage_path,
        label: r.label,
        generation_id: null,
        created_at: r.created_at,
      })
    }
  }

  if (kind === "all" || kind === "generation") {
    const { data, error } = await supabase
      .from("generations")
      .select("id, user_id, chat_thread_id, supabase_storage_path, type, model, created_at")
      .eq("user_id", userId)
      .eq("chat_thread_id", threadId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(fetchCap)

    if (error) {
      throw new Error(`Failed to list generations: ${error.message}`)
    }

    for (const row of data ?? []) {
      const r = row as {
        id: string
        user_id: string
        chat_thread_id: string | null
        supabase_storage_path: string | null
        type: "image" | "video" | "audio"
        model: string | null
        created_at: string
      }
      if (!r.chat_thread_id || !r.supabase_storage_path) continue

      const mimeType = inferGenerationMimeType(r.type, r.supabase_storage_path)
      const label = buildGenerationLabel(r.type, r.model)

      generationRows.push({
        id: formatGenerationMediaId(r.id),
        user_id: r.user_id,
        chat_thread_id: r.chat_thread_id,
        media_kind: "generation",
        mime_type: mimeType,
        public_url: getPublicUrlForPath(supabase, "public-bucket", r.supabase_storage_path),
        storage_path: r.supabase_storage_path,
        label,
        generation_id: r.id,
        created_at: r.created_at,
      })
    }
  }

  const merged = [...uploadRows, ...generationRows].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )

  return merged.slice(0, limit)
}

export type ComposeThreadMediaRow = {
  id: string
  mime_type: string
  public_url: string
  label: string | null
}

export async function resolveThreadMediaRowsForTimelineCompose(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
  mediaIds: string[],
): Promise<ComposeThreadMediaRow[]> {
  return resolveMediaRowsForTimelineComposeImpl(supabase, userId, threadId, mediaIds)
}

export async function resolveThreadMediaIdsToImageReferences(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
  mediaIds: string[],
): Promise<ChatImageReference[]> {
  return resolveMediaIdsToImageReferencesImpl(supabase, userId, threadId, mediaIds)
}

export async function resolveThreadMediaIdToFrameExtractReference(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
  mediaId: string,
): Promise<{ url: string; mediaType: string; filename?: string }> {
  return resolveMediaIdToFrameExtractReferenceImpl(supabase, userId, threadId, mediaId)
}
