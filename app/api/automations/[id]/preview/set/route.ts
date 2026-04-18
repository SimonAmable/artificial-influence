import { NextResponse } from "next/server"
import type { UIMessage } from "ai"

import { setAutomationPreviewRun } from "@/lib/automations/preview"
import type { AutomationRow, AutomationRunRow } from "@/lib/automations/types"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const runId = typeof body?.runId === "string" ? body.runId.trim() : ""
    if (!runId) {
      return NextResponse.json({ error: "runId is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: automationRow, error: automationError } = await supabase
      .from("automations")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (automationError || !automationRow) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 })
    }

    const automation = automationRow as AutomationRow
    if (automation.is_public !== true) {
      return NextResponse.json(
        { error: "Automation must be public to set a preview" },
        { status: 400 },
      )
    }

    const { data: runRow, error: runError } = await supabase
      .from("automation_runs")
      .select("*")
      .eq("id", runId)
      .eq("automation_id", automation.id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (runError || !runRow) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 })
    }

    const run = runRow as AutomationRunRow
    if (run.status !== "completed") {
      return NextResponse.json(
        { error: "Only completed runs can be used as a preview" },
        { status: 400 },
      )
    }
    if (!run.thread_id) {
      return NextResponse.json(
        { error: "This run has no associated chat thread" },
        { status: 400 },
      )
    }

    const { data: threadRow, error: threadError } = await supabase
      .from("chat_threads")
      .select("messages")
      .eq("id", run.thread_id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (threadError || !threadRow) {
      return NextResponse.json({ error: "Run thread not found" }, { status: 404 })
    }

    const messages = (threadRow.messages ?? []) as UIMessage[]
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Run thread is empty — nothing to preview" },
        { status: 400 },
      )
    }

    const result = await setAutomationPreviewRun(supabase, automation.id, run.id, messages)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ ok: true, previewRunId: run.id })
  } catch (e) {
    console.error("[automations/preview/set] exception:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
