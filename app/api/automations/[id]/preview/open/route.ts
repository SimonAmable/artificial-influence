import { NextResponse } from "next/server"

import type { AutomationRow } from "@/lib/automations/types"
import { createClient } from "@/lib/supabase/server"
import type { UIMessage } from "ai"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_req: Request, context: RouteContext) {
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
    if (a.is_public !== true) {
      return NextResponse.json({ error: "Preview is only available for public automations" }, { status: 403 })
    }

    if (a.preview_thread == null) {
      return NextResponse.json({ error: "No preview available yet" }, { status: 404 })
    }

    const messages = a.preview_thread as UIMessage[]
    const title = `${a.name} — community preview`

    const { data: threadRow, error: insErr } = await supabase
      .from("chat_threads")
      .insert({
        user_id: user.id,
        title,
        messages,
        source: "automation",
        automation_id: a.id,
        automation_trigger: null,
      })
      .select("id")
      .single()

    if (insErr || !threadRow?.id) {
      console.error("[automations/preview/open] insert:", insErr)
      return NextResponse.json({ error: insErr?.message ?? "Failed to create thread" }, { status: 500 })
    }

    return NextResponse.json({ threadId: threadRow.id as string })
  } catch (e) {
    console.error("[automations/preview/open] exception:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
