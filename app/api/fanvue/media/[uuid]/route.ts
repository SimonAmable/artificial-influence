import { NextResponse } from "next/server"

import { getFanvueMedia, updateFanvueMedia, updateFanvueVaultFolderMedia } from "@/lib/fanvue/media"
import { getValidFanvueAccessToken } from "@/lib/fanvue/token-service"
import { requirePresenceProductResponse } from "@/lib/product/require-presence"
import { createClient } from "@/lib/supabase/server"

type RouteContext = {
  params: Promise<{ uuid: string }>
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

    const { uuid } = await context.params
    const mediaUuid = decodeURIComponent(uuid)
    const requestUrl = new URL(request.url)
    const connectionId = requestUrl.searchParams.get("connectionId")?.trim() ?? ""

    if (!connectionId) {
      return NextResponse.json({ error: "connectionId is required." }, { status: 400 })
    }

    const token = await getValidFanvueAccessToken(supabase, {
      connectionId,
      userId: user.id,
    })

    const media = await getFanvueMedia(token.accessToken, mediaUuid)
    if (!media) {
      return NextResponse.json({ error: "Media not found." }, { status: 404 })
    }

    return NextResponse.json({ media })
  } catch (error) {
    console.error("[fanvue/media/[uuid]] GET exception:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load Fanvue media." },
      { status: 500 }
    )
  }
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

    const { uuid } = await context.params
    const mediaUuid = decodeURIComponent(uuid)
    const body = (await request.json()) as {
      connectionId?: string
      name?: string | null
      caption?: string | null
      recommendedPrice?: number | null
      folderName?: string | null
    }
    const connectionId = body.connectionId?.trim() ?? ""
    const folderName = body.folderName?.trim() || null

    if (!connectionId) {
      return NextResponse.json({ error: "connectionId is required." }, { status: 400 })
    }
    if (!("name" in body) && !("caption" in body) && !("recommendedPrice" in body)) {
      return NextResponse.json(
        { error: "At least one of name, caption, or recommendedPrice is required." },
        { status: 400 }
      )
    }

    const token = await getValidFanvueAccessToken(supabase, {
      connectionId,
      userId: user.id,
    })

    let media: Awaited<ReturnType<typeof getFanvueMedia>> = null

    if ("name" in body || "caption" in body || !folderName) {
      media = await updateFanvueMedia(token.accessToken, mediaUuid, {
        ...("name" in body ? { name: body.name ?? null } : {}),
        ...("caption" in body ? { caption: body.caption ?? null } : {}),
        ...("recommendedPrice" in body && !folderName
          ? { recommendedPrice: body.recommendedPrice ?? null }
          : {}),
      })
    }

    if ("recommendedPrice" in body && folderName) {
      await updateFanvueVaultFolderMedia(token.accessToken, folderName, mediaUuid, {
        recommendedPrice: body.recommendedPrice ?? null,
      })
      media = await getFanvueMedia(token.accessToken, mediaUuid)
    }

    if (!media) {
      return NextResponse.json({ error: "Media not found." }, { status: 404 })
    }

    return NextResponse.json({ media })
  } catch (error) {
    console.error("[fanvue/media/[uuid]] PATCH exception:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update Fanvue media." },
      { status: 500 }
    )
  }
}
