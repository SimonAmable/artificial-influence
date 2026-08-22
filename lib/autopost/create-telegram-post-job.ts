import type { SupabaseClient } from "@supabase/supabase-js"

import { publishAutopostJob } from "@/lib/autopost/publish-job"
import type { AutopostCarouselItem, AutopostJobMetadata } from "@/lib/autopost/types"
import { TELEGRAM_POST_CONNECTION_ID } from "@/lib/autopost/send-telegram-post-reminder"
import { isUserPublicBucketMediaUrl } from "@/lib/autopost/validate-media-url"

export type PrepareTelegramPostAction = "draft" | "publish" | "schedule"

export type PrepareTelegramPostInput = {
  action: PrepareTelegramPostAction
  caption?: string
  scheduledAt?: string
  mediaUrl?: string
  carouselItems?: AutopostCarouselItem[]
  assetKind?: "image" | "video"
  targetPlatform?: string
}

type CreateTelegramPostJobSuccess = {
  ok: true
  job: {
    id: string
    media_url: string
    caption: string | null
    media_type: string
    status: string
    scheduled_at: string | null
    created_at: string
    metadata: AutopostJobMetadata
  }
}

type CreateTelegramPostJobFailureCode =
  | "invalid_body"
  | "invalid_schedule"
  | "invalid_urls"
  | "telegram_not_linked"
  | "insert_failed"
  | "publish_failed"

type CreateTelegramPostJobFailure = {
  ok: false
  code: CreateTelegramPostJobFailureCode
  message: string
  statusCode: number
}

export type CreateTelegramPostJobResult = CreateTelegramPostJobSuccess | CreateTelegramPostJobFailure

type NormalizedTelegramPayload = {
  action: PrepareTelegramPostAction
  mediaUrl: string
  caption: string | null
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

function parseInput({
  input,
  supabaseUrl,
  userId,
}: {
  input: PrepareTelegramPostInput
  supabaseUrl: string
  userId: string
}): CreateTelegramPostJobFailure | { ok: true; value: NormalizedTelegramPayload } {
  const caption = input.caption?.trim() || null
  const carouselItems = Array.isArray(input.carouselItems)
    ? input.carouselItems.filter(isCarouselItem)
    : []

  if (carouselItems.length >= 2) {
    if (carouselItems.length > 10) {
      return {
        ok: false,
        code: "invalid_body",
        message: "Telegram reminders support up to 10 media items.",
        statusCode: 400,
      }
    }

    for (const item of carouselItems) {
      if (!isUserPublicBucketMediaUrl(item.url, userId, supabaseUrl)) {
        return {
          ok: false,
          code: "invalid_urls",
          message: "All media URLs must be public files from your library.",
          statusCode: 400,
        }
      }
    }

    return {
      ok: true,
      value: {
        action: input.action,
        caption,
        mediaUrl: carouselItems[0].url,
        metadata: {
          carouselItems,
          telegram: input.targetPlatform?.trim()
            ? { targetPlatform: input.targetPlatform.trim() }
            : {},
        },
        scheduledAt:
          input.action === "schedule" ? new Date(input.scheduledAt as string).toISOString() : null,
      },
    }
  }

  const mediaUrl = input.mediaUrl?.trim() ?? ""
  if (!mediaUrl) {
    return {
      ok: false,
      code: "invalid_body",
      message: "Add a public media URL before preparing the Telegram reminder.",
      statusCode: 400,
    }
  }

  if (!isUserPublicBucketMediaUrl(mediaUrl, userId, supabaseUrl)) {
    return {
      ok: false,
      code: "invalid_urls",
      message: "Media URL must be a public file from your library.",
      statusCode: 400,
    }
  }

  if (input.action === "schedule") {
    const scheduledAt = input.scheduledAt?.trim()
    if (!scheduledAt) {
      return {
        ok: false,
        code: "invalid_schedule",
        message: "Provide a future scheduledAt when action is schedule.",
        statusCode: 400,
      }
    }
    const due = new Date(scheduledAt).getTime()
    if (!Number.isFinite(due) || due <= Date.now()) {
      return {
        ok: false,
        code: "invalid_schedule",
        message: "scheduledAt must be a future ISO 8601 date-time.",
        statusCode: 400,
      }
    }
  }

  const metadata: AutopostJobMetadata = {
    assetKind: input.assetKind === "video" ? "video" : "image",
    telegram: input.targetPlatform?.trim() ? { targetPlatform: input.targetPlatform.trim() } : {},
  }

  return {
    ok: true,
    value: {
      action: input.action,
      caption,
      mediaUrl,
      metadata,
      scheduledAt:
        input.action === "schedule" ? new Date(input.scheduledAt as string).toISOString() : null,
    },
  }
}

async function loadTelegramChatId(
  supabase: SupabaseClient,
  userId: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("telegram_chat_id")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    console.error("[autopost/create-telegram-post-job] profile lookup failed:", error)
    return null
  }

  return typeof data?.telegram_chat_id === "number" ? data.telegram_chat_id : null
}

