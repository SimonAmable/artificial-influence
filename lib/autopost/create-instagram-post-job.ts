import type { SupabaseClient } from "@supabase/supabase-js"
import type { AutopostCarouselItem, AutopostJobMetadata, AutopostMediaType } from "@/lib/autopost/types"
import { isUserPublicBucketMediaUrl } from "@/lib/autopost/validate-media-url"
import { parseSavedProfileFromMetadata } from "@/lib/instagram/profile"

export type PrepareInstagramPostAction = "draft" | "schedule"

export type PrepareInstagramPostInput = {
  action: PrepareInstagramPostAction
  mediaType: AutopostMediaType
  instagramConnectionId: string
  caption?: string
  scheduledAt?: string
  mediaUrl?: string
  carouselItems?: AutopostCarouselItem[]
  storyAssetKind?: "image" | "video"
  shareToFeed?: boolean
  coverUrl?: string
  trialParams?: {
    graduationStrategy: "MANUAL" | "SS_PERFORMANCE"
  }
}

export type InstagramConnectionSummary = {
  id: string
  instagramUserId: string | null
  instagramUsername: string | null
  accountType: string | null
  updatedAt: string
  tokenExpiresAt: string | null
  profileFetchedAt: string | null
}

type CreateInstagramPostJobSuccess = {
  ok: true
  connection: InstagramConnectionSummary
  job: {
    id: string
    media_url: string
    caption: string | null
    media_type: string
    status: string
    scheduled_at: string | null
    created_at: string
    instagram_connection_id: string
    metadata: AutopostJobMetadata
  }
}

type CreateInstagramPostJobFailureCode =
  | "invalid_body"
  | "invalid_schedule"
  | "invalid_urls"
  | "invalid_media_format"
  | "connection_lookup_failed"
  | "connection_not_found"
  | "insert_failed"
  | "missing_connection_link"

type CreateInstagramPostJobFailure = {
  ok: false
  code: CreateInstagramPostJobFailureCode
  message: string
  statusCode: number
}

export type CreateInstagramPostJobResult =
  | CreateInstagramPostJobSuccess
  | CreateInstagramPostJobFailure

type NormalizedPostPayload = {
  action: PrepareInstagramPostAction
  mediaType: AutopostMediaType
  mediaUrl: string
  caption: string | null
  instagramConnectionId: string
  scheduledAt: string | null
  metadata: AutopostJobMetadata
}

function isCarouselItem(item: unknown): item is AutopostCarouselItem {
  if (!item || typeof item !== "object") {
    return false
  }

  const candidate = item as Record<string, unknown>
  const url = typeof candidate.url === "string" ? candidate.url.trim() : ""
  const kind = candidate.kind === "image" || candidate.kind === "video" ? candidate.kind : null

  return Boolean(url && kind)
}

function isJpegBackedPublicUrl(url: string) {
  try {
    const parsed = new URL(url)
    return /\.(jpe?g)$/i.test(parsed.pathname)
  } catch {
    return false
  }
}

function parseInput({
  input,
  supabaseUrl,
  userId,
}: {
  input: PrepareInstagramPostInput
  supabaseUrl: string
  userId: string
}): CreateInstagramPostJobFailure | { ok: true; value: NormalizedPostPayload } {
  const instagramConnectionId = input.instagramConnectionId?.trim()
  const caption = input.caption?.trim() || null

  if (!instagramConnectionId) {
    return {
      ok: false,
      code: "invalid_body",
      message: "Pick a connected Instagram account before preparing the post.",
      statusCode: 400,
    }
  }

  const validateUrl = (url: string) => isUserPublicBucketMediaUrl(url, userId, supabaseUrl)
  const metadata: AutopostJobMetadata = {}
  let mediaUrl = ""

  if (input.action === "schedule") {
    const scheduledAtRaw = input.scheduledAt?.trim() || ""
    if (!scheduledAtRaw) {
      return {
        ok: false,
        code: "invalid_schedule",
        message: "Scheduling requires a future ISO 8601 date-time.",
        statusCode: 400,
      }
    }

    const scheduledAt = new Date(scheduledAtRaw)
    if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      return {
        ok: false,
        code: "invalid_schedule",
        message: "Scheduling requires a future ISO 8601 date-time.",
        statusCode: 400,
      }
    }
  }

  if (input.mediaType === "carousel") {
    if (!Array.isArray(input.carouselItems) || input.carouselItems.length < 2 || input.carouselItems.length > 10) {
      return {
        ok: false,
        code: "invalid_body",
        message: "Carousel posts must include between 2 and 10 media items.",
        statusCode: 400,
      }
    }

    const carouselItems: AutopostCarouselItem[] = []
    for (const item of input.carouselItems) {
      if (!isCarouselItem(item)) {
        return {
          ok: false,
          code: "invalid_body",
          message: "Each carousel item must include a public URL and kind of image or video.",
          statusCode: 400,
        }
      }

      const itemUrl = item.url.trim()
      if (!validateUrl(itemUrl)) {
        return {
          ok: false,
          code: "invalid_urls",
          message: "Media URLs must be public files uploaded to your account storage.",
          statusCode: 400,
        }
      }

      carouselItems.push({
        kind: item.kind,
        url: itemUrl,
      })
    }

    mediaUrl = carouselItems[0].url
    metadata.carouselItems = carouselItems
  } else {
    mediaUrl = input.mediaUrl?.trim() || ""
    if (!mediaUrl) {
      return {
        ok: false,
        code: "invalid_body",
        message: "This Instagram post needs a media URL.",
        statusCode: 400,
      }
    }

    if (!validateUrl(mediaUrl)) {
      return {
        ok: false,
        code: "invalid_urls",
        message: "Media URLs must be public files uploaded to your account storage.",
        statusCode: 400,
      }
    }
  }

  if (input.mediaType === "image" && !isJpegBackedPublicUrl(mediaUrl)) {
    return {
      ok: false,
      code: "invalid_media_format",
      message: "Instagram feed image posts currently require a JPEG-backed public URL.",
      statusCode: 400,
    }
  }

  if (input.mediaType === "story") {
    if (input.storyAssetKind !== "image" && input.storyAssetKind !== "video") {
      return {
        ok: false,
        code: "invalid_body",
        message: "Story posts must specify whether the asset is an image or video.",
        statusCode: 400,
      }
    }

    metadata.assetKind = input.storyAssetKind
  }

  if (input.mediaType === "reel") {
    const publishOptions: NonNullable<AutopostJobMetadata["publishOptions"]> = {}

    if (input.shareToFeed === false) {
      publishOptions.shareToFeed = false
    }

    const coverUrl = input.coverUrl?.trim() || ""
    if (coverUrl) {
      if (!validateUrl(coverUrl)) {
        return {
          ok: false,
          code: "invalid_urls",
          message: "Cover URLs must be public files uploaded to your account storage.",
          statusCode: 400,
        }
      }
      publishOptions.coverUrl = coverUrl
    }

    if (input.trialParams) {
      publishOptions.trialParams = {
        graduationStrategy:
          input.trialParams.graduationStrategy === "SS_PERFORMANCE" ? "SS_PERFORMANCE" : "MANUAL",
      }
    }

    if (Object.keys(publishOptions).length > 0) {
      metadata.publishOptions = publishOptions
    }
  }

  return {
    ok: true,
    value: {
      action: input.action,
      caption,
      instagramConnectionId,
      mediaType: input.mediaType,
      mediaUrl,
      metadata,
      scheduledAt: input.action === "schedule" ? new Date(input.scheduledAt as string).toISOString() : null,
    },
  }
}

