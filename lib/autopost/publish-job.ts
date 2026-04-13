import type { SupabaseClient } from "@supabase/supabase-js"

import { decryptAutopostToken } from "@/lib/autopost/crypto"
import type { AutopostJobMetadata } from "@/lib/autopost/types"
import { InstagramGraphError } from "@/lib/instagram/graph"
import { publishInstagramContent, type PublishJobSpec } from "@/lib/instagram/publish"

export type PublishAutopostJobResult =
  | { ok: true; instagramMediaId: string; containerId: string }
  | { ok: false; error: string; statusCode: number }

type AutopostJobRow = {
  id: string
  user_id: string
  instagram_connection_id: string | null
  media_url: string
  caption: string | null
  media_type: string
  status: string
  attempts: number | null
  scheduled_at: string | null
  metadata: unknown
}

function parseMetadata(raw: unknown): AutopostJobMetadata {
  if (!raw || typeof raw !== "object") {
    return {}
  }
  return raw as AutopostJobMetadata
}

function buildPublishSpec(row: AutopostJobRow): PublishJobSpec {
  const meta = parseMetadata(row.metadata)

  switch (row.media_type) {
    case "image":
      return { kind: "feed_image", mediaUrl: row.media_url, caption: row.caption }
    case "feed_video":
      return { kind: "feed_video", mediaUrl: row.media_url, caption: row.caption }
    case "reel":
      return {
        kind: "reel",
        mediaUrl: row.media_url,
        caption: row.caption,
        shareToFeed: meta.publishOptions?.shareToFeed !== false,
        coverUrl: meta.publishOptions?.coverUrl,
        trialParams: meta.publishOptions?.trialParams,
      }
    case "story": {
      const assetKind = meta.assetKind === "video" ? "video" : "image"
      return { kind: "story", mediaUrl: row.media_url, assetKind }
    }
    case "carousel": {
      const items = meta.carouselItems ?? []
      if (items.length < 2) {
        throw new InstagramGraphError(
          "Carousel post is missing at least two media items.",
          undefined,
          "INVALID_JOB"
        )
      }
      return { kind: "carousel", caption: row.caption, items }
    }
    default:
      throw new InstagramGraphError(
        `Unsupported media_type "${row.media_type}".`,
        undefined,
        "INVALID_JOB"
      )
  }
}

/**
 * Loads the job, validates status, publishes to Instagram, and updates the row.
 * Works with the user-scoped server client (RLS) or the service role client.
 */
export async function publishAutopostJob(
  supabase: SupabaseClient,
  jobId: string,
  options: {
    /** When set, rejects if the job does not belong to this user. */
    userId?: string
    /** Allow publishing a queued job before scheduled_at (e.g. "Publish now"). */
    forceQueuedBeforeDue?: boolean
  } = {}
): Promise<PublishAutopostJobResult> {
  const { userId, forceQueuedBeforeDue } = options

  let query = supabase
    .from("autopost_jobs")
    .select(
      "id, user_id, instagram_connection_id, media_url, caption, media_type, status, attempts, scheduled_at, metadata"
    )
    .eq("id", jobId)

  if (userId) {
    query = query.eq("user_id", userId)
  }

  const { data: job, error: jobError } = await query.maybeSingle()

  if (jobError || !job) {
    return { ok: false, error: "Draft not found.", statusCode: 404 }
  }

  const row = job as AutopostJobRow

  if (row.status !== "draft" && row.status !== "failed" && row.status !== "queued") {
    return {
      ok: false,
      error: `Cannot publish a job in status "${row.status}".`,
      statusCode: 400,
    }
  }

  if (row.status === "queued" && row.scheduled_at) {
    const due = new Date(row.scheduled_at).getTime()
    if (Number.isFinite(due) && due > Date.now() && !forceQueuedBeforeDue) {
      return {
        ok: false,
        error: "This post is not due yet.",
        statusCode: 400,
      }
    }
  }

  let connectionQuery = supabase
    .from("instagram_connections")
    .select("id, instagram_user_id, access_token_encrypted, token_expires_at, status")
    .eq("user_id", row.user_id)
    .eq("status", "connected")

  if (row.instagram_connection_id) {
    connectionQuery = connectionQuery.eq("id", row.instagram_connection_id)
  } else {
    connectionQuery = connectionQuery.order("updated_at", { ascending: false }).limit(1)
  }

  const { data: connection, error: connectionError } = await connectionQuery.maybeSingle()

  if (connectionError || !connection?.instagram_user_id || !connection.access_token_encrypted) {
    return { ok: false, error: "Connect Instagram before publishing.", statusCode: 400 }
  }

  if (connection.token_expires_at) {
    const expires = new Date(connection.token_expires_at).getTime()
    if (Number.isFinite(expires) && expires < Date.now()) {
      return {
        ok: false,
        error: "Instagram access token expired. Reconnect your account.",
        statusCode: 400,
      }
    }
  }

  let accessToken: string
  try {
    accessToken = decryptAutopostToken(connection.access_token_encrypted)
  } catch (decryptError) {
    console.error("[autopost/publish-job] decrypt failed:", decryptError)
    return { ok: false, error: "Could not read Instagram credentials.", statusCode: 500 }
  }

  const attempts = row.attempts ?? 0

  const { data: processingRow, error: processingUpdateError } = await supabase
    .from("autopost_jobs")
    .update({
      status: "processing",
      attempts: attempts + 1,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("user_id", row.user_id)
    .in("status", ["draft", "failed", "queued"])
    .select("id")
    .maybeSingle()

  if (processingUpdateError) {
    console.error("[autopost/publish-job] processing update failed:", processingUpdateError)
    return { ok: false, error: "Failed to update job.", statusCode: 500 }
  }

  if (!processingRow) {
    return {
      ok: false,
      error: "Could not claim job for publishing (it may have already started).",
      statusCode: 409,
    }
  }

  try {
    const spec = buildPublishSpec(row)
    const { containerId, mediaId } = await publishInstagramContent({
      accessToken,
      instagramUserId: connection.instagram_user_id,
      job: spec,
    })

    const publishedAt = new Date().toISOString()

    const { error: successUpdateError } = await supabase
      .from("autopost_jobs")
      .update({
        status: "published",
        published_at: publishedAt,
        provider_container_id: containerId,
        provider_publish_id: mediaId,
        last_error: null,
        updated_at: publishedAt,
      })
      .eq("id", jobId)
      .eq("user_id", row.user_id)

    if (successUpdateError) {
      console.error("[autopost/publish-job] success update failed:", successUpdateError)
    }

    return { ok: true, instagramMediaId: mediaId, containerId }
  } catch (publishError) {
    const message =
      publishError instanceof InstagramGraphError
        ? publishError.message
        : publishError instanceof Error
          ? publishError.message
          : "Publishing failed."

    const { error: failUpdateError } = await supabase
      .from("autopost_jobs")
      .update({
        status: "failed",
        last_error: message.slice(0, 2000),
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("user_id", row.user_id)

    if (failUpdateError) {
      console.error("[autopost/publish-job] fail update failed:", failUpdateError)
    }

    const statusCode = publishError instanceof InstagramGraphError ? 502 : 500
    return { ok: false, error: message, statusCode }
  }
}
