import { NextResponse } from "next/server"

import { hashToken, normalizeScopes, randomToken, validateClientRedirect } from "@/lib/mcp/auth"
import { MCP_OAUTH_RETURN_COOKIE } from "@/lib/mcp/oauth-login-state"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const clientId = requestUrl.searchParams.get("client_id") || ""
  const redirectUri = requestUrl.searchParams.get("redirect_uri") || ""
  const responseType = requestUrl.searchParams.get("response_type") || ""
  const state = requestUrl.searchParams.get("state")
  const scope = requestUrl.searchParams.get("scope")
  const codeChallenge = requestUrl.searchParams.get("code_challenge")
  const codeChallengeMethod = requestUrl.searchParams.get("code_challenge_method")
  const resource = requestUrl.searchParams.get("resource")

  const client = await validateClientRedirect(clientId, redirectUri)
  if (!client) {
    return NextResponse.json({ error: "Invalid OAuth client or redirect_uri" }, { status: 400 })
  }

  if (responseType !== "code") {
    return oauthError(redirectUri, state, "unsupported_response_type")
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const next = `${requestUrl.pathname}${requestUrl.search}`
    const response = NextResponse.redirect(`${requestUrl.origin}/login?next=/oauth/resume`, 302)
    response.cookies.set(MCP_OAUTH_RETURN_COOKIE, next, {
      path: "/",
      maxAge: 10 * 60,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    })
    return response
  }

  const serviceRole = createServiceRoleClient()
  if (!serviceRole) {
    return NextResponse.json({ error: "MCP OAuth is not configured" }, { status: 500 })
  }

  const code = randomToken("unican_mcp_code_")
  const scopes = normalizeScopes(scope)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  const { error } = await serviceRole.from("mcp_oauth_codes").insert({
    code_hash: hashToken(code),
    client_id: clientId,
    user_id: user.id,
    redirect_uri: redirectUri,
    scopes,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    resource,
    expires_at: expiresAt,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const redirect = new URL(redirectUri)
  redirect.searchParams.set("code", code)
  if (state) redirect.searchParams.set("state", state)
  const response = NextResponse.redirect(redirect.toString(), 302)
  response.cookies.delete(MCP_OAUTH_RETURN_COOKIE)
  return response
}

function oauthError(redirectUri: string, state: string | null, error: string) {
  if (!redirectUri) return NextResponse.json({ error }, { status: 400 })
  const redirect = new URL(redirectUri)
  redirect.searchParams.set("error", error)
  if (state) redirect.searchParams.set("state", state)
  return NextResponse.redirect(redirect.toString(), 302)
}
