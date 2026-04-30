import { NextResponse } from "next/server"

import { isAutomationServiceError, runAutomationNowForUser } from "@/lib/automations/service"
import { AI_GATEWAY_CONFIG_ERROR, hasAIGatewayCredentials } from "@/lib/ai/gateway"
import { assertAcceptedCurrentTerms } from "@/lib/legal/terms-acceptance"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 300

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_req: Request, context: RouteContext) {
  try {
    if (!hasAIGatewayCredentials()) {
      return NextResponse.json({ error: AI_GATEWAY_CONFIG_ERROR }, { status: 500 })
    }

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

    const result = await runAutomationNowForUser(supabase, user.id, id)

    return NextResponse.json({
      ok: true,
      threadId: result.threadId,
      runId: result.runId,
    })
  } catch (e) {
    console.error("[automations/run] POST:", e)
    if (isAutomationServiceError(e)) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
