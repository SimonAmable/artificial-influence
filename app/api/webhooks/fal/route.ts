import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { resolveFalWebhookFailureMessage } from "@/lib/server/fal-client-error"
import {
  completeFalPendingImageAdmin,
  markFalImageWebhookFailed,
} from "@/lib/server/fal-image-completion"
import {
  completeFalPendingVideoAdmin,
  markFalVideoWebhookFailed,
} from "@/lib/server/fal-video-completion"

export const maxDuration = 300

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

type FalWebhookBody = {
  error?: string
  payload?: unknown
  request_id?: string
  status?: "OK" | "ERROR"
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FalWebhookBody
    const predictionId = body.request_id?.trim()

    if (!predictionId) {
      return NextResponse.json({ error: "Missing request_id" }, { status: 400 })
    }

    const { data: generation } = await supabaseAdmin
      .from("generations")
      .select("id, type, status, fal_endpoint_id")
      .eq("replicate_prediction_id", predictionId)
      .maybeSingle()

    if (!generation) {
      console.warn("[webhooks/fal] No generation for request:", predictionId)
      return NextResponse.json({ received: true })
    }

    if (generation.status !== "pending") {
      return NextResponse.json({ received: true })
    }

    if (body.status === "ERROR") {
      const webhookMessage = body.error?.trim() || "Fal generation failed"
      const falEndpointId =
        typeof generation.fal_endpoint_id === "string" && generation.fal_endpoint_id.length > 0
          ? generation.fal_endpoint_id
          : null
      const message =
        falEndpointId != null
          ? await resolveFalWebhookFailureMessage(falEndpointId, predictionId, webhookMessage)
          : webhookMessage
      if (generation.type === "video") {
        await markFalVideoWebhookFailed(predictionId, message)
      } else {
        await markFalImageWebhookFailed(predictionId, message)
      }
      return NextResponse.json({ received: true })
    }

    if (generation.type === "video") {
      await completeFalPendingVideoAdmin(predictionId, { fromWebhook: true })
    } else {
      await completeFalPendingImageAdmin(predictionId, { fromWebhook: true })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("[webhooks/fal] Error:", error)
    return NextResponse.json({ received: true })
  }
}
