import { createHash, randomBytes } from "crypto"

import { FANVUE_AUTH_BASE_URL, FANVUE_OAUTH_SCOPES } from "@/lib/fanvue/config"

export const FANVUE_OAUTH_STATE_COOKIE = "fanvue_oauth_state"
export const FANVUE_OAUTH_VERIFIER_COOKIE = "fanvue_oauth_verifier"

export type FanvueTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  refresh_expires_in?: number
  token_type?: string
  scope?: string
  id_token?: string
}

function base64Url(buffer: Buffer): string {
  return buffer.toString("base64url")
}

export function generateFanvuePkcePair() {
  const verifier = base64Url(randomBytes(32))
  const challenge = base64Url(createHash("sha256").update(verifier).digest())
  return { verifier, challenge }
}

export function buildFanvueAuthorizeUrl(params: {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
}): string {
  const search = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: FANVUE_OAUTH_SCOPES,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
  })

  return `${FANVUE_AUTH_BASE_URL}/oauth2/auth?${search.toString()}`
}

export async function exchangeFanvueCodeForToken(params: {
  code: string
  redirectUri: string
  codeVerifier: string
}): Promise<FanvueTokenResponse> {
  const clientId = process.env.FANVUE_OAUTH_CLIENT_ID?.trim()
  const clientSecret = process.env.FANVUE_OAUTH_CLIENT_SECRET?.trim()

  if (!clientId || !clientSecret) {
    throw new Error("Fanvue OAuth is not configured.")
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: params.codeVerifier,
  })

  const response = await fetch(`${FANVUE_AUTH_BASE_URL}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })

  const json = (await response.json()) as FanvueTokenResponse & { error?: string; error_description?: string }

  if (!response.ok) {
    throw new Error(json.error_description || json.error || "Fanvue token exchange failed.")
  }

  return json
}

export async function refreshFanvueAccessToken(refreshToken: string): Promise<FanvueTokenResponse> {
  const clientId = process.env.FANVUE_OAUTH_CLIENT_ID?.trim()
  const clientSecret = process.env.FANVUE_OAUTH_CLIENT_SECRET?.trim()

  if (!clientId || !clientSecret) {
    throw new Error("Fanvue OAuth is not configured.")
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  })

  const response = await fetch(`${FANVUE_AUTH_BASE_URL}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })

  const json = (await response.json()) as FanvueTokenResponse & { error?: string; error_description?: string }

  if (!response.ok) {
    throw new Error(json.error_description || json.error || "Fanvue token refresh failed.")
  }

  return json
}
