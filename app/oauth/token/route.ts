import { NextResponse } from "next/server"

import {
  getMcpClient,
  hashToken,
  MCP_ACCESS_TOKEN_PREFIX,
  MCP_REFRESH_TOKEN_PREFIX,
  randomToken,
  validateClientRedirect,
  verifyClientSecret,
  verifyPkce,
} from "@/lib/mcp/auth"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const params = await readTokenParams(request)
    const grantType = params.get("grant_type")

    if (grantType === "authorization_code") {
      return exchangeAuthorizationCode(params)
    }

    if (grantType === "refresh_token") {
      return exchangeRefreshToken(params)
    }

    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: "invalid_request", error_description: error instanceof Error ? error.message : "Invalid token request" },
      { status: 400 },
    )
  }
}

async function exchangeAuthorizationCode(params: URLSearchParams) {
  const supabase = requireServiceRole()
  const code = params.get("code") || ""
  const clientId = params.get("client_id") || ""
  const redirectUri = params.get("redirect_uri") || ""
  const codeVerifier = params.get("code_verifier") || ""
  const clientSecret = params.get("client_secret")

  const client = await validateClientRedirect(clientId, redirectUri)
  if (!client) {
    return NextResponse.json({ error: "invalid_client" }, { status: 401 })
  }

  if (
    client.token_endpoint_auth_method === "client_secret_post" &&
    !verifyClientSecret(clientSecret || "", client.client_secret_hash as string | null)
  ) {
    return NextResponse.json({ error: "invalid_client" }, { status: 401 })
  }

  const { data: codeRow, error } = await supabase
    .from("mcp_oauth_codes")
    .select("*")
    .eq("code_hash", hashToken(code))
    .eq("client_id", clientId)
    .maybeSingle()

  if (error || !codeRow || codeRow.consumed_at) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 })
  }

  if (new Date(String(codeRow.expires_at)).getTime() <= Date.now()) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 })
  }

  if (codeRow.redirect_uri !== redirectUri) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 })
  }

  if (!verifyPkce(codeVerifier, codeRow.code_challenge, codeRow.code_challenge_method)) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 })
  }

  await supabase
    .from("mcp_oauth_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", codeRow.id)

  return issueTokens({
    clientId,
    userId: String(codeRow.user_id),
    scopes: Array.isArray(codeRow.scopes) ? codeRow.scopes.map(String) : [],
  })
}

async function exchangeRefreshToken(params: URLSearchParams) {
  const supabase = requireServiceRole()
  const refreshToken = params.get("refresh_token") || ""
  const clientId = params.get("client_id") || ""
  const clientSecret = params.get("client_secret")

  const client = await getMcpClient(clientId)
  if (!client) {
    return NextResponse.json({ error: "invalid_client" }, { status: 401 })
  }

  if (
    client.token_endpoint_auth_method === "client_secret_post" &&
    !verifyClientSecret(clientSecret || "", client.client_secret_hash as string | null)
  ) {
    return NextResponse.json({ error: "invalid_client" }, { status: 401 })
  }

  const { data: tokenRow, error } = await supabase
    .from("mcp_oauth_tokens")
    .select("*")
    .eq("refresh_token_hash", hashToken(refreshToken))
    .eq("client_id", clientId)
    .maybeSingle()

  if (error || !tokenRow || tokenRow.revoked_at) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 })
  }

  await supabase
    .from("mcp_oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenRow.id)

  return issueTokens({
    clientId,
    userId: String(tokenRow.user_id),
    scopes: Array.isArray(tokenRow.scopes) ? tokenRow.scopes.map(String) : [],
  })
}

async function issueTokens(input: { clientId: string; userId: string; scopes: string[] }) {
  const supabase = requireServiceRole()
  const accessToken = randomToken(MCP_ACCESS_TOKEN_PREFIX)
  const refreshToken = randomToken(MCP_REFRESH_TOKEN_PREFIX)
  const expiresIn = 60 * 60
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  const { error } = await supabase.from("mcp_oauth_tokens").insert({
    access_token_hash: hashToken(accessToken),
    refresh_token_hash: hashToken(refreshToken),
    client_id: input.clientId,
    user_id: input.userId,
    scopes: input.scopes,
    expires_at: expiresAt,
  })

  if (error) {
    return NextResponse.json({ error: "server_error", error_description: error.message }, { status: 500 })
  }

  return NextResponse.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresIn,
    refresh_token: refreshToken,
    scope: input.scopes.join(" "),
  })
}

async function readTokenParams(request: Request) {
  const contentType = request.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    const body = await request.json()
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(body || {})) {
      if (typeof value === "string") params.set(key, value)
    }
    return params
  }
  return new URLSearchParams(await request.text())
}

function requireServiceRole() {
  const supabase = createServiceRoleClient()
  if (!supabase) {
    throw new Error("MCP OAuth is not configured")
  }
  return supabase
}
