import { NextResponse } from "next/server"

import { publishAutopostJob } from "@/lib/autopost/publish-job"
import { assertAcceptedCurrentTerms } from "@/lib/legal/terms-acceptance"
import { createClient } from "@/lib/supabase/server"

/** Reels wait on Instagram container status; raise on Vercel Pro+ if publishes time out. */
export const maxDuration = 300

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

    const termsResponse = await assertAcceptedCurrentTerms(supabase, user.id)
    if (termsResponse) {
      return termsResponse
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

    const forceQueuedBeforeDue =
      typeof json === "object" &&
      json !== null &&
      (json as { publishNow?: unknown }).publishNow === true

    const result = await publishAutopostJob(supabase, jobId, {
      userId: user.id,
      forceQueuedBeforeDue,
    })

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        instagramMediaId: result.instagramMediaId,
        containerId: result.containerId,
      })
    }

    return NextResponse.json({ error: result.error }, { status: result.statusCode })
  } catch (error) {
    console.error("[autopost/publish] POST exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
