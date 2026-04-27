import { NextResponse } from "next/server"

import { decryptAutopostToken } from "@/lib/autopost/crypto"
import { revokeTikTokToken } from "@/lib/tiktok/oauth"
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

    const { data: row, error: rowError } = await supabase
      .from("social_connections")
      .select("id, access_token_encrypted, status")
      .eq("id", connectionId)
      .eq("user_id", user.id)
      .eq("provider", "tiktok")
      .maybeSingle()

    if (rowError) {
      console.error("[tiktok/disconnect] query failed:", rowError)
      return NextResponse.json({ error: "Failed to load TikTok connection." }, { status: 500 })
    }

    if (!row) {
      return NextResponse.json({ error: "TikTok connection not found." }, { status: 404 })
    }

    if (row.status === "connected" && row.access_token_encrypted) {
      try {
        const accessToken = decryptAutopostToken(row.access_token_encrypted)
        await revokeTikTokToken(accessToken)
      } catch (revokeError) {
        console.warn("[tiktok/disconnect] revoke failed; marking disconnected locally:", revokeError)
      }
    }

    const { error: updateError } = await supabase
      .from("social_connections")
      .update({
        status: "disconnected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId)
      .eq("user_id", user.id)
      .eq("provider", "tiktok")

    if (updateError) {
      console.error("[tiktok/disconnect] update failed:", updateError)
      return NextResponse.json({ error: "Failed to disconnect TikTok account." }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[tiktok/disconnect] POST exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
