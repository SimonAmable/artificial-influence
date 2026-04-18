import { NextResponse } from "next/server"

import { computeNextRun, validateCronExpression } from "@/lib/automations/schedule"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const cronSchedule = typeof body?.cronSchedule === "string" ? body.cronSchedule.trim() : ""
    const timezone = typeof body?.timezone === "string" ? body.timezone.trim() || "UTC" : "UTC"

    if (!cronSchedule) {
      return NextResponse.json({ error: "cronSchedule is required" }, { status: 400 })
    }

    try {
      validateCronExpression(cronSchedule, timezone)
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid cron expression" },
        { status: 400 },
      )
    }

    const next = computeNextRun(cronSchedule, timezone, new Date())

    return NextResponse.json({
      nextRunAt: next.toISOString(),
    })
  } catch (e) {
    console.error("[automations/schedule-preview]:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
