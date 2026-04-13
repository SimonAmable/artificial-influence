import { NextResponse } from "next/server"

import { parseSavedProfileFromMetadata } from "@/lib/instagram/profile"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const { data: rows, error } = await supabase
      .from("instagram_connections")
      .select(
        "id, instagram_user_id, instagram_username, token_expires_at, updated_at, status, provider, metadata"
      )
      .eq("user_id", user.id)
      .eq("status", "connected")
      .order("updated_at", { ascending: false })

    if (error) {
      console.error("[instagram/status] query failed:", error)
      return NextResponse.json({ error: "Failed to fetch connection status." }, { status: 500 })
    }

    const connections = (rows ?? []).map((data) => ({
      id: data.id,
      instagramUserId: data.instagram_user_id,
      instagramUsername: data.instagram_username,
      accountType:
        data.metadata &&
        typeof data.metadata === "object" &&
        "account_type" in data.metadata &&
        typeof data.metadata.account_type === "string"
          ? data.metadata.account_type
          : null,
      profile: parseSavedProfileFromMetadata(data.metadata),
      provider: data.provider,
      tokenExpiresAt: data.token_expires_at,
      profileFetchedAt: parseSavedProfileFromMetadata(data.metadata)?.fetched_at ?? null,
      updatedAt: data.updated_at,
    }))

    return NextResponse.json({
      connected: connections.length > 0,
      connections,
    })
  } catch (error) {
    console.error("[instagram/status] GET exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
