import { NextResponse } from "next/server"

import { runAutomation } from "@/lib/automations/run"
import type { AutomationRow } from "@/lib/automations/types"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export const maxDuration = 300

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_req: Request, context: RouteContext) {
  try {
    if (!process.env.AI_GATEWAY_API_KEY) {
      return NextResponse.json({ error: "AI gateway not configured" }, { status: 500 })
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

    const { data: row, error: fetchError } = await supabase
      .from("automations")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (fetchError || !row) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 })
    }

    const admin = createServiceRoleClient()
    if (!admin) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const result = await runAutomation(admin, row as AutomationRow)

    if (!result.ok) {
      return NextResponse.json({ error: result.error, runId: result.runId }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      threadId: result.threadId,
      runId: result.runId,
    })
  } catch (e) {
    console.error("[automations/run] POST:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