function toConnectionSummary(row: {
  id: string
  instagram_user_id: string | null
  instagram_username: string | null
  token_expires_at: string | null
  updated_at: string
  metadata: unknown
}): InstagramConnectionSummary {
  const metadata =
    row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : null
  const profile = parseSavedProfileFromMetadata(row.metadata)

  return {
    accountType:
      metadata && typeof metadata.account_type === "string" ? metadata.account_type : null,
    id: row.id,
    instagramUserId: row.instagram_user_id,
    instagramUsername: row.instagram_username,
    profileFetchedAt: profile?.fetched_at ?? null,
    tokenExpiresAt: row.token_expires_at,
    updatedAt: row.updated_at,
  }
}

export async function createInstagramPostJob({
  input,
  supabase,
  supabaseUrl,
  userId,
}: {
  input: PrepareInstagramPostInput
  supabase: SupabaseClient
  supabaseUrl: string
  userId: string
}): Promise<CreateInstagramPostJobResult> {
  const parsed = parseInput({ input, supabaseUrl, userId })
  if (!parsed.ok) {
    return parsed
  }

  const { data: connection, error: connectionError } = await supabase
    .from("instagram_connections")
    .select("id, instagram_user_id, instagram_username, token_expires_at, updated_at, metadata")
    .eq("id", parsed.value.instagramConnectionId)
    .eq("user_id", userId)
    .eq("status", "connected")
    .maybeSingle()

  if (connectionError) {
    console.error("[autopost/create-instagram-post-job] connection lookup failed:", connectionError)
    return {
      ok: false,
      code: "connection_lookup_failed",
      message: "Failed to verify the Instagram connection.",
      statusCode: 500,
    }
  }

  if (!connection?.id) {
    return {
      ok: false,
      code: "connection_not_found",
      message: "Invalid or disconnected Instagram account. Pick a connected account.",
      statusCode: 400,
    }
  }

  const status = parsed.value.action === "schedule" ? "queued" : "draft"

  const { data: job, error: insertError } = await supabase
    .from("autopost_jobs")
    .insert({
      user_id: userId,
      instagram_connection_id: connection.id,
      media_type: parsed.value.mediaType,
      media_url: parsed.value.mediaUrl,
      caption: parsed.value.caption,
      status,
      scheduled_at: parsed.value.scheduledAt,
      metadata: parsed.value.metadata,
    })
    .select("id, media_url, caption, media_type, status, scheduled_at, created_at, instagram_connection_id, metadata")
    .single()

  if (insertError) {
    console.error("[autopost/create-instagram-post-job] insert failed:", insertError)
    return {
      ok: false,
      code: "insert_failed",
      message: "Failed to save the Instagram post.",
      statusCode: 500,
    }
  }

  if (!job?.instagram_connection_id) {
    console.error("[autopost/create-instagram-post-job] insert missing instagram_connection_id", job)
    return {
      ok: false,
      code: "missing_connection_link",
      message: "The post was saved without an Instagram account link. Try again.",
      statusCode: 500,
    }
  }

  return {
    ok: true,
    connection: toConnectionSummary(connection),
    job: {
      caption: job.caption,
      created_at: job.created_at,
      id: job.id,
      instagram_connection_id: job.instagram_connection_id,
      media_type: job.media_type,
      media_url: job.media_url,
      metadata: (job.metadata ?? {}) as AutopostJobMetadata,
      scheduled_at: job.scheduled_at,
      status: job.status,
    },
  }
}
