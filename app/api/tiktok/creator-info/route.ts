import { NextResponse } from "next/server"

import { queryTikTokCreatorInfo } from "@/lib/tiktok/publish"
import { getValidTikTokAccessToken } from "@/lib/tiktok/token-service"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url)
    const connectionId = requestUrl.searchParams.get("connectionId")?.trim()

    if (!connectionId) {
      return NextResponse.json({ error: "Expected connectionId." }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const token = await getValidTikTokAccessToken(supabase, {
      connectionId,
      userId: user.id,
    })

    if (!token.scopes.includes("video.publish")) {
      return NextResponse.json(
        { error: "Reconnect TikTok and approve Direct Post permissions." },
        { status: 400 }
      )
    }

    const creatorInfo = await queryTikTokCreatorInfo(token.accessToken)
    return NextResponse.json({ creatorInfo })
  } catch (error) {
    console.error("[tiktok/creator-info] GET exception:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load TikTok creator info." },
      { status: 500 }
    )
  }
}
