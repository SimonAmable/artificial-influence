import { randomBytes } from "crypto"
import { NextResponse } from "next/server"

import { resolveInstagramOAuthRedirectUri } from "@/lib/instagram/oauth-redirect"
import { createClient } from "@/lib/supabase/server"

const OAUTH_STATE_COOKIE = "instagram_oauth_state"
const INSTAGRAM_OAUTH_URL = "https://www.instagram.com/oauth/authorize"
const DEFAULT_INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
]

function resolveInstagramScopes() {
  const configuredScopes = process.env.INSTAGRAM_OAUTH_SCOPES?.split(",")
    .map((scope) => scope.trim())
    .filter(Boolean)

  if (!configuredScopes?.length) {
    return DEFAULT_INSTAGRAM_SCOPES.join(",")
  }

  const hasLegacyFacebookScopes = configuredScopes.some(
    (scope) =>
      scope === "instagram_basic" ||
      scope === "instagram_content_publish" ||
      scope === "business_management" ||
      scope.startsWith("pages_")
  )

  return hasLegacyFacebookScopes
    ? DEFAULT_INSTAGRAM_SCOPES.join(",")
    : configuredScopes.join(",")
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url)
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.redirect(`${requestUrl.origin}/login?next=/autopost`, 302)
    }

    const appId = process.env.INSTAGRAM_APP_ID?.trim()
    const redirectUri = resolveInstagramOAuthRedirectUri(requestUrl)

    if (!appId) {
      return NextResponse.json(
        { error: "Instagram OAuth is not configured. Missing INSTAGRAM_APP_ID." },
        { status: 500 }
      )
    }

    if (process.env.NODE_ENV === "development") {
      console.info(
        "[instagram/connect] OAuth redirect_uri (must match Meta → Instagram → Business login → OAuth redirect URIs):",
        redirectUri
      )
    }

    const state = randomBytes(24).toString("base64url")
    const scope = resolveInstagramScopes()

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
      scope,
    })

    const response = NextResponse.redirect(`${INSTAGRAM_OAUTH_URL}?${params.toString()}`, 302)

    response.cookies.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10,
      path: "/",
    })

    return response
  } catch (error) {
    console.error("[instagram/connect] GET exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
