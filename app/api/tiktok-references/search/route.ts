import { NextResponse } from "next/server"
import { waitUntil } from "@vercel/functions"

import {
  processTikTokReferenceSearchJob,
  TIKTOK_REFERENCE_SEARCH_JOB_TABLE,
} from "@/lib/free-tools/social-reference-jobs"
import type {
  TikTokVideoSearchDateFilter,
  TikTokVideoSearchSorting,
} from "@/lib/server/apify/tiktok-scraper-types"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 300

type QueueSearchRequest = {
  query?: string
  resultsPerPage?: number
  videoSearchSorting?: unknown
  videoSearchDateFilter?: unknown
}

function parseVideoSearchSorting(raw: unknown): TikTokVideoSearchSorting {
  switch (raw) {
    case "MOST_RELEVANT":
    case "MOST_LIKED":
    case "LATEST":
      return raw
    default:
      return "MOST_RELEVANT"
  }
}

function parseVideoSearchDateFilter(raw: unknown): TikTokVideoSearchDateFilter {
  switch (raw) {
    case "ALL_TIME":
    case "PAST_24_HOURS":
    case "PAST_WEEK":
    case "PAST_MONTH":
    case "LAST_3_MONTHS":
    case "LAST_6_MONTHS":
      return raw
    default:
      return "ALL_TIME"
  }
}

function clampResultsPerPage(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(Math.max(Math.floor(value), 1), 50)
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const n = Number(value)
    if (Number.isFinite(n)) return Math.min(Math.max(Math.floor(n), 1), 50)
  }
  return 24
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
        { error: "Sign in to search TikTok for references." },
        { status: 401 },
      )
    }

    const body = (await request.json().catch(() => ({}))) as QueueSearchRequest
    const query = typeof body.query === "string" ? body.query.trim() : ""

    if (!query) {
      return NextResponse.json({ error: "Enter a TikTok search query." }, { status: 400 })
    }

    const resultsRequested = clampResultsPerPage(body.resultsPerPage)
    const sorting = parseVideoSearchSorting(body.videoSearchSorting)
    const dateFilter = parseVideoSearchDateFilter(body.videoSearchDateFilter)

    const { data: job, error: insertError } = await supabase
      .from(TIKTOK_REFERENCE_SEARCH_JOB_TABLE)
      .insert({
        user_id: user.id,
        status: "queued",
        search_query: query,
        video_sorting: sorting,
        date_filter: dateFilter,
        results_requested: resultsRequested,
      })
      .select("id")
      .single()

    if (insertError || !job) {
      return NextResponse.json(
        { error: insertError?.message ?? "Could not create search job." },
        { status: 500 },
      )
    }

    waitUntil(processTikTokReferenceSearchJob(job.id))

    return NextResponse.json({ jobId: job.id }, { status: 202 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not queue TikTok search."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
