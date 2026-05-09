import { NextResponse } from "next/server"

import { computeNextRun, validateCronExpression } from "@/lib/automations/schedule"
import type { AutomationRow } from "@/lib/automations/types"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_req: Request, context: RouteContext) {
  try {
    const { id: sourceId } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: src, error: fetchError } = await supabase
      .from("automations")
      .select("*")
      .eq("id", sourceId)
      .maybeSingle()

    if (fetchError || !src) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 })
    }

    const row = src as AutomationRow
    if (row.is_public !== true) {
      return NextResponse.json({ error: "Only public automations can be cloned" }, { status: 403 })
    }
    if (row.user_id === user.id) {
      return NextResponse.json({ error: "Use your own automations from Mine" }, { status: 400 })
    }

    try {
      validateCronExpression(row.cron_schedule, row.timezone)
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid cron expression" },
        { status: 400 },
      )
    }

    const nextRunAt = computeNextRun(row.cron_schedule, row.timezone, new Date())
    const baseName = row.name.trim() || "Automation"
    const copyName = baseName.endsWith("(copy)") ? baseName : `${baseName} (copy)`

    const { data: inserted, error: insertError } = await supabase
      .from("automations")
      .insert({
        user_id: user.id,
        name: copyName,
        description: row.description ?? null,
        prompt: row.prompt,
        prompt_payload: row.prompt_payload,
        cron_schedule: row.cron_schedule,
        timezone: row.timezone,
        model: row.model,
        is_active: false,
        next_run_at: nextRunAt.toISOString(),
        run_count: 0,
        is_public: false,
        cloned_from: sourceId,
      })
      .select("*")
      .single()

    if (insertError) {
      console.error("[automations/clone] insert:", insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ automation: inserted })
  } catch (e) {
    console.error("[automations/clone] exception:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
