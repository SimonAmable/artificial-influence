import { NextRequest, NextResponse } from "next/server"
import type { FinalizeUploadRequest } from "@/lib/uploads/shared"
import { finalizeUploadedObject } from "@/lib/uploads/server"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FinalizeUploadRequest

    if (
      !body?.contentHash ||
      !body?.storagePath ||
      !body?.fileName ||
      !body?.mimeType ||
      typeof body?.sizeBytes !== "number"
    ) {
      return NextResponse.json({ error: "Missing upload finalization fields" }, { status: 400 })
    }

    const upload = await finalizeUploadedObject(body)
    return NextResponse.json({ upload })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to finalize upload"
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Terms acceptance required"
          ? 403
          : 500
    return NextResponse.json({ error: message }, { status })
  }
}
