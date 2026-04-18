import { NextResponse } from "next/server"

import {
  automationPayloadToRowFields,
  parsePromptPayloadFromRequestBody,
} from "@/lib/automations/prompt-payload"
import { computeNextRun, validateCronExpression } from "@/lib/automations/schedule"
import { resolveChatGatewayModel } from "@/lib/constants/chat-llm-models"
import { createClient } from "@/lib/supabase/server"

function parseVisibilityParam(value: string | null): "mine" | "community" {
  if (value === "community") return "community"
  return "mine"
}

function hasPreviewSnapshot(previewThread: unknown): boolean {
  if (previewThread == null) return false
  if (Array.isArray(previewThread)) return previewThread.length > 0
  if (typeof previewThread === "object") return Object.keys(previewThread as object).length > 0
  return true
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const scope = parseVisibilityParam(new URL(req.url).searchParams.get("scope"))

    if (scope === "community") {
      const { data: rows, error } = await supabase
        .from("automations")
        .select("*")
        .eq("is_public", true)
        .neq("user_id", user.id)
        .order("updated_at", { ascending: false })

      if (error) {
        console.error("[automations] GET community:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const automations = (rows ?? []).map((raw) => {
        const a = raw as Record<string, unknown>
        const pt = a.preview_thread
        return {
          id: a.id,
          user_id: a.user_id,
          name: a.name,
          description: a.description ?? null,
          prompt: a.prompt,
          prompt_payload: a.prompt_payload,
          cron_schedule: a.cron_schedule,
          timezone: a.timezone,
          model: a.model,
          is_active: a.is_active,
          last_run_at: a.last_run_at,
          next_run_at: a.next_run_at,
          run_count: a.run_count,
          last_error: a.last_error,
          created_at: a.created_at,
          updated_at: a.updated_at,
          cloned_from: a.cloned_from,
          preview_captured_at: a.preview_captured_at,
          is_public: a.is_public,
          hasPreview: hasPreviewSnapshot(pt),
        }
      })

      return NextResponse.json({ automations, scope: "community" })
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
      automations: automations.map((a) => {
        const row = a as Record<string, unknown>
        return {
          ...row,
          hasPreview: hasPreviewSnapshot(row.preview_thread),
          latestRun: latestRuns[row.id as string] ?? null,
        }
      }),
      scope: "mine",
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
    const isPublic = body.isPublic === true
    const description =
      typeof body.description === "string" ? body.description.trim() || null : null

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
        description,
        prompt,
        prompt_payload,
        cron_schedule: cronSchedule,
        timezone,
        model,
        is_active: isActive,
        next_run_at: nextRunAt.toISOString(),
        run_count: 0,
        is_public: isPublic,
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
