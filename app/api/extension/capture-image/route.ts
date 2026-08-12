import { NextRequest, NextResponse } from "next/server"

import { getAuthenticatedRequestContext } from "@/lib/server/request-auth"
import { validateExternalReferenceUrl } from "@/lib/server/external-reference-url"
import { storeUploadedFileFromServer } from "@/lib/uploads/server"

const MAX_REFERENCE_SIZE_BYTES = 10 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, error: authError } = await getAuthenticatedRequestContext(request)

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as { imageUrl?: string }
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : ""

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 })
    }

    const safeUrl = await validateExternalReferenceUrl({
      url: imageUrl,
      expectedKind: "image",
      maxContentLengthBytes: MAX_REFERENCE_SIZE_BYTES,
    })

    const response = await fetch(safeUrl)
    if (!response.ok) {
      return NextResponse.json(
        { error: `Could not fetch image (HTTP ${response.status})` },
        { status: 400 },
      )
    }

    const bytes = await response.arrayBuffer()
    if (bytes.byteLength > MAX_REFERENCE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Reference image is too large. Maximum size is 10MB." },
        { status: 400 },
      )
    }

    const contentType = response.headers.get("content-type") || "image/jpeg"
    const extension = contentType.split("/")[1]?.split("+")[0] || "jpg"
    const fileName = `extension-capture-${Date.now()}.${extension}`

    const upload = await storeUploadedFileFromServer(
      {
        source: "extension-reference-images",
        fileName,
        mimeType: contentType,
        bytes,
      },
      { supabase, userId: user.id },
    )

    return NextResponse.json({ url: upload.url })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to capture image"
    const status = message === "Unauthorized" ? 401 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
