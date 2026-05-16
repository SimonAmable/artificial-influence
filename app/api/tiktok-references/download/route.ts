import { NextResponse } from "next/server"
import { waitUntil } from "@vercel/functions"

import {
  processSocialReferenceDownloadJob,
  SOCIAL_REFERENCE_DOWNLOAD_JOB_TABLE,
} from "@/lib/free-tools/social-reference-jobs"
import { detectSocialPlatform } from "@/lib/server/apify/instagram-scraper"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 300

type QueueDownloadRequest = {
  url?: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Sign in to download TikTok / Instagram references." },
        { status: 401 },
      )
    }

    const body = (await request.json().catch(() => ({}))) as QueueDownloadRequest
    const url = typeof body.url === "string" ? body.url.trim() : ""

    let sourcePlatform: "tiktok" | "instagram"

    try {
      sourcePlatform = detectSocialPlatform(url)
    } catch (validationError) {
      return NextResponse.json(
        { error: validationError instanceof Error ? validationError.message : "Invalid URL." },
        { status: 400 },
      )
    }

    const { data: job, error: insertError } = await supabase
      .from(SOCIAL_REFERENCE_DOWNLOAD_JOB_TABLE)
      .insert({
        user_id: user.id,
        status: "queued",
        source_tiktok_url: url,
        source_platform: sourcePlatform,
      })
      .select("id")
      .single()

    if (insertError || !job) {
      return NextResponse.json(
        { error: insertError?.message ?? "Could not create download job." },
        { status: 500 },
      )
    }

    waitUntil(processSocialReferenceDownloadJob(job.id))

    return NextResponse.json({ jobId: job.id, sourcePlatform }, { status: 202 })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not queue the download."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
