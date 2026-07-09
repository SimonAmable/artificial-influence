import { NextResponse } from "next/server"

import {
  addMediaToFanvueVaultFolder,
  uploadFanvueMediaBuffer,
  upsertFanvueMediaCache,
} from "@/lib/fanvue/media"
import { getValidFanvueAccessToken } from "@/lib/fanvue/token-service"
import { requirePresenceProductResponse } from "@/lib/product/require-presence"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 300

function inferFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const segment = pathname.split("/").filter(Boolean).pop()
    if (segment && /\.[a-z0-9]+$/i.test(segment)) {
      return segment
    }
  } catch {
    // Fall through to default filename.
  }
  return `presence-upload-${Date.now()}.png`
}

function inferMimeType(filename: string, contentType: string | null): string {
  if (contentType?.startsWith("image/") || contentType?.startsWith("video/")) {
    return contentType
  }
  const lower = filename.toLowerCase()
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".gif")) return "image/gif"
  if (lower.endsWith(".mp4")) return "video/mp4"
  if (lower.endsWith(".mov")) return "video/quicktime"
  return "image/png"
}

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

    const body = (await request.json()) as {
      connectionId?: string
      imageUrl?: string
      folderName?: string | null
      displayName?: string | null
    }

    const connectionId = body.connectionId?.trim() ?? ""
    const imageUrl = body.imageUrl?.trim() ?? ""
    const folderName = body.folderName?.trim() || null

    if (!connectionId) {
      return NextResponse.json({ error: "connectionId is required." }, { status: 400 })
    }
    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl is required." }, { status: 400 })
    }

    const token = await getValidFanvueAccessToken(supabase, {
      connectionId,
      userId: user.id,
    })

    const remoteResponse = await fetch(imageUrl)
    if (!remoteResponse.ok) {
      return NextResponse.json({ error: "Failed to download image for upload." }, { status: 400 })
    }

    const filename = inferFilenameFromUrl(imageUrl)
    const mimeType = inferMimeType(filename, remoteResponse.headers.get("content-type"))
    const buffer = Buffer.from(await remoteResponse.arrayBuffer())

    const media = await uploadFanvueMediaBuffer({
      accessToken: token.accessToken,
      filename,
      mimeType,
      buffer,
      displayName: body.displayName?.trim() || filename,
      creatorUserUuid: token.connection.provider_account_id,
    })

    if (folderName) {
      await addMediaToFanvueVaultFolder(token.accessToken, folderName, [media.uuid])
    }

    await upsertFanvueMediaCache(supabase, {
      userId: user.id,
      socialConnectionId: connectionId,
      media,
    })

    return NextResponse.json({ media })
  } catch (error) {
    console.error("[fanvue/media/upload-from-url] POST exception:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload media to Fanvue." },
      { status: 500 }
    )
  }
}
