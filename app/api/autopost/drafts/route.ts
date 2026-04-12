import { NextResponse } from "next/server"

import { isUserPublicBucketMediaUrl } from "@/lib/autopost/validate-media-url"
import { createClient } from "@/lib/supabase/server"

type MediaType = "image" | "reel"

function parseBody(
  body: unknown
): { mediaUrl: string; caption: string; mediaType: MediaType; scheduledAt?: Date } | "invalid_schedule" | null {
  if (!body || typeof body !== "object") {
    return null
  }
  const record = body as Record<string, unknown>
  const mediaUrl = typeof record.mediaUrl === "string" ? record.mediaUrl.trim() : ""
  const caption = typeof record.caption === "string" ? record.caption : ""
  const mediaType = record.mediaType === "reel" ? "reel" : record.mediaType === "image" ? "image" : null

  if (!mediaUrl || !mediaType) {
    return null
  }

  const scheduledRaw = typeof record.scheduledAt === "string" ? record.scheduledAt.trim() : ""
  if (scheduledRaw === "") {
    return { mediaUrl, caption, mediaType }
  }

  const scheduledAt = new Date(scheduledRaw)
  if (!Number.isFinite(scheduledAt.getTime())) {
    return "invalid_schedule"
  }

  return { mediaUrl, caption, mediaType, scheduledAt }
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    let json: unknown
    try {
      json = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = parseBody(json)
    if (parsed === "invalid_schedule") {
      return NextResponse.json({ error: "Invalid scheduledAt (use an ISO 8601 date-time string)." }, { status: 400 })
    }
    if (!parsed) {
      return NextResponse.json(
        { error: "Expected mediaUrl (string) and mediaType (\"image\" | \"reel\")." },
        { status: 400 }
      )
    }

    const now = Date.now()
    const scheduleLater = parsed.scheduledAt !== undefined && parsed.scheduledAt.getTime() > now

    if (!isUserPublicBucketMediaUrl(parsed.mediaUrl, user.id, supabaseUrl)) {
      return NextResponse.json(
        { error: "Media URL must be a public file uploaded to your account storage." },
        { status: 400 }
      )
    }

    const { data: connection } = await supabase
      .from("instagram_connections")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "connected")
      .maybeSingle()

    const { data: job, error: insertError } = await supabase
      .from("autopost_jobs")
      .insert({
        user_id: user.id,
        instagram_connection_id: connection?.id ?? null,
        media_type: parsed.mediaType,
        media_url: parsed.mediaUrl,
        caption: parsed.caption.trim().length > 0 ? parsed.caption.trim() : null,
        status: scheduleLater ? "queued" : "draft",
        scheduled_at: scheduleLater ? parsed.scheduledAt!.toISOString() : null,
      })
      .select("id, media_url, caption, media_type, status, scheduled_at, created_at")
      .single()

    if (insertError) {
      console.error("[autopost/drafts] insert failed:", insertError)
      return NextResponse.json({ error: "Failed to save draft." }, { status: 500 })
    }

    return NextResponse.json({ draft: job })
  } catch (error) {
    console.error("[autopost/drafts] POST exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
