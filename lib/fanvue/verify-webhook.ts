import crypto from "crypto"

const TOLERANCE_SECONDS = 300

export function verifyFanvueWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  signingSecret: string
): boolean {
  if (!signatureHeader?.trim() || !signingSecret.trim()) {
    return false
  }

  let timestamp: string | undefined
  let signature: string | undefined

  for (const part of signatureHeader.split(",")) {
    const [key, value] = part.split("=")
    if (key === "t") timestamp = value
    if (key === "v0") signature = value
  }

  if (!timestamp || !signature) return false

  const timestampSeconds = Number.parseInt(timestamp, 10)
  if (!Number.isFinite(timestampSeconds)) return false

  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestampSeconds) > TOLERANCE_SECONDS) {
    return false
  }

  const signedPayload = `${timestamp}.${rawBody}`
  const expected = crypto
    .createHmac("sha256", signingSecret)
    .update(signedPayload)
    .digest("hex")

  const received = Buffer.from(signature)
  const computed = Buffer.from(expected)
  return received.length === computed.length && crypto.timingSafeEqual(received, computed)
}
