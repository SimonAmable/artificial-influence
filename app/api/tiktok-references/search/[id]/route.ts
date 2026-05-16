import { NextResponse } from "next/server"

import { TIKTOK_REFERENCE_SEARCH_JOB_TABLE } from "@/lib/free-tools/social-reference-jobs"
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
        { error: "Sign in to view TikTok search jobs." },
        { status: 401 },
      )
    }

    const { id } = await context.params
    const { data: job, error } = await supabase
      .from(TIKTOK_REFERENCE_SEARCH_JOB_TABLE)
      .select(
        "id, status, search_query, video_sorting, date_filter, results_requested, result_videos, apify_run_id, error_message, created_at, started_at, completed_at",
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
        searchQuery: job.search_query,
        videoSorting: job.video_sorting,
        dateFilter: job.date_filter,
        resultsRequested: job.results_requested,
        videos: job.result_videos,
        apifyRunId: job.apify_run_id,
        errorMessage: job.error_message,
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load search job."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
