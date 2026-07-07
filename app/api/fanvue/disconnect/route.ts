import { NextResponse } from "next/server"

import { requirePresenceProductResponse } from "@/lib/product/require-presence"
import { markFanvueSocialConnectionDisconnected } from "@/lib/social-connections"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const blocked = requirePresenceProductResponse()
  if (blocked) return blocked

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    let json: unknown
    try {
      json = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const connectionId =
      json && typeof json === "object" && typeof (json as { connectionId?: unknown }).connectionId === "string"
        ? (json as { connectionId: string }).connectionId.trim()
        : ""

    if (!connectionId) {
      return NextResponse.json({ error: "connectionId is required." }, { status: 400 })
    }

    const { error } = await markFanvueSocialConnectionDisconnected(supabase, {
      userId: user.id,
      connectionId,
    })

    if (error) {
      console.error("[fanvue/disconnect] update failed:", error)
      return NextResponse.json({ error: "Failed to disconnect Fanvue." }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[fanvue/disconnect] POST exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
