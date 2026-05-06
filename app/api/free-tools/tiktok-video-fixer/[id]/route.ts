import { NextResponse } from "next/server"

import { TIKTOK_VIDEO_FIXER_JOB_TABLE } from "@/lib/free-tools/tiktok-video-fixer-jobs"
import { createClient } from "@/lib/supabase/server"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Sign in to view TikTok video fixer jobs." },
        { status: 401 }
      )
    }

    const { id } = await context.params
    const { data: job, error } = await supabase
      .from(TIKTOK_VIDEO_FIXER_JOB_TABLE)
      .select(
        "id, status, source_file_name, output_file_name, output_url, output_size_bytes, profile, error_message, created_at, started_at, completed_at"
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 })
    }

    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        sourceFileName: job.source_file_name,
        outputFileName: job.output_file_name,
        outputUrl: job.output_url,
        outputSizeBytes: job.output_size_bytes,
        profile: job.profile,
        errorMessage: job.error_message,
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the conversion job."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
