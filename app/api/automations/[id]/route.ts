import { NextResponse } from "next/server"

import {
  automationPayloadToRowFields,
  normalizeAutomationPromptPayload,
  parsePromptPayloadFromRequestBody,
} from "@/lib/automations/prompt-payload"
import { computeNextRun, validateCronExpression } from "@/lib/automations/schedule"
import type { AutomationRow } from "@/lib/automations/types"
import { resolveChatGatewayModel } from "@/lib/constants/chat-llm-models"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    const { data: existing, error: fetchError } = await supabase
      .from("automations")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 })
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (typeof body?.name === "string") {
      const name = body.name.trim()
      if (!name) {
        return NextResponse.json({ error: "name cannot be empty" }, { status: 400 })
      }
      updates.name = name
    }

    if (body.promptPayload !== undefined || typeof body.prompt === "string") {
      const existingPayload = normalizeAutomationPromptPayload(
        (existing as AutomationRow).prompt,
        (existing as AutomationRow).prompt_payload,
      )
      const next =
        body.promptPayload !== undefined
          ? parsePromptPayloadFromRequestBody(body)
          : { ...existingPayload, text: String(body.prompt ?? "").trim() }
      if (!next.text.trim()) {
        return NextResponse.json({ error: "prompt cannot be empty" }, { status: 400 })
      }
      const { prompt, prompt_payload } = automationPayloadToRowFields(next)
      updates.prompt = prompt
      updates.prompt_payload = prompt_payload
    }

    let cronSchedule = (existing as AutomationRow).cron_schedule
    let timezone = (existing as AutomationRow).timezone

    if (typeof body?.cronSchedule === "string") {
      cronSchedule = body.cronSchedule.trim()
      updates.cron_schedule = cronSchedule
    }

    if (typeof body?.timezone === "string") {
      timezone = body.timezone.trim() || "UTC"
      updates.timezone = timezone
    }

    if (body?.cronSchedule !== undefined || body?.timezone !== undefined) {
      try {
        validateCronExpression(cronSchedule, timezone)
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Invalid cron expression" },
          { status: 400 },
        )
      }
      updates.next_run_at = computeNextRun(cronSchedule, timezone, new Date()).toISOString()
    }

    if (body?.model !== undefined) {
      if (body.model === null || body.model === "") {
        updates.model = null
      } else if (typeof body.model === "string") {
        updates.model = resolveChatGatewayModel(body.model.trim())
      }
    }

    if (typeof body?.isActive === "boolean") {
      updates.is_active = body.isActive
    }

    const { data: row, error } = await supabase
      .from("automations")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single()

    if (error) {
      console.error("[automations] PATCH:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ automation: row })
  } catch (e) {
    console.error("[automations] PATCH exception:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { error } = await supabase.from("automations").delete().eq("id", id).eq("user_id", user.id)

    if (error) {
      console.error("[automations] DELETE:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[automations] DELETE exception:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
