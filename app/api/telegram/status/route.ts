import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("telegram_chat_id")
      .eq("id", user.id)
      .maybeSingle()

    if (error) {
      console.error("[telegram/status] profile read failed:", error)
      return NextResponse.json({ error: "Failed to load Telegram status." }, { status: 500 })
    }

    return NextResponse.json({
      connected: typeof profile?.telegram_chat_id === "number",
    })
  } catch (error) {
    console.error("[telegram/status] GET exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 })
    }

    const serviceRole = createServiceRoleClient()
    if (!serviceRole) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 })
    }

    const { error } = await serviceRole
      .from("profiles")
      .update({ telegram_chat_id: null })
      .eq("id", user.id)

    if (error) {
      console.error("[telegram/status] disconnect failed:", error)
      return NextResponse.json({ error: "Failed to disconnect Telegram." }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[telegram/status] POST exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
