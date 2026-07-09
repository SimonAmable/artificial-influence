import { NextResponse } from "next/server"

import { updateFanvueVaultFolderMedia } from "@/lib/fanvue/media"
import { getValidFanvueAccessToken } from "@/lib/fanvue/token-service"
import { requirePresenceProductResponse } from "@/lib/product/require-presence"
import { createClient } from "@/lib/supabase/server"

type RouteContext = {
  params: Promise<{ name: string; mediaUuid: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
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

    const { name, mediaUuid: rawMediaUuid } = await context.params
    const folderName = decodeURIComponent(name)
    const mediaUuid = decodeURIComponent(rawMediaUuid)
    const body = (await request.json()) as {
      connectionId?: string
      name?: string | null
      recommendedPrice?: number | null
    }
    const connectionId = body.connectionId?.trim() ?? ""

    if (!connectionId) {
      return NextResponse.json({ error: "connectionId is required." }, { status: 400 })
    }
    if (!("name" in body) && !("recommendedPrice" in body)) {
      return NextResponse.json(
        { error: "At least one of name or recommendedPrice is required." },
        { status: 400 }
      )
    }

    const token = await getValidFanvueAccessToken(supabase, {
      connectionId,
      userId: user.id,
    })

    await updateFanvueVaultFolderMedia(token.accessToken, folderName, mediaUuid, {
      ...("name" in body ? { name: body.name ?? null } : {}),
      ...("recommendedPrice" in body ? { recommendedPrice: body.recommendedPrice ?? null } : {}),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[fanvue/vault/folders/[name]/media/[mediaUuid]] PATCH exception:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update folder media." },
      { status: 500 }
    )
  }
}
