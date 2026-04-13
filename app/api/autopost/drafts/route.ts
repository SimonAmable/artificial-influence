import { NextResponse } from "next/server"

import { createInstagramPostJob, type PrepareInstagramPostInput } from "@/lib/autopost/create-instagram-post-job"
import { createClient } from "@/lib/supabase/server"

type MediaType = "image" | "reel" | "feed_video" | "carousel" | "story"

function parseBody(
  body: unknown,
): PrepareInstagramPostInput | "invalid_body" {
  if (!body || typeof body !== "object") {
    return "invalid_body"
  }
  const record = body as Record<string, unknown>
  const caption = typeof record.caption === "string" ? record.caption : ""
  const instagramConnectionId =
    typeof record.instagramConnectionId === "string" ? record.instagramConnectionId.trim() : ""

  const mediaTypeRaw = record.mediaType
  const mediaType: MediaType | null =
    mediaTypeRaw === "reel"
      ? "reel"
      : mediaTypeRaw === "image"
        ? "image"
        : mediaTypeRaw === "feed_video"
          ? "feed_video"
          : mediaTypeRaw === "carousel"
            ? "carousel"
            : mediaTypeRaw === "story"
              ? "story"
              : null

  if (!mediaType || !instagramConnectionId) {
    return "invalid_body"
  }

  return {
    action: "draft",
    caption,
    carouselItems: Array.isArray(record.carouselItems)
      ? record.carouselItems
          .filter((item): item is { url: string; kind: "image" | "video" } => {
            if (!item || typeof item !== "object") return false
            const candidate = item as Record<string, unknown>
            return (
              typeof candidate.url === "string" &&
              (candidate.kind === "image" || candidate.kind === "video")
            )
          })
          .map((item) => ({
            kind: item.kind,
            url: item.url.trim(),
          }))
      : undefined,
    coverUrl: typeof record.coverUrl === "string" ? record.coverUrl.trim() : undefined,
    instagramConnectionId,
    mediaType,
    mediaUrl: typeof record.mediaUrl === "string" ? record.mediaUrl.trim() : undefined,
    scheduledAt: typeof record.scheduledAt === "string" ? record.scheduledAt.trim() : undefined,
    shareToFeed: record.shareToFeed === false ? false : undefined,
    storyAssetKind:
      record.assetKind === "video" ? "video" : record.assetKind === "image" ? "image" : undefined,
    trialParams:
      record.trialParams && typeof record.trialParams === "object"
        ? {
            graduationStrategy:
              (record.trialParams as { graduationStrategy?: unknown }).graduationStrategy === "SS_PERFORMANCE"
                ? "SS_PERFORMANCE"
                : "MANUAL",
          }
        : undefined,
  }
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
    if (parsed === "invalid_body") {
      return NextResponse.json(
        {
          error:
            "Invalid body. Send mediaType (image | reel | feed_video | carousel | story), instagramConnectionId, mediaUrl (or carouselItems for carousels), and for story assetKind (image | video).",
        },
        { status: 400 }
      )
    }
    const hasScheduledAt = typeof parsed.scheduledAt === "string" && parsed.scheduledAt.trim().length > 0
    const scheduledAtMs = hasScheduledAt ? new Date(parsed.scheduledAt as string).getTime() : Number.NaN

    if (hasScheduledAt && !Number.isFinite(scheduledAtMs)) {
      return NextResponse.json(
        { error: "Invalid scheduledAt (use an ISO 8601 date-time string)." },
        { status: 400 },
      )
    }

    const scheduleLater = hasScheduledAt && scheduledAtMs > Date.now()

    const result = await createInstagramPostJob({
      input: {
        ...parsed,
        action: scheduleLater ? "schedule" : "draft",
        scheduledAt: scheduleLater ? parsed.scheduledAt : undefined,
      },
      supabase,
      supabaseUrl,
      userId: user.id,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.statusCode })
    }

    return NextResponse.json({ draft: result.job })
  } catch (error) {
    console.error("[autopost/drafts] POST exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
