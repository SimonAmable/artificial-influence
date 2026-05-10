import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import type { AutopostJobMetadata } from "@/lib/autopost/types"

const EDITABLE_CAPTION_STATUSES = new Set(["draft", "queued", "failed"])
const EDITABLE_SLIDE_STATUSES = new Set(["draft", "queued"])

const MAX_CAPTION_LENGTH = 4096

function parseJobMetadata(raw: unknown): AutopostJobMetadata {
  if (!raw || typeof raw !== "object") {
    return {}
  }
  return raw as AutopostJobMetadata
}

function photoCoverIndexAfterReorder(
  photoItems: { url: string }[],
  fromIndex: number,
  toIndex: number,
  previousCoverIndex: unknown,
): number {
  const len = photoItems.length
  if (len === 0) {
    return 0
  }
  const prev =
    typeof previousCoverIndex === "number" && Number.isInteger(previousCoverIndex)
      ? Math.min(Math.max(0, previousCoverIndex), len - 1)
      : 0
  const coverUrl = photoItems[prev]?.url
  const next = [...photoItems]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  if (!coverUrl) {
    return Math.min(prev, Math.max(0, next.length - 1))
  }
  const idx = next.findIndex((p) => p.url === coverUrl)
  return idx >= 0 ? idx : 0
}

function nextPhotoCoverAfterRemoval(
  prevCoverRaw: unknown,
  removedIndex: number,
  newLength: number,
): number {
  if (newLength <= 0) {
    return 0
  }
  const oldLen = newLength + 1
  const prev =
    typeof prevCoverRaw === "number" && Number.isInteger(prevCoverRaw)
      ? Math.min(Math.max(0, prevCoverRaw), Math.max(oldLen - 1, 0))
      : 0
  let cover = prev
  if (removedIndex < cover) {
    cover -= 1
  } else if (removedIndex === cover) {
    cover = Math.min(cover, newLength - 1)
  }
  return Math.min(Math.max(0, cover), newLength - 1)
}

