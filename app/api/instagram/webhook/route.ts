import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Meta webhook subscription verification (GET) and event delivery (POST).
 * Callback URL in the Meta dashboard must be this route, not /api/instagram/callback (OAuth).
 * Set INSTAGRAM_WEBHOOK_VERIFY_TOKEN to the same string as "Verify token" in the dashboard.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get("hub.mode")
  const token = url.searchParams.get("hub.verify_token")
  const challenge = url.searchParams.get("hub.challenge")

  const expected = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN
  if (!expected) {
    console.error("[instagram/webhook] INSTAGRAM_WEBHOOK_VERIFY_TOKEN is not set")
    return new NextResponse("Webhook verify token not configured.", { status: 503 })
  }

  if (mode === "subscribe" && token === expected && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }

  return new NextResponse("Forbidden", { status: 403 })
}

export async function POST(request: Request) {
  // Acknowledge delivery; process payloads when you subscribe to fields.
  try {
    const raw = await request.text()
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      console.log("[instagram/webhook] event:", JSON.stringify(parsed).slice(0, 500))
    }
  } catch {
    // Non-JSON or empty body is fine
  }

  return NextResponse.json({ received: true })
}
