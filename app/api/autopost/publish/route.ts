import { NextResponse } from "next/server"

import { decryptAutopostToken } from "@/lib/autopost/crypto"
import { InstagramGraphError } from "@/lib/instagram/graph"
import { publishToInstagramFeed } from "@/lib/instagram/publish"
import { createClient } from "@/lib/supabase/server"

/** Reels wait on Instagram container status; raise on Vercel Pro+ if publishes time out. */
export const maxDuration = 300

export async function POST(request: Request) {
  try {
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

    const jobId =
      json && typeof json === "object" && typeof (json as { jobId?: unknown }).jobId === "string"
        ? (json as { jobId: string }).jobId.trim()
        : ""

    if (!jobId) {
      return NextResponse.json({ error: "Expected jobId (string)." }, { status: 400 })
    }

    const { data: job, error: jobError } = await supabase
      .from("autopost_jobs")
      .select("id, user_id, media_url, caption, media_type, status, attempts")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (jobError || !job) {
      return NextResponse.json({ error: "Draft not found." }, { status: 404 })
    }

    if (job.status !== "draft" && job.status !== "failed") {
      return NextResponse.json(
        { error: `Cannot publish a job in status "${job.status}".` },
        { status: 400 }
      )
    }

    const { data: connection, error: connectionError } = await supabase
      .from("instagram_connections")
      .select("id, instagram_user_id, access_token_encrypted, token_expires_at, status")
      .eq("user_id", user.id)
      .eq("status", "connected")
      .maybeSingle()

    if (connectionError || !connection?.instagram_user_id || !connection.access_token_encrypted) {
      return NextResponse.json(
        { error: "Connect Instagram before publishing." },
        { status: 400 }
      )
    }

    if (connection.token_expires_at) {
      const expires = new Date(connection.token_expires_at).getTime()
      if (Number.isFinite(expires) && expires < Date.now()) {
        return NextResponse.json(
          { error: "Instagram access token expired. Reconnect your account." },
          { status: 400 }
        )
      }
    }

    let accessToken: string
    try {
      accessToken = decryptAutopostToken(connection.access_token_encrypted)
    } catch (decryptError) {
      console.error("[autopost/publish] decrypt failed:", decryptError)
      return NextResponse.json({ error: "Could not read Instagram credentials." }, { status: 500 })
    }

    const { error: processingUpdateError } = await supabase
      .from("autopost_jobs")
      .update({
        status: "processing",
        attempts: (job.attempts ?? 0) + 1,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("user_id", user.id)

    if (processingUpdateError) {
      console.error("[autopost/publish] processing update failed:", processingUpdateError)
      return NextResponse.json({ error: "Failed to update job." }, { status: 500 })
    }

    try {
      const { containerId, mediaId } = await publishToInstagramFeed({
        accessToken,
        instagramUserId: connection.instagram_user_id,
        mediaUrl: job.media_url,
        caption: job.caption,
        mediaType: job.media_type as "image" | "reel",
      })

      const { error: successUpdateError } = await supabase
        .from("autopost_jobs")
        .update({
          status: "published",
          provider_container_id: containerId,
          provider_publish_id: mediaId,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .eq("user_id", user.id)

      if (successUpdateError) {
        console.error("[autopost/publish] success update failed:", successUpdateError)
      }

      return NextResponse.json({
        ok: true,
        instagramMediaId: mediaId,
        containerId,
      })
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
        .eq("user_id", user.id)

      if (failUpdateError) {
        console.error("[autopost/publish] fail update failed:", failUpdateError)
      }

      return NextResponse.json(
        { error: message },
        { status: publishError instanceof InstagramGraphError ? 502 : 500 }
      )
    }
  } catch (error) {
    console.error("[autopost/publish] POST exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
