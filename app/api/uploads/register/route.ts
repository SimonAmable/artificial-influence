import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedRequestContext } from "@/lib/server/request-auth"
import type { RegisterUploadRequest } from "@/lib/uploads/shared"
import { prepareDirectUpload } from "@/lib/uploads/server"

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, error: authError } = await getAuthenticatedRequestContext(request)

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as RegisterUploadRequest

    if (!body?.contentHash || !body?.fileName || !body?.mimeType || typeof body?.sizeBytes !== "number") {
      return NextResponse.json({ error: "Missing upload registration fields" }, { status: 400 })
    }

    const result = await prepareDirectUpload(body, { supabase, userId: user.id })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to prepare upload"
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Terms acceptance required"
          ? 403
          : 500
    return NextResponse.json({ error: message }, { status })
  }
}
