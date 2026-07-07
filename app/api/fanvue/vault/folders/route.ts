import { NextResponse } from "next/server"

import { listFanvueVaultFolders } from "@/lib/fanvue/media"
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
    if (!connectionId) {
      return NextResponse.json({ error: "connectionId is required." }, { status: 400 })
    }

    const token = await getValidFanvueAccessToken(supabase, {
      connectionId,
      userId: user.id,
    })

    const folders = await listFanvueVaultFolders(token.accessToken)
    return NextResponse.json({ folders })
  } catch (error) {
    console.error("[fanvue/vault/folders] GET exception:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load Fanvue vault folders." },
      { status: 500 }
    )
  }
}
