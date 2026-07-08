import { createHmac, timingSafeEqual } from "crypto"

import { parseSocialOAuthReturnPath } from "@/lib/social/oauth-return"

const STATE_TTL_MS = 10 * 60 * 1000

export type FanvueOAuthStatePayload = {
  verifier: string
  userId: string
  returnPath: "/content" | "/autopost" | "/onboarding"
  exp: number
}

function getStateSecret(): string | null {
  return process.env.FANVUE_OAUTH_CLIENT_SECRET?.trim() || null
}

export function createFanvueOAuthState(payload: {
  verifier: string
  userId: string
  returnPath: FanvueOAuthStatePayload["returnPath"]
}): string | null {
  const secret = getStateSecret()
  if (!secret) return null

  const full: FanvueOAuthStatePayload = {
    ...payload,
    exp: Date.now() + STATE_TTL_MS,
  }
  const body = Buffer.from(JSON.stringify(full)).toString("base64url")
  const signature = createHmac("sha256", secret).update(body).digest("base64url")
  return `${body}.${signature}`
}

export function verifyFanvueOAuthState(state: string): FanvueOAuthStatePayload | null {
  const secret = getStateSecret()
  if (!secret) return null

  const separator = state.lastIndexOf(".")
  if (separator <= 0) return null

  const body = state.slice(0, separator)
  const signature = state.slice(separator + 1)
  const expected = createHmac("sha256", secret).update(body).digest("base64url")

  try {
    const sigBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expected)
    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null
    }
  } catch {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as FanvueOAuthStatePayload
    if (typeof payload.verifier !== "string" || !payload.verifier) return null
    if (typeof payload.userId !== "string" || !payload.userId) return null
    if (!parseSocialOAuthReturnPath(payload.returnPath)) return null
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}
