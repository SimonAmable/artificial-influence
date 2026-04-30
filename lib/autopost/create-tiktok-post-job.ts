import type { SupabaseClient } from "@supabase/supabase-js"

import type { AutopostJobMetadata } from "@/lib/autopost/types"
import { isUserPublicBucketMediaUrl } from "@/lib/autopost/validate-media-url"

export type PrepareTikTokPostAction = "draft" | "schedule"
export type TikTokPostMode = "upload" | "direct"
export type TikTokPostType = "video" | "photo"

export type PrepareTikTokPostInput = {
  action: PrepareTikTokPostAction
  tiktokConnectionId: string
  mode: TikTokPostMode
  postType?: TikTokPostType
  caption?: string
  description?: string
  scheduledAt?: string
  mediaUrl?: string
  photoItems?: string[]
  photoCoverIndex?: number
  privacyLevel?: string
  disableComment?: boolean
  disableDuet?: boolean
  disableStitch?: boolean
  isAigc?: boolean
  autoAddMusic?: boolean
  brandOrganicToggle?: boolean
  brandContentToggle?: boolean
}

type CreateTikTokPostJobResult =
  | {
      ok: true
      job: {
        id: string
        media_url: string
        caption: string | null
        media_type:
          | "tiktok_video_upload"
          | "tiktok_video_direct"
          | "tiktok_photo_upload"
          | "tiktok_photo_direct"
        status: string
        scheduled_at: string | null
        created_at: string
        social_connection_id: string
        metadata: AutopostJobMetadata
      }
    }
  | {
      ok: false
      message: string
      statusCode: number
    }

function isVideoUrl(url: string) {
  try {
    return /\.(mp4|mov|webm)$/i.test(new URL(url).pathname)
  } catch {
    return false
  }
}

function isImageUrl(url: string) {
  try {
    return /\.(jpe?g|png|webp|gif)$/i.test(new URL(url).pathname)
  } catch {
    return false
  }
}

