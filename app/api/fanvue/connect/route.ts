import { NextResponse } from "next/server"

import {
  buildFanvueAuthorizeUrl,
  generateFanvuePkcePair,
} from "@/lib/fanvue/oauth"
import { resolveFanvueOAuthOrigin, resolveFanvueOAuthRedirectUri } from "@/lib/fanvue/config"
import { createFanvueOAuthState } from "@/lib/fanvue/oauth-state"
import { requirePresenceProductResponse } from "@/lib/product/require-presence"
import {
  parseSocialOAuthReturnPath,
  SOCIAL_OAUTH_RETURN_COOKIE,
} from "@/lib/social/oauth-return"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const blocked = requirePresenceProductResponse()
  if (blocked) return blocked

  try {
    const requestUrl = new URL(request.url)
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.redirect(`${requestUrl.origin}/login?next=/content`, 302)
    }

    const redirectUri = resolveFanvueOAuthRedirectUri(requestUrl)
    const oauthOrigin = resolveFanvueOAuthOrigin(requestUrl)
    if (oauthOrigin !== requestUrl.origin) {
      const canonicalConnect = new URL(`${requestUrl.pathname}${requestUrl.search}`, oauthOrigin)
      return NextResponse.redirect(canonicalConnect.toString(), 302)
    }

    const clientId = process.env.FANVUE_OAUTH_CLIENT_ID?.trim()
    if (!clientId) {
      return NextResponse.json(
        { error: "Fanvue OAuth is not configured. Missing FANVUE_OAUTH_CLIENT_ID." },
        { status: 500 }
      )
    }

    const returnPath = parseSocialOAuthReturnPath(requestUrl.searchParams.get("next")) ?? "/content"
    const { verifier, challenge } = generateFanvuePkcePair()
    const state = createFanvueOAuthState({
      verifier,
      userId: user.id,
      returnPath,
    })

    if (!state) {
      return NextResponse.json(
        { error: "Fanvue OAuth is not configured. Missing FANVUE_OAUTH_CLIENT_SECRET." },
        { status: 500 }
      )
    }
    const authorizeUrl = buildFanvueAuthorizeUrl({
      clientId,
      redirectUri,
      state,
      codeChallenge: challenge,
    })

    const response = NextResponse.redirect(authorizeUrl, 302)

    response.cookies.set(SOCIAL_OAUTH_RETURN_COOKIE, returnPath, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10,
      path: "/",
    })

    return response
  } catch (error) {
    console.error("[fanvue/connect] GET exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
