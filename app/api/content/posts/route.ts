import { NextResponse } from "next/server"

import {
  createFanvuePostJob,
  type PrepareFanvuePostInput,
} from "@/lib/autopost/create-fanvue-post-job"
import { requirePresenceProductResponse } from "@/lib/product/require-presence"
import { createClient } from "@/lib/supabase/server"

function parseFanvueBody(body: unknown): PrepareFanvuePostInput | "invalid_body" {
  if (!body || typeof body !== "object") {
    return "invalid_body"
  }

  const record = body as Record<string, unknown>
  const fanvueConnectionId =
    typeof record.fanvueConnectionId === "string" ? record.fanvueConnectionId.trim() : ""
  const audience =
    record.audience === "followers-and-subscribers" ? "followers-and-subscribers" : "subscribers"
  const mediaUuids = Array.isArray(record.mediaUuids)
    ? record.mediaUuids.filter((item): item is string => typeof item === "string").map((item) => item.trim())
    : []

  if (!fanvueConnectionId || mediaUuids.length === 0) {
    return "invalid_body"
  }

  const action =
    record.action === "publish" ? "publish" : record.action === "schedule" ? "schedule" : "draft"

  const priceCents =
    typeof record.priceCents === "number" && Number.isFinite(record.priceCents)
      ? Math.round(record.priceCents)
      : null

  return {
    action,
    fanvueConnectionId,
    caption: typeof record.caption === "string" ? record.caption : "",
    scheduledAt: typeof record.scheduledAt === "string" ? record.scheduledAt.trim() : undefined,
    audience,
    mediaUuids,
    mediaPreviewUuid:
      typeof record.mediaPreviewUuid === "string" ? record.mediaPreviewUuid.trim() : null,
    priceCents,
    thumbnailUrl: typeof record.thumbnailUrl === "string" ? record.thumbnailUrl.trim() : null,
  }
}

export async function POST(request: Request) {
  const blocked = requirePresenceProductResponse()
  if (blocked) return blocked

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    let json: unknown
    try {
      json = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = parseFanvueBody(json)
    if (parsed === "invalid_body") {
      return NextResponse.json({ error: "Invalid Fanvue post payload." }, { status: 400 })
    }

    const hasScheduledAt = typeof parsed.scheduledAt === "string" && parsed.scheduledAt.length > 0
    const scheduledAtMs = hasScheduledAt ? new Date(parsed.scheduledAt as string).getTime() : Number.NaN
    if (hasScheduledAt && !Number.isFinite(scheduledAtMs)) {
      return NextResponse.json({ error: "Invalid scheduledAt." }, { status: 400 })
    }

    const scheduleLater = hasScheduledAt && scheduledAtMs > Date.now()
    const action =
      parsed.action === "publish"
        ? "publish"
        : scheduleLater
          ? "schedule"
          : parsed.action

    const result = await createFanvuePostJob({
      input: {
        ...parsed,
        action,
        scheduledAt: scheduleLater ? parsed.scheduledAt : undefined,
      },
      supabase,
      userId: user.id,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.statusCode })
    }

    return NextResponse.json({ post: result.job })
  } catch (error) {
    console.error("[content/posts] POST exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
