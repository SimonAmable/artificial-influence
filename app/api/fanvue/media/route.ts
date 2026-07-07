import { NextResponse } from "next/server"

import { listFanvueMedia } from "@/lib/fanvue/media"
import { getValidFanvueAccessToken } from "@/lib/fanvue/token-service"
import { requirePresenceProductResponse } from "@/lib/product/require-presence"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
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

    const requestUrl = new URL(request.url)
    const connectionId = requestUrl.searchParams.get("connectionId")?.trim() ?? ""
    const cursor = requestUrl.searchParams.get("cursor")?.trim() || undefined
    const query = requestUrl.searchParams.get("q")?.trim().toLowerCase() ?? ""
    const mediaType = requestUrl.searchParams.get("mediaType")?.trim() || undefined

    if (!connectionId) {
      return NextResponse.json({ error: "connectionId is required." }, { status: 400 })
    }

    const token = await getValidFanvueAccessToken(supabase, {
      connectionId,
      userId: user.id,
    })

    const { items, nextCursor } = await listFanvueMedia(token.accessToken, { cursor, limit: 50 })

    const filtered = items.filter((item) => {
      if (mediaType && item.mediaType !== mediaType) return false
      if (!query) return true
      const haystack = `${item.name ?? ""} ${item.filename ?? ""}`.toLowerCase()
      return haystack.includes(query)
    })

    return NextResponse.json({ items: filtered, nextCursor })
  } catch (error) {
    console.error("[fanvue/media] GET exception:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load Fanvue media." },
      { status: 500 }
    )
  }
}