export async function createTelegramPostJob({
  input,
  supabase,
  supabaseUrl,
  userId,
}: {
  input: PrepareTelegramPostInput
  supabase: SupabaseClient
  supabaseUrl: string
  userId: string
}): Promise<CreateTelegramPostJobResult> {
  const parsed = parseInput({ input, supabaseUrl, userId })
  if (!parsed.ok) {
    return parsed
  }

  const chatId = await loadTelegramChatId(supabase, userId)
  if (chatId === null) {
    return {
      ok: false,
      code: "telegram_not_linked",
      message: "Connect Telegram in Settings before scheduling post reminders.",
      statusCode: 400,
    }
  }

  const status = parsed.value.action === "schedule" ? "queued" : "draft"

  const { data: job, error: insertError } = await supabase
    .from("autopost_jobs")
    .insert({
      user_id: userId,
      provider: "telegram",
      media_type: "telegram_reminder",
      media_url: parsed.value.mediaUrl,
      caption: parsed.value.caption,
      status,
      scheduled_at: parsed.value.scheduledAt,
      metadata: parsed.value.metadata,
    })
    .select("id, media_url, caption, media_type, status, scheduled_at, created_at, metadata")
    .single()

  if (insertError || !job) {
    console.error("[autopost/create-telegram-post-job] insert failed:", insertError)
    return {
      ok: false,
      code: "insert_failed",
      message: "Failed to save the Telegram reminder.",
      statusCode: 500,
    }
  }

  if (parsed.value.action === "publish") {
    const publishResult = await publishAutopostJob(supabase, job.id, { userId })
    if (!publishResult.ok) {
      return {
        ok: false,
        code: "publish_failed",
        message: publishResult.error,
        statusCode: publishResult.statusCode,
      }
    }

    const { data: publishedJob, error: publishedJobError } = await supabase
      .from("autopost_jobs")
      .select("id, media_url, caption, media_type, status, scheduled_at, created_at, metadata")
      .eq("id", job.id)
      .eq("user_id", userId)
      .single()

    if (publishedJobError || !publishedJob) {
      return {
        ok: false,
        code: "publish_failed",
        message: "Telegram reminder was sent, but the saved record could not be refreshed.",
        statusCode: 500,
      }
    }

    return {
      ok: true,
      job: {
        caption: publishedJob.caption,
        created_at: publishedJob.created_at,
        id: publishedJob.id,
        media_type: publishedJob.media_type,
        media_url: publishedJob.media_url,
        metadata: (publishedJob.metadata ?? {}) as AutopostJobMetadata,
        scheduled_at: publishedJob.scheduled_at,
        status: publishedJob.status,
      },
    }
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
      status: job.status,
    },
  }
}

export function isTelegramPostConnectionId(connectionId: string): boolean {
  return connectionId.trim() === TELEGRAM_POST_CONNECTION_ID
}
