import { NextResponse } from "next/server"

import {
  automationPayloadToRowFields,
  parsePromptPayloadFromRequestBody,
} from "@/lib/automations/prompt-payload"
import { computeNextRun, validateCronExpression } from "@/lib/automations/schedule"
import { resolveChatGatewayModel } from "@/lib/constants/chat-llm-models"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: rows, error } = await supabase
      .from("automations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })

    if (error) {
      console.error("[automations] GET list:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const automations = rows ?? []
    const ids = automations.map((a) => a.id as string)
    const latestRuns: Record<string, Record<string, unknown>> = {}

    if (ids.length > 0) {
      const { data: runRows, error: runsError } = await supabase
        .from("automation_runs")
        .select("*")
        .in("automation_id", ids)
        .order("created_at", { ascending: false })

      if (!runsError && runRows) {
        for (const r of runRows) {
          const aid = r.automation_id as string
          if (!latestRuns[aid]) {
            latestRuns[aid] = r as Record<string, unknown>
          }
        }
      }
    }

    return NextResponse.json({
      automations: automations.map((a) => ({
        ...a,
        latestRun: latestRuns[a.id as string] ?? null,
      })),
    })
  } catch (e) {
    console.error("[automations] GET:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

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

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const promptPayload = parsePromptPayloadFromRequestBody(body)
    const cronSchedule = typeof body.cronSchedule === "string" ? body.cronSchedule.trim() : ""
    const timezone = typeof body.timezone === "string" ? body.timezone.trim() || "UTC" : "UTC"
    const model =
      typeof body.model === "string" && body.model.trim().length > 0
        ? resolveChatGatewayModel(body.model.trim())
        : null
    const isActive = typeof body.isActive === "boolean" ? body.isActive : true

    if (!name || !promptPayload.text.trim() || !cronSchedule) {
      return NextResponse.json(
        { error: "name, prompt, and cronSchedule are required" },
        { status: 400 },
      )
    }

    const { prompt, prompt_payload } = automationPayloadToRowFields(promptPayload)

    try {
      validateCronExpression(cronSchedule, timezone)
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid cron expression" },
        { status: 400 },
      )
    }

    const nextRunAt = computeNextRun(cronSchedule, timezone, new Date())

    const { data: row, error } = await supabase
      .from("automations")
      .insert({
        user_id: user.id,
        name,
        prompt,
        prompt_payload,
        cron_schedule: cronSchedule,
        timezone,
        model,
        is_active: isActive,
        next_run_at: nextRunAt.toISOString(),
        run_count: 0,
      })
      .select("*")
      .single()

    if (error) {
      console.error("[automations] POST:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ automation: row })
  } catch (e) {
    console.error("[automations] POST exception:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
