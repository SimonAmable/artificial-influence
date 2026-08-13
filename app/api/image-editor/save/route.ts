import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  authContextFailureResponse,
  requireSessionUser,
} from "@/lib/server/require-active-user"
import { saveImageEditorResult } from "@/lib/server/save-image-editor-result"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { user, error: authError } = await requireSessionUser(supabase)

    if (authError || !user) {
      return authContextFailureResponse(authError)
    }

    const contentType = request.headers.get("content-type") ?? ""
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Content-Type must be multipart/form-data." },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const imageFile = formData.get("image")

    if (!imageFile || !(imageFile instanceof File)) {
      return NextResponse.json(
        { error: 'Missing or invalid "image" file in FormData.' },
        { status: 400 }
      )
    }

    if (!imageFile.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Uploaded file must be an image." },
        { status: 400 }
      )
    }

    const sourceImageUrl =
      typeof formData.get("sourceImageUrl") === "string"
        ? formData.get("sourceImageUrl")
        : null
    const prompt =
      typeof formData.get("prompt") === "string" ? formData.get("prompt") : null

    const buffer = Buffer.from(await imageFile.arrayBuffer())
    const result = await saveImageEditorResult({
      supabase,
      userId: user.id,
      imageBuffer: buffer,
      mimeType: imageFile.type || "image/png",
      sourceImageUrl,
      prompt,
    })

    return NextResponse.json({
      url: result.url,
      generationId: result.generationId,
      storagePath: result.storagePath,
    })
  } catch (error) {
    console.error("[image-editor/save] Error:", error)
    const message =
      error instanceof Error ? error.message : "Failed to save edited image"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
