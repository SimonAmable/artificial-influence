import { NextResponse } from "next/server"

import type { AutomationRow } from "@/lib/automations/types"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: Request, context: RouteContext) {
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

    const { data: row, error } = await supabase.from("automations").select("*").eq("id", id).maybeSingle()

    if (error || !row) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 })
    }

    const a = row as AutomationRow
    const allowed = a.user_id === user.id || a.is_public === true
    if (!allowed) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 })
    }

    if (a.preview_thread == null) {
      return NextResponse.json({ error: "No preview available yet" }, { status: 404 })
    }

    return NextResponse.json({
      name: a.name,
      messages: a.preview_thread,
      capturedAt: a.preview_captured_at,
    })
  } catch (e) {
    console.error("[automations/preview] GET:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
