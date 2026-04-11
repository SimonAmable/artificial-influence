import { NextResponse } from "next/server"

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

    const { data, error } = await supabase
      .from("instagram_connections")
      .select(
        "instagram_user_id, instagram_username, token_expires_at, updated_at, status, provider, metadata"
      )
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) {
      console.error("[instagram/status] query failed:", error)
      return NextResponse.json({ error: "Failed to fetch connection status." }, { status: 500 })
    }

    if (!data || data.status !== "connected") {
      return NextResponse.json({ connected: false })
    }

    return NextResponse.json({
      connected: true,
      connection: {
        instagramUserId: data.instagram_user_id,
        instagramUsername: data.instagram_username,
        accountType:
          data.metadata &&
          typeof data.metadata === "object" &&
          "account_type" in data.metadata &&
          typeof data.metadata.account_type === "string"
            ? data.metadata.account_type
            : null,
        provider: data.provider,
        tokenExpiresAt: data.token_expires_at,
        updatedAt: data.updated_at,
      },
    })
  } catch (error) {
    console.error("[instagram/status] GET exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
