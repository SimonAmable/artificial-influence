import { NextRequest, NextResponse } from "next/server"

import { TIKTOK_REFERENCE_SEARCH_JOB_TABLE } from "@/lib/free-tools/social-reference-jobs"
import { createClient } from "@/lib/supabase/server"

function clampLimit(raw: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Sign in to view TikTok search history." }, { status: 401 })
    }

    const limit = clampLimit(request.nextUrl.searchParams.get("limit"), 15, 1, 50)

    const { data: rows, error } = await supabase
      .from(TIKTOK_REFERENCE_SEARCH_JOB_TABLE)
      .select(
        "id, status, search_query, video_sorting, date_filter, results_requested, error_message, created_at, completed_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      jobs:
        rows?.map((job) => ({
          id: job.id,
          status: job.status,
          searchQuery: job.search_query,
          videoSorting: job.video_sorting,
          dateFilter: job.date_filter,
          resultsRequested: job.results_requested,
          errorMessage: job.error_message,
          createdAt: job.created_at,
          completedAt: job.completed_at,
        })) ?? [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not list search jobs."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
