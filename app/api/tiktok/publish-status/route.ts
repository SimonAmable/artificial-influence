import { NextResponse } from "next/server"

import { refreshTikTokAutopostJobStatus } from "@/lib/autopost/publish-job"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    let json: unknown
    try {
      json = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const jobId =
      json && typeof json === "object" && typeof (json as { jobId?: unknown }).jobId === "string"
        ? (json as { jobId: string }).jobId.trim()
        : ""

    if (!jobId) {
      return NextResponse.json({ error: "Expected jobId (string)." }, { status: 400 })
    }

    const result = await refreshTikTokAutopostJobStatus(supabase, jobId, { userId: user.id })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.statusCode })
    }

    return NextResponse.json({ ok: true, status: result.status, publishId: result.publishId })
  } catch (error) {
    console.error("[tiktok/publish-status] POST exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
