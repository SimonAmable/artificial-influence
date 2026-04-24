import { NextResponse } from "next/server"

import {
  parsePromptPayloadFromRequestBody,
} from "@/lib/automations/prompt-payload"
import {
  deleteAutomationForUser,
  isAutomationServiceError,
  updateAutomationForUser,
} from "@/lib/automations/service"
import { assertAcceptedCurrentTerms } from "@/lib/legal/terms-acceptance"
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

    const termsResponse = await assertAcceptedCurrentTerms(supabase, user.id)
    if (termsResponse) {
      return termsResponse
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    const row = await updateAutomationForUser(supabase, user.id, id, {
      ...(typeof body?.name === "string" ? { name: body.name } : {}),
      ...(body.promptPayload !== undefined || typeof body.prompt === "string"
        ? {
            promptPayload:
              body.promptPayload !== undefined
                ? parsePromptPayloadFromRequestBody(body)
                : parsePromptPayloadFromRequestBody({ prompt: body.prompt }),
          }
        : {}),
      ...(typeof body?.cronSchedule === "string"
        ? { cronScheduleOrNaturalLanguage: body.cronSchedule }
        : {}),
      ...(body?.timezone !== undefined ? { timezone: String(body.timezone ?? "") } : {}),
      ...(body?.model !== undefined ? { model: body.model as string | null } : {}),
      ...(typeof body?.isActive === "boolean" ? { isActive: body.isActive } : {}),
      ...(body.description !== undefined ? { description: body.description as string | null } : {}),
    })

    if (typeof body?.isPublic === "boolean") {
      const visibilityUpdates: Record<string, unknown> = {
        is_public: body.isPublic,
      }
      if (body.isPublic === false) {
        visibilityUpdates.preview_thread = null
        visibilityUpdates.preview_captured_at = null
      }
      const { data: updatedRow, error: visibilityError } = await supabase
        .from("automations")
        .update(visibilityUpdates)
        .eq("id", id)
        .eq("user_id", user.id)
        .select("*")
        .single()

      if (visibilityError) {
        console.error("[automations] PATCH visibility:", visibilityError)
        return NextResponse.json({ error: visibilityError.message }, { status: 500 })
      }

      return NextResponse.json({ automation: updatedRow })
    }

    return NextResponse.json({ automation: row })
  } catch (e) {
    console.error("[automations] PATCH exception:", e)
    if (isAutomationServiceError(e)) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
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

    const termsResponse = await assertAcceptedCurrentTerms(supabase, user.id)
    if (termsResponse) {
      return termsResponse
    }

    await deleteAutomationForUser(supabase, user.id, id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[automations] DELETE exception:", e)
    if (isAutomationServiceError(e)) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
