import type { SupabaseClient } from "@supabase/supabase-js"

import { decryptAutopostToken } from "@/lib/autopost/crypto"
import type { AutopostJobMetadata } from "@/lib/autopost/types"
import { InstagramGraphError } from "@/lib/instagram/graph"
import { publishInstagramContent, type PublishJobSpec } from "@/lib/instagram/publish"
import {
  fetchTikTokPublishStatus,
  initTikTokDirectVideoPost,
  initTikTokInboxVideoUpload,
  queryTikTokCreatorInfo,
  TikTokApiError,
} from "@/lib/tiktok/publish"
import { normalizeTikTokVideoUrlToStorage } from "@/lib/tiktok/normalize-video"
import { getValidTikTokAccessToken } from "@/lib/tiktok/token-service"

export type PublishAutopostJobResult =
  | {
      ok: true
      provider: "instagram" | "tiktok"
      instagramMediaId?: string
      containerId?: string
      publishId?: string
      status?: string
    }
  | { ok: false; error: string; statusCode: number }

type AutopostJobRow = {
  id: string
  user_id: string
  provider?: string | null
  instagram_connection_id: string | null
  social_connection_id?: string | null
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

function mergeTikTokMetadata(row: AutopostJobRow, update: NonNullable<AutopostJobMetadata["tiktok"]>): AutopostJobMetadata {
  const metadata = parseMetadata(row.metadata)
  return {
    ...metadata,
    tiktok: {
      ...(metadata.tiktok ?? {}),
      ...update,
    },
  }
}

function tiktokStatusToJobStatus(status: string | undefined): string {
  switch (status) {
    case "SEND_TO_USER_INBOX":
      return "inbox_delivered"
    case "PUBLISH_COMPLETE":
    case "PUBLICLY_AVAILABLE":
      return "published"
    case "FAILED":
      return "failed"
    default:
      return "processing"
  }
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

async function claimJobForProcessing(
  supabase: SupabaseClient,
  row: AutopostJobRow,
  jobId: string
): Promise<PublishAutopostJobResult | null> {
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

  return null
}

async function publishTikTokAutopostJob(
  supabase: SupabaseClient,
  row: AutopostJobRow,
  jobId: string
): Promise<PublishAutopostJobResult> {
  const connectionId = row.social_connection_id
  if (!connectionId) {
    return { ok: false, error: "Pick a connected TikTok account before publishing.", statusCode: 400 }
  }

  const metadata = parseMetadata(row.metadata)
  const mode = row.media_type === "tiktok_video_direct" ? "direct" : "upload"
  const requiredScope = mode === "direct" ? "video.publish" : "video.upload"

  let token
  try {
    token = await getValidTikTokAccessToken(supabase, {
      connectionId,
      userId: row.user_id,
    })
  } catch (tokenError) {
    return {
      ok: false,
      error: tokenError instanceof Error ? tokenError.message : "Could not read TikTok credentials.",
      statusCode: 400,
    }
  }

  if (!token.scopes.includes(requiredScope)) {
    return {
      ok: false,
      error: `Reconnect TikTok and approve ${mode === "direct" ? "Direct Post" : "upload"} permissions.`,
      statusCode: 400,
    }
  }

  if (mode === "direct") {
    const privacyLevel = metadata.tiktok?.privacyLevel
    if (!privacyLevel) {
      return { ok: false, error: "Direct Post requires a TikTok privacy level.", statusCode: 400 }
    }

    try {
      const creatorInfo = await queryTikTokCreatorInfo(token.accessToken)
      const allowed = creatorInfo.privacy_level_options ?? []
      if (allowed.length > 0 && !allowed.includes(privacyLevel)) {
        return {
          ok: false,
          error: "The selected TikTok privacy level is no longer available. Refresh creator settings.",
          statusCode: 400,
        }
      }
    } catch (creatorError) {
      const statusCode = creatorError instanceof TikTokApiError && creatorError.status ? creatorError.status : 502
      return {
        ok: false,
        error: creatorError instanceof Error ? creatorError.message : "Could not verify TikTok creator settings.",
        statusCode,
      }
    }
  }

  const claimError = await claimJobForProcessing(supabase, row, jobId)
  if (claimError) {
    return claimError
  }

  try {
    const normalizedVideo = await normalizeTikTokVideoUrlToStorage({
      mediaUrl: row.media_url,
      userId: row.user_id,
      supabase,
    })

    const result =
      mode === "direct"
        ? await initTikTokDirectVideoPost({
            accessToken: token.accessToken,
            videoUrl: normalizedVideo.publicUrl,
            postInfo: {
              title: row.caption ?? undefined,
              privacyLevel: metadata.tiktok?.privacyLevel ?? "SELF_ONLY",
              disableComment: metadata.tiktok?.disableComment,
              disableDuet: metadata.tiktok?.disableDuet,
              disableStitch: metadata.tiktok?.disableStitch,
              isAigc: metadata.tiktok?.isAigc,
              brandOrganicToggle: metadata.tiktok?.brandOrganicToggle,
              brandContentToggle: metadata.tiktok?.brandContentToggle,
            },
          })
        : await initTikTokInboxVideoUpload({
            accessToken: token.accessToken,
            videoUrl: normalizedVideo.publicUrl,
          })

    if (!result.publish_id) {
      throw new TikTokApiError("TikTok accepted the request but returned no publish id.")
    }

    const now = new Date().toISOString()
    const nextMetadata = mergeTikTokMetadata(row, {
      publishId: result.publish_id,
      uploadUrl: result.upload_url ?? null,
      normalizedVideoUrl: normalizedVideo.publicUrl,
      normalizedStoragePath: normalizedVideo.storagePath,
      normalizationProfile: normalizedVideo.profile,
      normalizedAt: now,
      status: "SUBMITTED",
      statusFetchedAt: now,
    })

    const { error: successUpdateError } = await supabase
      .from("autopost_jobs")
      .update({
        status: "processing",
        provider_publish_id: result.publish_id,
        provider_container_id: result.upload_url ?? null,
        last_error: null,
        metadata: nextMetadata,
        updated_at: now,
      })
      .eq("id", jobId)
      .eq("user_id", row.user_id)

    if (successUpdateError) {
      console.error("[autopost/publish-job] TikTok success update failed:", successUpdateError)
    }

    return {
      ok: true,
      provider: "tiktok",
      publishId: result.publish_id,
      containerId: result.upload_url,
      status: "processing",
    }
  } catch (publishError) {
    const message = publishError instanceof Error ? publishError.message : "TikTok publishing failed."

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
      console.error("[autopost/publish-job] TikTok fail update failed:", failUpdateError)
    }

    const statusCode = publishError instanceof TikTokApiError && publishError.status ? publishError.status : 502
    return { ok: false, error: message, statusCode }
  }
}

export async function refreshTikTokAutopostJobStatus(
  supabase: SupabaseClient,
  jobId: string,
  options: { userId?: string } = {}
): Promise<PublishAutopostJobResult> {
  let query = supabase
    .from("autopost_jobs")
    .select("id, user_id, provider, social_connection_id, provider_publish_id, metadata")
    .eq("id", jobId)
    .eq("provider", "tiktok")

  if (options.userId) {
    query = query.eq("user_id", options.userId)
  }

  const { data: job, error } = await query.maybeSingle()
  if (error || !job?.provider_publish_id || !job.social_connection_id) {
    return { ok: false, error: "TikTok post not found.", statusCode: 404 }
  }

  try {
    const token = await getValidTikTokAccessToken(supabase, {
      connectionId: job.social_connection_id,
      userId: job.user_id,
    })
    const status = await fetchTikTokPublishStatus({
      accessToken: token.accessToken,
      publishId: job.provider_publish_id,
    })
    const nextStatus = tiktokStatusToJobStatus(status.status)
    const metadata = job.metadata && typeof job.metadata === "object" ? (job.metadata as AutopostJobMetadata) : {}
    const nextMetadata: AutopostJobMetadata = {
      ...metadata,
      tiktok: {
        ...(metadata.tiktok ?? {}),
        status: status.status,
        failReason: status.fail_reason ?? null,
        statusFetchedAt: new Date().toISOString(),
      },
    }

    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      last_error: nextStatus === "failed" ? status.fail_reason ?? "TikTok processing failed." : null,
      metadata: nextMetadata,
      updated_at: new Date().toISOString(),
    }
    if (nextStatus === "published") {
      updatePayload.published_at = new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from("autopost_jobs")
      .update(updatePayload)
      .eq("id", jobId)
      .eq("user_id", job.user_id)

    if (updateError) {
      console.error("[autopost/publish-job] TikTok status update failed:", updateError)
      return { ok: false, error: "Failed to save TikTok status.", statusCode: 500 }
    }

    return {
      ok: true,
      provider: "tiktok",
      publishId: job.provider_publish_id,
      status: nextStatus,
    }
  } catch (statusError) {
    return {
      ok: false,
      error: statusError instanceof Error ? statusError.message : "Could not refresh TikTok status.",
      statusCode: statusError instanceof TikTokApiError && statusError.status ? statusError.status : 502,
    }
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
      "id, user_id, provider, instagram_connection_id, social_connection_id, media_url, caption, media_type, status, attempts, scheduled_at, metadata"
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

  if ((row.provider ?? "instagram") === "tiktok") {
    return publishTikTokAutopostJob(supabase, row, jobId)
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

    return { ok: true, provider: "instagram", instagramMediaId: mediaId, containerId }
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
