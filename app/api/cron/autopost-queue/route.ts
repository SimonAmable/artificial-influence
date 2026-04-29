import { NextResponse } from "next/server"

import { publishAutopostJob } from "@/lib/autopost/publish-job"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export const maxDuration = 300

function verifyCronAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return false
  }
  const auth = request.headers.get("authorization")
  const expected = `Bearer ${secret}`
  return auth === expected
}

async function handleAutopostCron(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    console.error("[cron/autopost-queue] SUPABASE_SERVICE_ROLE_KEY or URL missing")
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 })
  }

  const nowIso = new Date().toISOString()
  // PostgREST needs quoted timestamps in or() because of ':' in ISO strings.
  const dueOrNull = `scheduled_at.is.null,scheduled_at.lte."${nowIso}"`

  const { data: dueRow, error: selectError } = await admin
    .from("autopost_jobs")
    .select("id")
    .eq("status", "queued")
    .or(dueOrNull)
    .order("scheduled_at", { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle()

  if (selectError) {
    console.error("[cron/autopost-queue] select failed:", selectError)
    return NextResponse.json({ error: "Query failed." }, { status: 500 })
  }

  if (!dueRow?.id) {
    return NextResponse.json({ ok: true, processed: 0 })
  }

  const result = await publishAutopostJob(admin, dueRow.id)

  if (result.ok) {
    return NextResponse.json({
      ok: true,
      processed: 1,
      jobId: dueRow.id,
      provider: result.provider,
      instagramMediaId: result.instagramMediaId,
      publishId: result.publishId,
      status: result.status,
    })
  }

  console.error("[cron/autopost-queue] publish failed:", dueRow.id, result.error)

  return NextResponse.json(
    {
      ok: false,
      processed: 1,
      jobId: dueRow.id,
      error: result.error,
    },
    { status: result.statusCode >= 500 ? 500 : result.statusCode }
  )
}

/**
 * Vercel Cron: processes one due queued autopost job per invocation.
 * Secured with CRON_SECRET (Authorization: Bearer <CRON_SECRET>).
 */
export async function GET(request: Request) {
  return handleAutopostCron(request)
}

/** Same as GET, useful for manual curl with POST. */
export async function POST(request: Request) {
  return handleAutopostCron(request)
}
