import { randomBytes } from "crypto"
import { NextResponse } from "next/server"

import { resolveTikTokOAuthRedirectUri } from "@/lib/tiktok/oauth-redirect"
import { createClient } from "@/lib/supabase/server"

const OAUTH_STATE_COOKIE = "tiktok_oauth_state"
const TIKTOK_OAUTH_URL = "https://www.tiktok.com/v2/auth/authorize/"
const TIKTOK_V1_SCOPE = "user.info.basic"

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

    const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim()
    const redirectUri = resolveTikTokOAuthRedirectUri(requestUrl)

    if (!clientKey) {
      return NextResponse.json(
        { error: "TikTok OAuth is not configured. Missing TIKTOK_CLIENT_KEY." },
        { status: 500 }
      )
    }

    const state = randomBytes(24).toString("base64url")
    const params = new URLSearchParams({
      client_key: clientKey,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: TIKTOK_V1_SCOPE,
      state,
    })

    const response = NextResponse.redirect(`${TIKTOK_OAUTH_URL}?${params.toString()}`, 302)
    response.cookies.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10,
      path: "/",
    })

    return response
  } catch (error) {
    console.error("[tiktok/connect] GET exception:", error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}
