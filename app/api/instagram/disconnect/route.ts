import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const { error } = await supabase.from("instagram_connections").delete().eq("user_id", user.id)

    if (error) {
      console.error("[instagram/disconnect] delete failed:", error)
      return NextResponse.json({ error: "Failed to disconnect Instagram account." }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[instagram/disconnect] POST exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
