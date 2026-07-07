import { NextResponse } from "next/server"

import { listFanvueVaultFolderMedia } from "@/lib/fanvue/media"
import { getValidFanvueAccessToken } from "@/lib/fanvue/token-service"
import { requirePresenceProductResponse } from "@/lib/product/require-presence"
import { createClient } from "@/lib/supabase/server"

type RouteContext = {
  params: Promise<{ name: string }>
}

export async function GET(request: Request, context: RouteContext) {
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

    const { name } = await context.params
    const folderName = decodeURIComponent(name)
    const requestUrl = new URL(request.url)
    const connectionId = requestUrl.searchParams.get("connectionId")?.trim() ?? ""
    const cursor = requestUrl.searchParams.get("cursor")?.trim() || undefined

    if (!connectionId) {
      return NextResponse.json({ error: "connectionId is required." }, { status: 400 })
    }

    const token = await getValidFanvueAccessToken(supabase, {
      connectionId,
      userId: user.id,
    })

    const { items, nextCursor } = await listFanvueVaultFolderMedia(token.accessToken, folderName, {
      cursor,
      limit: 50,
    })

    return NextResponse.json({ items, nextCursor, folderName })
  } catch (error) {
    console.error("[fanvue/vault/folders/[name]/media] GET exception:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load folder media." },
      { status: 500 }
    )
  }
}
