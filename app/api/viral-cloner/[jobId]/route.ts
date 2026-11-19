import { NextResponse } from "next/server"
import { waitUntil } from "@vercel/functions"

import { createClient } from "@/lib/supabase/server"
import { processViralCloneJob } from "@/lib/viral-cloner/worker"

type RouteContext = {
  params: Promise<{ jobId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Sign in to view clone jobs." }, { status: 401 })
    }

    const { jobId } = await context.params

    const { data: job, error: jobError } = await supabase
      .from("viral_clone_jobs")
      .select(
        "id, status, source_url, source_platform, source_title, quoted_credits_total, import_fee_captured, error_message, created_at, completed_at, social_import_id",
      )
      .eq("id", jobId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 500 })
    }
    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 })
    }

    const { data: importRow } = await supabase
      .from("social_media_imports")
      .select("manifest, expires_at")
      .eq("id", job.social_import_id)
      .maybeSingle()

    const { data: items, error: itemsError } = await supabase
      .from("viral_clone_items")
      .select(
        "id, item_index, media_kind, status, quoted_credits, generation_id, source_public_url, output_url, error_message, trim_start_seconds, trim_end_seconds",
      )
      .eq("job_id", jobId)
      .order("item_index")

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    const itemCredits = (items ?? []).reduce((sum, row) => sum + Number(row.quoted_credits ?? 0), 0)

    const needsWorkerNudge =
      job.status === "importing" ||
      job.status === "submitting" ||
      (items ?? []).some(
        (row) =>
          row.status === "pending" ||
          row.status === "importing" ||
          row.status === "queued",
      )
    if (needsWorkerNudge) {
      waitUntil(processViralCloneJob(jobId))
    }

    return NextResponse.json({
      job,
      source: {
        manifest: importRow?.manifest ?? null,
        expiresAt: importRow?.expires_at ?? null,
      },
      items: items ?? [],
      creditSummary: {
        itemCredits,
        importCredit: job.import_fee_captured ? 1 : 0,
        totalQuoted: job.quoted_credits_total,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load job."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}