/** Update caption and/or carousel — draft, queued (and caption only when failed). */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobId } = await context.params
    const trimmed = jobId?.trim() ?? ""
    if (!trimmed) {
      return NextResponse.json({ error: "Invalid job id." }, { status: 400 })
    }

    let bodyRaw: unknown
    try {
      bodyRaw = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
    }

    if (!bodyRaw || typeof bodyRaw !== "object" || Array.isArray(bodyRaw)) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
    }

    const payload = bodyRaw as Record<string, unknown>
    const captionKeySeen = Object.prototype.hasOwnProperty.call(payload, "caption")
    const removeSlideAtRaw = payload.removeSlideAt
    const removeSlideSeen = removeSlideAtRaw !== undefined
    const reorderSlideRaw = payload.reorderSlide
    const reorderSlideSeen = reorderSlideRaw !== undefined && reorderSlideRaw !== null

    const patchOpCount = [captionKeySeen, removeSlideSeen, reorderSlideSeen].filter(Boolean).length
    if (patchOpCount !== 1) {
      return NextResponse.json(
        { error: "Send exactly one of: caption, removeSlideAt, or reorderSlide." },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    if (captionKeySeen) {
      let nextCaption: string | null
      const rawCaption = payload.caption
      if (rawCaption === null || rawCaption === undefined) {
        nextCaption = null
      } else if (typeof rawCaption !== "string") {
        return NextResponse.json({ error: "Caption must be a string or null." }, { status: 400 })
      } else {
        nextCaption = rawCaption.trim().length === 0 ? null : rawCaption.trim()
      }

      if (nextCaption !== null && nextCaption.length > MAX_CAPTION_LENGTH) {
        return NextResponse.json(
          { error: `Caption must be at most ${MAX_CAPTION_LENGTH} characters.` },
          { status: 400 },
        )
      }

      const { data: job, error: fetchError } = await supabase
        .from("autopost_jobs")
        .select("id, status, caption, metadata, provider")
        .eq("id", trimmed)
        .eq("user_id", user.id)
        .maybeSingle()

      if (fetchError || !job) {
        return NextResponse.json({ error: "Post not found." }, { status: 404 })
      }

      if (!EDITABLE_CAPTION_STATUSES.has(job.status)) {
        return NextResponse.json(
          { error: "Only drafts, scheduled, or failed posts can edit captions." },
          { status: 400 },
        )
      }

      const meta = parseJobMetadata(job.metadata)
      let nextMetadata: AutopostJobMetadata = meta

      if (job.provider === "tiktok") {
        nextMetadata = {
          ...meta,
          tiktok: {
            ...(meta.tiktok ?? {}),
            description: nextCaption ?? undefined,
          },
        }
      }

      const { error: updateError } = await supabase
        .from("autopost_jobs")
        .update({
          caption: nextCaption,
          metadata: nextMetadata as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq("id", trimmed)
        .eq("user_id", user.id)

      if (updateError) {
        console.error("[autopost/jobs] PATCH caption failed:", updateError)
        return NextResponse.json({ error: "Failed to update caption." }, { status: 500 })
      }

      return NextResponse.json({
        ok: true,
        caption: nextCaption,
        metadata: nextMetadata,
      })
    }

    if (reorderSlideSeen) {
      if (
        typeof reorderSlideRaw !== "object" ||
        reorderSlideRaw === null ||
        Array.isArray(reorderSlideRaw)
      ) {
        return NextResponse.json({ error: "reorderSlide must be an object." }, { status: 400 })
      }
      const reorder = reorderSlideRaw as Record<string, unknown>
      const fromRaw = reorder.fromIndex
      const toRaw = reorder.toIndex
      const fromIndex = typeof fromRaw === "number" ? fromRaw : Number.NaN
      const toIndex = typeof toRaw === "number" ? toRaw : Number.NaN
      if (
        !Number.isInteger(fromIndex) ||
        !Number.isInteger(toIndex) ||
        fromIndex < 0 ||
        toIndex < 0
      ) {
        return NextResponse.json(
          { error: "reorderSlide.fromIndex and reorderSlide.toIndex must be non-negative integers." },
          { status: 400 },
        )
      }

      const { data: job, error: fetchError } = await supabase
        .from("autopost_jobs")
        .select("id, status, media_type, media_url, metadata")
        .eq("id", trimmed)
        .eq("user_id", user.id)
        .maybeSingle()

      if (fetchError || !job) {
        return NextResponse.json({ error: "Post not found." }, { status: 404 })
      }

      if (!EDITABLE_SLIDE_STATUSES.has(job.status)) {
        return NextResponse.json(
          { error: "Only drafts and scheduled posts can reorder slides." },
          { status: 400 },
        )
      }

      const meta = parseJobMetadata(job.metadata)
      let nextMetadata: AutopostJobMetadata = { ...meta }
      let nextMediaUrl = job.media_url as string | null

      if (job.media_type === "carousel") {
        const items = [...(meta.carouselItems ?? [])]
        if (fromIndex >= items.length || toIndex >= items.length) {
          return NextResponse.json({ error: "Reorder index out of range." }, { status: 400 })
        }
        if (items.length < 2) {
          return NextResponse.json({ error: "Nothing to reorder." }, { status: 400 })
        }
        if (fromIndex !== toIndex) {
          const [moved] = items.splice(fromIndex, 1)
          if (!moved) {
            return NextResponse.json({ error: "Invalid carousel state." }, { status: 500 })
          }
          items.splice(toIndex, 0, moved)
        }
        nextMetadata = { ...meta, carouselItems: items }
        nextMediaUrl = items[0]?.url ?? nextMediaUrl
      } else if (job.media_type === "tiktok_photo_upload" || job.media_type === "tiktok_photo_direct") {
        const photoItems = [...(meta.tiktok?.photoItems ?? [])]
        if (fromIndex >= photoItems.length || toIndex >= photoItems.length) {
          return NextResponse.json({ error: "Reorder index out of range." }, { status: 400 })
        }
        if (photoItems.length < 2) {
          return NextResponse.json({ error: "Nothing to reorder." }, { status: 400 })
        }
        if (fromIndex !== toIndex) {
          const [moved] = photoItems.splice(fromIndex, 1)
          if (!moved) {
            return NextResponse.json({ error: "Invalid TikTok photo state." }, { status: 500 })
          }
          photoItems.splice(toIndex, 0, moved)
        }
        const nextCover = photoCoverIndexAfterReorder(
          meta.tiktok?.photoItems ?? [],
          fromIndex,
          toIndex,
          meta.tiktok?.photoCoverIndex,
        )
        nextMetadata = {
          ...meta,
          tiktok: {
            ...(meta.tiktok ?? {}),
            photoItems,
            photoCoverIndex: nextCover,
          },
        }
        nextMediaUrl = photoItems[0]?.url ?? nextMediaUrl
      } else {
        return NextResponse.json(
          { error: "This post type does not support reordering slides." },
          { status: 400 },
        )
      }

      const { error: reorderError } = await supabase
        .from("autopost_jobs")
        .update({
          metadata: nextMetadata as unknown as Record<string, unknown>,
          media_url: nextMediaUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", trimmed)
        .eq("user_id", user.id)
        .in("status", ["draft", "queued"])

      if (reorderError) {
        console.error("[autopost/jobs] PATCH reorder failed:", reorderError)
        return NextResponse.json({ error: "Failed to reorder slides." }, { status: 500 })
      }

      return NextResponse.json({
        ok: true,
        metadata: nextMetadata,
        media_url: nextMediaUrl,
      })
    }

    const removeSlideAt =
      typeof removeSlideAtRaw === "number" ? removeSlideAtRaw : Number.NaN

    if (!Number.isInteger(removeSlideAt) || removeSlideAt < 0) {
      return NextResponse.json({ error: "removeSlideAt must be a non-negative integer." }, { status: 400 })
    }

    const { data: job, error: fetchError } = await supabase
      .from("autopost_jobs")
      .select("id, status, media_type, media_url, metadata")
      .eq("id", trimmed)
      .eq("user_id", user.id)
      .maybeSingle()

    if (fetchError || !job) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 })
    }

    if (!EDITABLE_SLIDE_STATUSES.has(job.status)) {
      return NextResponse.json(
        { error: "Only drafts and scheduled posts can remove slides." },
        { status: 400 },
      )
    }

    const meta = parseJobMetadata(job.metadata)
    let nextMetadata: AutopostJobMetadata = { ...meta }
    let nextMediaUrl = job.media_url as string | null

    if (job.media_type === "carousel") {
      const items = [...(meta.carouselItems ?? [])]
      if (removeSlideAt >= items.length) {
        return NextResponse.json({ error: "Slide index out of range." }, { status: 400 })
      }
      if (items.length <= 2) {
        return NextResponse.json(
          {
            error:
              "A carousel needs at least two slides. Delete the whole post or add more slides first.",
          },
          { status: 400 },
        )
      }
      items.splice(removeSlideAt, 1)
      nextMetadata = {
        ...meta,
        carouselItems: items,
      }
      nextMediaUrl = items[0]?.url ?? nextMediaUrl
    } else if (job.media_type === "tiktok_photo_upload" || job.media_type === "tiktok_photo_direct") {
      const photoItems = [...(meta.tiktok?.photoItems ?? [])]
      if (removeSlideAt >= photoItems.length) {
        return NextResponse.json({ error: "Slide index out of range." }, { status: 400 })
      }
      if (photoItems.length <= 1) {
        return NextResponse.json(
          { error: "A TikTok photo post needs at least one image." },
          { status: 400 },
        )
      }
      photoItems.splice(removeSlideAt, 1)
      const nextCover = nextPhotoCoverAfterRemoval(meta.tiktok?.photoCoverIndex, removeSlideAt, photoItems.length)
      nextMetadata = {
        ...meta,
        tiktok: {
          ...(meta.tiktok ?? {}),
          photoItems,
          photoCoverIndex: nextCover,
        },
      }
      nextMediaUrl = photoItems[0]?.url ?? nextMediaUrl
    } else {
      return NextResponse.json(
        { error: "This post type does not support removing individual slides." },
        { status: 400 },
      )
    }

    const { error: updateError } = await supabase
      .from("autopost_jobs")
      .update({
        metadata: nextMetadata as unknown as Record<string, unknown>,
        media_url: nextMediaUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", trimmed)
      .eq("user_id", user.id)
      .in("status", ["draft", "queued"])

    if (updateError) {
      console.error("[autopost/jobs] PATCH slide removal failed:", updateError)
      return NextResponse.json({ error: "Failed to update post." }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      metadata: nextMetadata,
      media_url: nextMediaUrl,
    })
  } catch (error) {
    console.error("[autopost/jobs] PATCH exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobId } = await context.params
    const trimmed = jobId?.trim() ?? ""
    if (!trimmed) {
      return NextResponse.json({ error: "Invalid job id." }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    const { data: job, error: fetchError } = await supabase
      .from("autopost_jobs")
      .select("id, status")
      .eq("id", trimmed)
      .eq("user_id", user.id)
      .maybeSingle()

    if (fetchError || !job) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 })
    }

    if (job.status !== "draft" && job.status !== "queued") {
      return NextResponse.json(
        { error: "Only drafts and scheduled posts can be cancelled." },
        { status: 400 },
      )
    }

    const { error: updateError } = await supabase
      .from("autopost_jobs")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", trimmed)
      .eq("user_id", user.id)
      .in("status", ["draft", "queued"])

    if (updateError) {
      console.error("[autopost/jobs] DELETE update failed:", updateError)
      return NextResponse.json({ error: "Failed to cancel post." }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[autopost/jobs] DELETE exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
