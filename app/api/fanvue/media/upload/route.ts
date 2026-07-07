import { NextResponse } from "next/server"

import { uploadFanvueMediaBuffer, upsertFanvueMediaCache } from "@/lib/fanvue/media"
import { getValidFanvueAccessToken } from "@/lib/fanvue/token-service"
import { requirePresenceProductResponse } from "@/lib/product/require-presence"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 300

export async function POST(request: Request) {
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

    const formData = await request.formData()
    const connectionId = String(formData.get("connectionId") ?? "").trim()
    const file = formData.get("file")

    if (!connectionId) {
      return NextResponse.json({ error: "connectionId is required." }, { status: 400 })
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required." }, { status: 400 })
    }

    const token = await getValidFanvueAccessToken(supabase, {
      connectionId,
      userId: user.id,
    })

    const buffer = Buffer.from(await file.arrayBuffer())
    const media = await uploadFanvueMediaBuffer({
      accessToken: token.accessToken,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer,
      displayName: file.name,
    })

    await upsertFanvueMediaCache(supabase, {
      userId: user.id,
      socialConnectionId: connectionId,
      media,
    })

    return NextResponse.json({ media })
  } catch (error) {
    console.error("[fanvue/media/upload] POST exception:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload media to Fanvue." },
      { status: 500 }
    )
  }
}
