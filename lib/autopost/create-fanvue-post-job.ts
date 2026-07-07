import type { SupabaseClient } from "@supabase/supabase-js"

import type { AutopostJobMetadata } from "@/lib/autopost/types"
import { publishAutopostJob } from "@/lib/autopost/publish-job"

export type PrepareFanvuePostAction = "draft" | "publish" | "schedule"
export type FanvuePostAudience = "subscribers" | "followers-and-subscribers"

export type PrepareFanvuePostInput = {
  action: PrepareFanvuePostAction
  fanvueConnectionId: string
  caption?: string
  scheduledAt?: string
  audience: FanvuePostAudience
  mediaUuids: string[]
  mediaPreviewUuid?: string | null
  priceCents?: number | null
  thumbnailUrl?: string | null
}

type CreateFanvuePostJobResult =
  | {
      ok: true
      job: {
        id: string
        media_url: string
        caption: string | null
        media_type: "fanvue_post"
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

export async function createFanvuePostJob(params: {
  input: PrepareFanvuePostInput
  supabase: SupabaseClient
  userId: string
}): Promise<CreateFanvuePostJobResult> {
  const { input, supabase, userId } = params
  const connectionId = input.fanvueConnectionId.trim()
  const mediaUuids = input.mediaUuids.map((uuid) => uuid.trim()).filter(Boolean)

  if (!connectionId || mediaUuids.length === 0) {
    return { ok: false, message: "Pick Fanvue media before creating a post.", statusCode: 400 }
  }

  if (input.priceCents != null && input.priceCents > 0 && input.priceCents < 300) {
    return { ok: false, message: "Paid Fanvue posts must be at least $3.00.", statusCode: 400 }
  }

  const { data: connection, error: connectionError } = await supabase
    .from("social_connections")
    .select("id, status")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .eq("provider", "fanvue")
    .maybeSingle()

  if (connectionError) {
    console.error("[autopost/create-fanvue-post-job] connection lookup failed:", connectionError)
    return { ok: false, message: "Failed to verify the Fanvue connection.", statusCode: 500 }
  }

  if (!connection?.id || connection.status !== "connected") {
    return { ok: false, message: "Invalid or disconnected Fanvue account.", statusCode: 400 }
  }

  const caption = typeof input.caption === "string" ? input.caption.trim() : ""
  const metadata: AutopostJobMetadata = {
    fanvue: {
      audience: input.audience,
      mediaUuids,
      mediaPreviewUuid: input.mediaPreviewUuid?.trim() || null,
      priceCents: input.priceCents ?? null,
      thumbnailUrl: input.thumbnailUrl ?? null,
      uploadState: "ready",
    },
  }

  const scheduledAt =
    input.action === "schedule" && input.scheduledAt?.trim() ? input.scheduledAt.trim() : null
  const status =
    input.action === "publish"
      ? "queued"
      : input.action === "schedule"
        ? "queued"
        : "draft"

  const { data: job, error: insertError } = await supabase
    .from("autopost_jobs")
    .insert({
      user_id: userId,
      provider: "fanvue",
      social_connection_id: connection.id,
      media_type: "fanvue_post",
      media_url: input.thumbnailUrl?.trim() || `fanvue://${mediaUuids[0]}`,
      caption: caption || null,
      metadata,
      status,
      scheduled_at: scheduledAt,
    })
    .select(
      "id, media_url, caption, media_type, status, scheduled_at, created_at, social_connection_id, metadata"
    )
    .single()

  if (insertError || !job) {
    console.error("[autopost/create-fanvue-post-job] insert failed:", insertError)
    return { ok: false, message: "Failed to save the Fanvue post.", statusCode: 500 }
  }

  if (input.action === "publish") {
    const publishResult = await publishAutopostJob(supabase, job.id, { forceQueuedBeforeDue: true })
    if (!publishResult.ok) {
      return { ok: false, message: publishResult.error, statusCode: publishResult.statusCode }
    }
  }

  return {
    ok: true,
    job: {
      id: job.id,
      media_url: job.media_url,
      caption: job.caption,
      media_type: "fanvue_post",
      status: job.status,
      scheduled_at: job.scheduled_at,
      created_at: job.created_at,
      social_connection_id: job.social_connection_id,
      metadata: (job.metadata ?? {}) as AutopostJobMetadata,
    },
  }
}
