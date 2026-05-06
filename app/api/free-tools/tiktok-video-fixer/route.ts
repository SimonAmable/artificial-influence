import { NextResponse } from "next/server"
import { waitUntil } from "@vercel/functions"

import {
  processTikTokVideoFixerJob,
  TIKTOK_VIDEO_FIXER_JOB_TABLE,
} from "@/lib/free-tools/tiktok-video-fixer-jobs"
import { assertAcceptedCurrentTerms } from "@/lib/legal/terms-acceptance"
import {
  createMissingFfmpegMessage,
  resolveFfmpegBinaryPath,
} from "@/lib/server/ffmpeg-binaries"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { createClient } from "@/lib/supabase/server"
import { resolveStoredObjectUrl } from "@/lib/uploads/server"

export const runtime = "nodejs"
export const maxDuration = 300

type QueueTikTokVideoFixerRequest = {
  sourceStoragePath?: string
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
        { error: "Sign in to use the TikTok video fixer." },
        { status: 401 }
      )
    }

    const termsResponse = await assertAcceptedCurrentTerms(supabase, user.id)
    if (termsResponse) {
      return termsResponse
    }

    const body = (await request.json().catch(() => ({}))) as QueueTikTokVideoFixerRequest
    if (!body.sourceStoragePath) {
      return NextResponse.json({ error: "Upload a video first." }, { status: 400 })
    }

    const storageClient = createServiceRoleClient()
    if (!storageClient) {
      return NextResponse.json(
        { error: "Storage is not configured on the server." },
        { status: 500 }
      )
    }

    if (!resolveFfmpegBinaryPath()) {
      return NextResponse.json({ error: createMissingFfmpegMessage() }, { status: 500 })
    }

    const { data: uploadRow, error: uploadError } = await supabase
      .from("uploads")
      .select("bucket, storage_path, mime_type, original_filename")
      .eq("user_id", user.id)
      .eq("storage_path", body.sourceStoragePath)
      .maybeSingle()

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    if (!uploadRow) {
      return NextResponse.json({ error: "Uploaded video not found." }, { status: 404 })
    }

    if (typeof uploadRow.mime_type !== "string" || !uploadRow.mime_type.startsWith("video/")) {
      return NextResponse.json({ error: "Only video uploads are supported." }, { status: 400 })
    }

    const sourceUrl = await resolveStoredObjectUrl(
      storageClient,
      String(uploadRow.bucket),
      String(uploadRow.storage_path)
    )

    const sourceFileName =
      typeof uploadRow.original_filename === "string" && uploadRow.original_filename.length > 0
        ? uploadRow.original_filename
        : "video.mp4"

    const { data: job, error: insertError } = await supabase
      .from(TIKTOK_VIDEO_FIXER_JOB_TABLE)
      .insert({
        user_id: user.id,
        status: "queued",
        source_storage_path: uploadRow.storage_path,
        source_url: sourceUrl,
        source_file_name: sourceFileName,
      })
      .select("id")
      .single()

    if (insertError || !job) {
      return NextResponse.json(
        { error: insertError?.message ?? "Failed to create conversion job." },
        { status: 500 }
      )
    }

    waitUntil(processTikTokVideoFixerJob(job.id))

    return NextResponse.json({ jobId: job.id }, { status: 202 })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not queue the video conversion."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
