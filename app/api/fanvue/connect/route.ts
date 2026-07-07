import { randomBytes } from "crypto"
import { NextResponse } from "next/server"

import {
  buildFanvueAuthorizeUrl,
  FANVUE_OAUTH_STATE_COOKIE,
  FANVUE_OAUTH_VERIFIER_COOKIE,
  generateFanvuePkcePair,
} from "@/lib/fanvue/oauth"
import { resolveFanvueOAuthRedirectUri } from "@/lib/fanvue/config"
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

    const clientId = process.env.FANVUE_OAUTH_CLIENT_ID?.trim()
    const redirectUri = resolveFanvueOAuthRedirectUri(requestUrl)

    if (!clientId) {
      return NextResponse.json(
        { error: "Fanvue OAuth is not configured. Missing FANVUE_OAUTH_CLIENT_ID." },
        { status: 500 }
      )
    }

    const state = randomBytes(24).toString("base64url")
    const { verifier, challenge } = generateFanvuePkcePair()
    const authorizeUrl = buildFanvueAuthorizeUrl({
      clientId,
      redirectUri,
      state,
      codeChallenge: challenge,
    })

    const response = NextResponse.redirect(authorizeUrl, 302)

    const returnPath = parseSocialOAuthReturnPath(requestUrl.searchParams.get("next")) ?? "/content"
    response.cookies.set(SOCIAL_OAUTH_RETURN_COOKIE, returnPath, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10,
      path: "/",
    })

    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 60 * 10,
      path: "/",
    }

    response.cookies.set(FANVUE_OAUTH_STATE_COOKIE, state, cookieOpts)
    response.cookies.set(FANVUE_OAUTH_VERIFIER_COOKIE, verifier, cookieOpts)

    return response
  } catch (error) {
    console.error("[fanvue/connect] GET exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
