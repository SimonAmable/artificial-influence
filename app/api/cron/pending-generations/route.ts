import { NextResponse } from "next/server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { completeFalPendingImageAdmin } from "@/lib/server/fal-image-completion"
import { completeFalPendingVideoAdmin } from "@/lib/server/fal-video-completion"

export const maxDuration = 300

const BATCH_SIZE = 15
const MIN_AGE_MS = 2 * 60 * 1000

function verifyCronAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return false
  }
  const auth = request.headers.get("authorization")
  return auth === `Bearer ${secret}`
}

/**
 * Fallback sweeper for Fal jobs when webhooks are delayed or misconfigured.
 * Runs infrequently — completion should happen via /api/webhooks/fal.
 */
export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  if (!supabase) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 })
  }

  const cutoff = new Date(Date.now() - MIN_AGE_MS).toISOString()
  const { data: pendingRows, error } = await supabase
    .from("generations")
    .select("replicate_prediction_id, type")
    .eq("status", "pending")
    .not("fal_endpoint_id", "is", null)
    .not("replicate_prediction_id", "is", null)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE)

  if (error) {
    console.error("[cron/pending-generations] select failed:", error)
    return NextResponse.json({ error: "Failed to load pending generations." }, { status: 500 })
  }

  let completed = 0
  let failed = 0
  let stillPending = 0

  for (const row of pendingRows ?? []) {
    const predictionId = row.replicate_prediction_id as string
    const result =
      row.type === "video"
        ? await completeFalPendingVideoAdmin(predictionId)
        : await completeFalPendingImageAdmin(predictionId)

    if (result.status === "completed") {
      completed += 1
    } else if (result.status === "failed") {
      failed += 1
    } else {
      stillPending += 1
    }
  }

  return NextResponse.json({
    processed: (pendingRows ?? []).length,
    completed,
    failed,
    stillPending,
  })
}
