import { NextResponse } from "next/server"

import { SOCIAL_REFERENCE_DOWNLOAD_JOB_TABLE } from "@/lib/free-tools/social-reference-jobs"
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
        { error: "Sign in to view reference downloads." },
        { status: 401 },
      )
    }

    const { id } = await context.params
    const { data: job, error } = await supabase
      .from(SOCIAL_REFERENCE_DOWNLOAD_JOB_TABLE)
      .select(
        "id, status, source_tiktok_url, source_platform, output_public_url, output_storage_path, output_public_urls, output_storage_paths, output_media_kind, normalization_profile, tiktok_snapshot, apify_run_id, error_message, created_at, started_at, completed_at",
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
        sourceTiktokUrl: job.source_tiktok_url,
        sourcePlatform: job.source_platform === "instagram" ? "instagram" : "tiktok",
        outputPublicUrl: job.output_public_url,
        outputStoragePath: job.output_storage_path,
        outputPublicUrls: Array.isArray(job.output_public_urls) ? job.output_public_urls : [],
        outputStoragePaths: Array.isArray(job.output_storage_paths) ? job.output_storage_paths : [],
        outputMediaKind: job.output_media_kind,
        normalizationProfile: job.normalization_profile,
        tiktokSnapshot: job.tiktok_snapshot,
        apifyRunId: job.apify_run_id,
        errorMessage: job.error_message,
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the job."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Sign in to manage reference downloads." },
        { status: 401 },
      )
    }

    const { id } = await context.params
    const { error } = await supabase
      .from(SOCIAL_REFERENCE_DOWNLOAD_JOB_TABLE)
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete the job."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
