import { NextRequest, NextResponse } from "next/server"

import { SOCIAL_REFERENCE_DOWNLOAD_JOB_TABLE } from "@/lib/free-tools/social-reference-jobs"
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
      return NextResponse.json(
        { error: "Sign in to view download history." },
        { status: 401 },
      )
    }

    const limit = clampLimit(request.nextUrl.searchParams.get("limit"), 20, 1, 50)

    const { data: rows, error } = await supabase
      .from(SOCIAL_REFERENCE_DOWNLOAD_JOB_TABLE)
      .select(
        "id, status, source_tiktok_url, source_platform, output_public_url, output_public_urls, output_media_kind, normalization_profile, tiktok_snapshot, error_message, created_at, completed_at",
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
          sourceTiktokUrl: job.source_tiktok_url,
          sourcePlatform: job.source_platform === "instagram" ? "instagram" : "tiktok",
          outputPublicUrl: job.output_public_url,
          outputPublicUrls: Array.isArray(job.output_public_urls) ? job.output_public_urls : [],
          outputMediaKind: job.output_media_kind,
          normalizationProfile: job.normalization_profile,
          tiktokSnapshot: job.tiktok_snapshot,
          errorMessage: job.error_message,
          createdAt: job.created_at,
          completedAt: job.completed_at,
        })) ?? [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not list jobs."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
