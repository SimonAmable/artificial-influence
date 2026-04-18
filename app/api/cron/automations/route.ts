import { NextResponse } from "next/server"

import { computeNextRun } from "@/lib/automations/schedule"
import { runAutomation } from "@/lib/automations/run"
import type { AutomationRow } from "@/lib/automations/types"
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

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error("[cron/automations] AI_GATEWAY_API_KEY not set")
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 })
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    console.error("[cron/automations] SUPABASE_SERVICE_ROLE_KEY or URL missing")
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 })
  }

  const nowIso = new Date().toISOString()

  const { data: dueRows, error: selectError } = await admin
    .from("automations")
    .select("*")
    .eq("is_active", true)
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true })
    .limit(5)

  if (selectError) {
    console.error("[cron/automations] select failed:", selectError)
    return NextResponse.json({ error: "Query failed." }, { status: 500 })
  }

  const results: Array<{ automationId: string; ok: boolean; threadId?: string; error?: string }> = []

  for (const row of dueRows ?? []) {
    const automation = row as AutomationRow
    const nextRun = computeNextRun(automation.cron_schedule, automation.timezone, new Date()).toISOString()

    const { data: claimed, error: claimError } = await admin
      .from("automations")
      .update({
        next_run_at: nextRun,
        updated_at: nowIso,
      })
      .eq("id", automation.id)
      .eq("is_active", true)
      .lte("next_run_at", nowIso)
      .select("*")
      .maybeSingle()

    if (claimError) {
      console.error("[cron/automations] claim failed:", automation.id, claimError)
      continue
    }

    if (!claimed) {
      continue
    }

    const runResult = await runAutomation(admin, claimed as AutomationRow)
    results.push({
      automationId: automation.id,
      ok: runResult.ok,
      threadId: runResult.ok ? runResult.threadId : undefined,
      error: runResult.ok ? undefined : runResult.error,
    })
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    results,
  })
}

export async function POST(request: Request) {
  return GET(request)
}
