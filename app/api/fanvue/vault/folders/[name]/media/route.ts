import { NextResponse } from "next/server"

import {
  addMediaToFanvueVaultFolder,
  loadHydratedFanvueMedia,
  removeMediaFromFanvueVaultFolder,
} from "@/lib/fanvue/media"
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

    const { items, nextCursor } = await loadHydratedFanvueMedia({
      supabase,
      accessToken: token.accessToken,
      userId: user.id,
      socialConnectionId: connectionId,
      folderName,
      cursor,
      limit: 50,
      singlePage: Boolean(cursor),
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

export async function POST(request: Request, context: RouteContext) {
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
    const body = (await request.json()) as { connectionId?: string; mediaUuids?: string[] }
    const connectionId = body.connectionId?.trim() ?? ""
    const mediaUuids = (body.mediaUuids ?? []).filter(Boolean)

    if (!connectionId) {
      return NextResponse.json({ error: "connectionId is required." }, { status: 400 })
    }
    if (mediaUuids.length === 0) {
      return NextResponse.json({ error: "mediaUuids is required." }, { status: 400 })
    }

    const token = await getValidFanvueAccessToken(supabase, {
      connectionId,
      userId: user.id,
    })

    await addMediaToFanvueVaultFolder(token.accessToken, folderName, mediaUuids)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[fanvue/vault/folders/[name]/media] POST exception:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add media to folder." },
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
    const mediaUuid = requestUrl.searchParams.get("mediaUuid")?.trim() ?? ""

    if (!connectionId) {
      return NextResponse.json({ error: "connectionId is required." }, { status: 400 })
    }
    if (!mediaUuid) {
      return NextResponse.json({ error: "mediaUuid is required." }, { status: 400 })
    }

    const token = await getValidFanvueAccessToken(supabase, {
      connectionId,
      userId: user.id,
    })

    await removeMediaFromFanvueVaultFolder(token.accessToken, folderName, mediaUuid)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[fanvue/vault/folders/[name]/media] DELETE exception:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove media from folder." },
      { status: 500 }
    )
  }
}
