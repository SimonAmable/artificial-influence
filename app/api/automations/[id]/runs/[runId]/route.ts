import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string; runId: string }> }

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { id, runId } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: automation, error: aErr } = await supabase
      .from("automations")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (aErr || !automation) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 })
    }

    const { data: run, error } = await supabase
      .from("automation_runs")
      .select("*")
      .eq("id", runId)
      .eq("automation_id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) {
      console.error("[automations/runs/:runId] GET:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 })
    }

    return NextResponse.json({ run })
  } catch (e) {
    console.error("[automations/runs/:runId] GET exception:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
