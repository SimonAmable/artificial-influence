import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

function parseConnectionId(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null
  }
  const id = (body as { connectionId?: unknown }).connectionId
  return typeof id === "string" && id.trim().length > 0 ? id.trim() : null
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    let json: unknown
    try {
      json = await request.json()
    } catch {
      return NextResponse.json({ error: "Expected JSON body with connectionId." }, { status: 400 })
    }

    const connectionId = parseConnectionId(json)
    if (!connectionId) {
      return NextResponse.json({ error: "Expected connectionId (string)." }, { status: 400 })
    }

    const { error } = await supabase
      .from("instagram_connections")
      .delete()
      .eq("id", connectionId)
      .eq("user_id", user.id)

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