export async function createTikTokPostJob({
  input,
  supabase,
  supabaseUrl,
  userId,
}: {
  input: PrepareTikTokPostInput
  supabase: SupabaseClient
  supabaseUrl: string
  userId: string
}): Promise<CreateTikTokPostJobResult> {
  const connectionId = input.tiktokConnectionId?.trim()
  const mode = input.mode === "direct" ? "direct" : "upload"
  const postType = input.postType === "photo" ? "photo" : "video"
  const caption = input.caption?.trim() || null
  const description = input.description?.trim() || null
  const mediaUrl = input.mediaUrl?.trim() || ""

  if (!connectionId) {
    return { ok: false, message: "Pick a connected TikTok account.", statusCode: 400 }
  }

  let scheduledAt: string | null = null
  if (input.action === "schedule") {
    const raw = input.scheduledAt?.trim() || ""
    const date = new Date(raw)
    if (!raw || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
      return { ok: false, message: "Scheduling requires a future ISO 8601 date-time.", statusCode: 400 }
    }
    scheduledAt = date.toISOString()
  }

  if (mode === "direct" && !input.privacyLevel?.trim()) {
    return { ok: false, message: "Direct Post requires a TikTok privacy level.", statusCode: 400 }
  }

  let normalizedMediaUrl = mediaUrl
  let photoItems: string[] = []
  let photoCoverIndex = 0

  if (postType === "video") {
    if (!normalizedMediaUrl) {
      return { ok: false, message: "TikTok video posts require a video URL.", statusCode: 400 }
    }
    if (!isUserPublicBucketMediaUrl(normalizedMediaUrl, userId, supabaseUrl)) {
      return {
        ok: false,
        message: "Media URLs must be public files uploaded to your account storage.",
        statusCode: 400,
      }
    }
    if (!isVideoUrl(normalizedMediaUrl)) {
      return {
        ok: false,
        message: "TikTok video publishing requires an MP4, MOV, or WebM public URL.",
        statusCode: 400,
      }
    }
  } else {
    photoItems = Array.isArray(input.photoItems)
      ? input.photoItems.map((item) => item.trim()).filter((item) => item.length > 0)
      : []

    if (photoItems.length === 0 || photoItems.length > 35) {
      return {
        ok: false,
        message: "TikTok photo posts require between 1 and 35 public image URLs.",
        statusCode: 400,
      }
    }

    for (const itemUrl of photoItems) {
      if (!isUserPublicBucketMediaUrl(itemUrl, userId, supabaseUrl)) {
        return {
          ok: false,
          message: "Media URLs must be public files uploaded to your account storage.",
          statusCode: 400,
        }
      }
      if (!isImageUrl(itemUrl)) {
        return {
          ok: false,
          message: "TikTok photo posts currently require JPEG, PNG, WebP, or GIF public URLs.",
          statusCode: 400,
        }
      }
    }

    const requestedCoverIndex = Number(input.photoCoverIndex)
    photoCoverIndex =
      Number.isInteger(requestedCoverIndex) && requestedCoverIndex >= 0 && requestedCoverIndex < photoItems.length
        ? requestedCoverIndex
        : 0
    normalizedMediaUrl = photoItems[photoCoverIndex]
  }

  const { data: connection, error: connectionError } = await supabase
    .from("social_connections")
    .select("id, scopes, status")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .eq("provider", "tiktok")
    .maybeSingle()

  if (connectionError) {
    console.error("[autopost/create-tiktok-post-job] connection lookup failed:", connectionError)
    return { ok: false, message: "Failed to verify the TikTok connection.", statusCode: 500 }
  }

  if (!connection?.id || connection.status !== "connected") {
    return { ok: false, message: "Invalid or disconnected TikTok account.", statusCode: 400 }
  }

  const scopes = Array.isArray(connection.scopes) ? connection.scopes : []
  const requiredScope = mode === "direct" ? "video.publish" : "video.upload"
  if (!scopes.includes(requiredScope)) {
    return {
      ok: false,
      message: `Reconnect TikTok and approve ${mode === "direct" ? "Direct Post" : "upload"} permissions.`,
      statusCode: 400,
    }
  }

  const metadata: AutopostJobMetadata = {
    tiktok: {
      mode,
      postType,
      privacyLevel: input.privacyLevel?.trim(),
      disableComment: input.disableComment === true,
      disableDuet: input.disableDuet === true,
      disableStitch: input.disableStitch === true,
      isAigc: input.isAigc !== false,
      autoAddMusic: input.autoAddMusic === true,
      brandOrganicToggle: input.brandOrganicToggle === true,
      brandContentToggle: input.brandContentToggle === true,
      description,
      photoItems: postType === "photo" ? photoItems.map((url) => ({ url })) : undefined,
      photoCoverIndex: postType === "photo" ? photoCoverIndex : undefined,
    },
  }

  const status = input.action === "schedule" ? "queued" : "draft"
  const mediaType =
    postType === "photo"
      ? mode === "direct"
        ? "tiktok_photo_direct"
        : "tiktok_photo_upload"
      : mode === "direct"
        ? "tiktok_video_direct"
        : "tiktok_video_upload"

  const { data: job, error: insertError } = await supabase
    .from("autopost_jobs")
    .insert({
      user_id: userId,
      provider: "tiktok",
      social_connection_id: connection.id,
      media_type: mediaType,
      media_url: normalizedMediaUrl,
      caption,
      status,
      scheduled_at: scheduledAt,
      metadata,
    })
    .select("id, media_url, caption, media_type, status, scheduled_at, created_at, social_connection_id, metadata")
    .single()

  if (insertError || !job?.social_connection_id) {
    console.error("[autopost/create-tiktok-post-job] insert failed:", insertError)
    return { ok: false, message: "Failed to save the TikTok post.", statusCode: 500 }
  }

  return {
    ok: true,
    job: {
      caption: job.caption,
      created_at: job.created_at,
      id: job.id,
      media_type: job.media_type,
      media_url: job.media_url,
      metadata: (job.metadata ?? {}) as AutopostJobMetadata,
      scheduled_at: job.scheduled_at,
      social_connection_id: job.social_connection_id,
      status: job.status,
    },
  }
}
