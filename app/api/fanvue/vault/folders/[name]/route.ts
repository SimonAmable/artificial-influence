import { NextResponse } from "next/server"

import { deleteFanvueVaultFolder, renameFanvueVaultFolder } from "@/lib/fanvue/media"
import { getValidFanvueAccessToken } from "@/lib/fanvue/token-service"
import { requirePresenceProductResponse } from "@/lib/product/require-presence"
import { createClient } from "@/lib/supabase/server"

type RouteContext = {
  params: Promise<{ name: string }>
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

    const { name } = await context.params
    const folderName = decodeURIComponent(name)
    const body = (await request.json()) as { connectionId?: string; name?: string }
    const connectionId = body.connectionId?.trim() ?? ""
    const nextName = body.name?.trim() ?? ""

    if (!connectionId) {
      return NextResponse.json({ error: "connectionId is required." }, { status: 400 })
    }
    if (!nextName) {
      return NextResponse.json({ error: "name is required." }, { status: 400 })
    }

    const token = await getValidFanvueAccessToken(supabase, {
      connectionId,
      userId: user.id,
    })

    const folder = await renameFanvueVaultFolder(token.accessToken, folderName, nextName)
    return NextResponse.json({ folder })
  } catch (error) {
    console.error("[fanvue/vault/folders/[name]] PATCH exception:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to rename vault folder." },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request, context: RouteContext) {
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

    if (!connectionId) {
      return NextResponse.json({ error: "connectionId is required." }, { status: 400 })
    }

    const token = await getValidFanvueAccessToken(supabase, {
      connectionId,
      userId: user.id,
    })

    await deleteFanvueVaultFolder(token.accessToken, folderName)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[fanvue/vault/folders/[name]] DELETE exception:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete vault folder." },
      { status: 500 }
    )
  }
}
