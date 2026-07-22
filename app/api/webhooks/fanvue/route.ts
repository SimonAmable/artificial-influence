import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"

import {
  handleFanvuePaymentSucceeded,
  handleFanvueSubscriptionActivated,
  handleFanvueSubscriptionCancelChanged,
  recordFanvueWebhookEvent,
} from "@/lib/fanvue/billing-service"
import { verifyFanvueWebhookSignature } from "@/lib/fanvue/verify-webhook"

export const runtime = "nodejs"

async function readRawBody(request: NextRequest): Promise<string> {
  const buffer = await request.arrayBuffer()
  return Buffer.from(buffer).toString("utf8")
}

export async function POST(request: NextRequest) {
  const signingSecret = process.env.FANVUE_WEBHOOK_SECRET?.trim()
  if (!signingSecret) {
    console.error("[fanvue/webhook] FANVUE_WEBHOOK_SECRET is not configured")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 })
  }

  const rawBody = await readRawBody(request)
  const signature = (await headers()).get("x-fanvue-signature")

  if (!verifyFanvueWebhookSignature(rawBody, signature, signingSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let envelope: {
    id?: string
    type?: string
    data?: { object?: unknown }
  }

  try {
    envelope = JSON.parse(rawBody) as typeof envelope
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const eventId = envelope.id
  const eventType = envelope.type
  if (!eventId || !eventType) {
    return NextResponse.json({ error: "Missing event id or type" }, { status: 400 })
  }

  const isNew = await recordFanvueWebhookEvent(eventId, eventType)
  if (!isNew) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    const payload = envelope.data as { object?: string } | undefined
    const resource = payload as Record<string, unknown> | undefined

    switch (eventType) {
      case "app.subscription.activated":
        await handleFanvueSubscriptionActivated(resource as never)
        break
      case "app.subscription.cancel_at_period_end_changed":
        await handleFanvueSubscriptionCancelChanged(resource as never)
        break
      case "app.payment.succeeded":
        await handleFanvuePaymentSucceeded(resource as never)
        break
      default:
        console.log("[fanvue/webhook] ignored event", eventType)
    }
  } catch (error) {
    console.error("[fanvue/webhook] handler failed:", error)
    return NextResponse.json({ error: "Handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
