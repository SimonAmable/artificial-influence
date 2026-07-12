import { NextRequest, NextResponse } from "next/server"
import {
  listHistoryFeed,
  type HistoryFeedMediaType,
  type HistoryFeedSourceFilter,
} from "@/lib/library/history-feed"
import { createClient } from "@/lib/supabase/server"

const DEFAULT_LIMIT = 24
const MAX_LIMIT = 100

function parseLimit(rawLimit: string | null) {
  const parsed = Number.parseInt(rawLimit ?? String(DEFAULT_LIMIT), 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LIMIT
  }
  return Math.min(Math.floor(parsed), MAX_LIMIT)
}

function parseOffset(rawOffset: string | null) {
  const parsed = Number.parseInt(rawOffset ?? "0", 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }
  return Math.floor(parsed)
}

function normalizeSearch(rawSearch: string | null) {
  return (rawSearch ?? "").trim().replace(/\s+/g, " ").slice(0, 120)
}

function parseSource(raw: string | null): HistoryFeedSourceFilter {
  if (raw === "generation" || raw === "upload" || raw === "all") {
    return raw
  }
  return "all"
}

function parseType(raw: string | null): HistoryFeedMediaType | null {
  if (raw === "image" || raw === "video" || raw === "audio") {
    return raw
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const type = parseType(searchParams.get("type"))
    const tool = searchParams.get("tool")
    const source = parseSource(searchParams.get("source"))
    const limit = parseLimit(searchParams.get("limit"))
    const offset = parseOffset(searchParams.get("offset"))
    const search = normalizeSearch(searchParams.get("search"))
    const includePending = searchParams.get("includePending") === "true"
    const excludeFailed = searchParams.get("excludeFailed") !== "false"

    const result = await listHistoryFeed(supabase, {
      userId: user.id,
      type,
      tool,
      source,
      search,
      limit,
      offset,
      includePending,
      excludeFailed,
    })

    return NextResponse.json({
      generations: result.items,
      items: result.items,
      pagination: result.pagination,
    })
  } catch (error) {
    console.error("[history] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch history",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
