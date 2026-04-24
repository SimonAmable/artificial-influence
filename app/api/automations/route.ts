import { NextResponse } from "next/server"

import {
  parsePromptPayloadFromRequestBody,
} from "@/lib/automations/prompt-payload"
import {
  createAutomationForUser,
  isAutomationServiceError,
  listOwnedAutomations,
} from "@/lib/automations/service"
import { assertAcceptedCurrentTerms } from "@/lib/legal/terms-acceptance"
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

    const automations = await listOwnedAutomations(supabase, user.id)
    return NextResponse.json({
      automations,
      scope: "mine",
    })
  } catch (e) {
    console.error("[automations] GET:", e)
    if (isAutomationServiceError(e)) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
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

    const termsResponse = await assertAcceptedCurrentTerms(supabase, user.id)
    if (termsResponse) {
      return termsResponse
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const promptPayload = parsePromptPayloadFromRequestBody(body)
    const cronSchedule = typeof body.cronSchedule === "string" ? body.cronSchedule.trim() : ""
    const timezone = typeof body.timezone === "string" ? body.timezone.trim() || "UTC" : "UTC"
    const isActive = typeof body.isActive === "boolean" ? body.isActive : true
    const description =
      typeof body.description === "string" ? body.description.trim() || null : null

    if (!name || !promptPayload.text.trim() || !cronSchedule) {
      return NextResponse.json(
        { error: "name, prompt, and cronSchedule are required" },
        { status: 400 },
      )
    }

    const row = await createAutomationForUser(supabase, user.id, {
      name,
      description,
      promptPayload,
      cronScheduleOrNaturalLanguage: cronSchedule,
      timezone,
      model: typeof body.model === "string" ? body.model : null,
      isActive,
    })

    if (body.isPublic === true) {
      const { data: updatedRow, error: updateError } = await supabase
        .from("automations")
        .update({ is_public: true })
        .eq("id", row.id)
        .eq("user_id", user.id)
        .select("*")
        .single()

      if (updateError) {
        console.error("[automations] POST visibility update:", updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({ automation: updatedRow })
    }

    return NextResponse.json({ automation: row })
  } catch (e) {
    console.error("[automations] POST exception:", e)
    if (isAutomationServiceError(e)) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
