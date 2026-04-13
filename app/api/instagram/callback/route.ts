import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { encryptAutopostToken } from "@/lib/autopost/crypto"
import { fetchInstagramMeForLink, type InstagramMeResponse, type InstagramSavedProfile } from "@/lib/instagram/profile"
import { resolveInstagramOAuthRedirectUri } from "@/lib/instagram/oauth-redirect"
import { createClient } from "@/lib/supabase/server"

const OAUTH_STATE_COOKIE = "instagram_oauth_state"
const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token"
const INSTAGRAM_LONG_LIVED_TOKEN_URL = "https://graph.instagram.com/access_token"
const PROFESSIONAL_ACCOUNT_TYPES = new Set(["BUSINESS", "CREATOR", "MEDIA_CREATOR"])

type MetaOAuthErrorPayload = {
  error?: {
    message?: string
  }
}

type MetaInstagramTokenResponse = {
  access_token: string
  token_type?: string
  expires_in?: number
  user_id?: number | string
}

async function getJsonResponse<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...init })
  const data = (await response.json()) as T & MetaOAuthErrorPayload

  if (!response.ok) {
    throw new Error(data.error?.message || "Instagram API request failed.")
  }

  return data
}

async function postFormResponse<T>(url: string, body: URLSearchParams) {
  return getJsonResponse<T>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })
}

function normalizeInstagramShortLivedToken(data: unknown): MetaInstagramTokenResponse {
  if (data && typeof data === "object" && "access_token" in data) {
    return data as MetaInstagramTokenResponse
  }
  const wrapped = data as { data?: MetaInstagramTokenResponse[] }
  const first = wrapped.data?.[0]
  if (first?.access_token) {
    return first
  }
  throw new Error("Unexpected Instagram token response shape.")
}

function buildAutopostRedirect(appUrl: string, params: Record<string, string>) {
  const redirectUrl = new URL("/autopost", appUrl)

  for (const [key, value] of Object.entries(params)) {
    redirectUrl.searchParams.set(key, value)
  }

  const response = NextResponse.redirect(redirectUrl, 302)
  response.cookies.set(OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  })

  return response
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin

  try {
    const code = requestUrl.searchParams.get("code")
    const state = requestUrl.searchParams.get("state")
    const error = requestUrl.searchParams.get("error")
    const errorDescription = requestUrl.searchParams.get("error_description")

    if (error) {
      return buildAutopostRedirect(appUrl, {
        error: errorDescription || error,
      })
    }

    if (!code || !state) {
      return buildAutopostRedirect(appUrl, {
        error: "Missing Instagram OAuth code or state.",
      })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.redirect(`${appUrl}/login?next=/autopost`, 302)
    }

    const cookieStore = await cookies()
    const stateCookieValue = cookieStore.get(OAUTH_STATE_COOKIE)?.value

    if (!stateCookieValue || stateCookieValue !== state) {
      return buildAutopostRedirect(appUrl, {
        error: "Invalid Instagram OAuth state.",
      })
    }

    const appId = process.env.INSTAGRAM_APP_ID?.trim()
    const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim()
    const redirectUri = resolveInstagramOAuthRedirectUri(requestUrl)

    if (!appId || !appSecret) {
      return buildAutopostRedirect(appUrl, {
        error: "Instagram env vars are not configured.",
      })
    }

    const tokenRaw = await postFormResponse<unknown>(
      INSTAGRAM_TOKEN_URL,
      new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      })
    )
    const shortLivedToken = normalizeInstagramShortLivedToken(tokenRaw)

    let tokenPayload = shortLivedToken
    let tokenStrategy: "short_lived" | "long_lived" = "short_lived"

    try {
      const longTokenUrl = new URL(INSTAGRAM_LONG_LIVED_TOKEN_URL)
      longTokenUrl.searchParams.set("grant_type", "ig_exchange_token")
      longTokenUrl.searchParams.set("client_secret", appSecret)
      longTokenUrl.searchParams.set("access_token", shortLivedToken.access_token)

      tokenPayload = await getJsonResponse<MetaInstagramTokenResponse>(longTokenUrl.toString())
      tokenStrategy = "long_lived"
    } catch (tokenExchangeError) {
      console.warn("[instagram/callback] long-lived token exchange failed:", tokenExchangeError)
    }

    let me: InstagramMeResponse
    let savedProfile: InstagramSavedProfile
    try {
      const fetched = await fetchInstagramMeForLink(tokenPayload.access_token)
      me = fetched.me
      savedProfile = fetched.profile
    } catch (profileError) {
      console.error("[instagram/callback] /me profile fetch failed:", profileError)
      return buildAutopostRedirect(appUrl, {
        error:
          profileError instanceof Error
            ? profileError.message
            : "Instagram Login succeeded, but we could not read your account profile.",
      })
    }

    const accountType = me.account_type?.toUpperCase() || null
    const instagramUserId = me.id || String(shortLivedToken.user_id || "")

    if (!instagramUserId || !me.username) {
      return buildAutopostRedirect(appUrl, {
        error: "Instagram Login succeeded, but we could not read your account profile.",
      })
    }

    if (accountType && !PROFESSIONAL_ACCOUNT_TYPES.has(accountType)) {
      return buildAutopostRedirect(appUrl, {
        error: "Only Instagram professional accounts can connect right now.",
      })
    }

    const encryptedToken = encryptAutopostToken(tokenPayload.access_token)
    const tokenExpiresAt =
      typeof tokenPayload.expires_in === "number"
        ? new Date(Date.now() + tokenPayload.expires_in * 1000).toISOString()
        : null

    const { error: upsertError } = await supabase.from("instagram_connections").upsert(
      {
        user_id: user.id,
        provider: "instagram_login",
        instagram_user_id: instagramUserId,
        instagram_username: me.username,
        facebook_page_id: null,
        facebook_page_name: null,
        access_token_encrypted: encryptedToken,
        access_token_last4: tokenPayload.access_token.slice(-4),
        token_expires_at: tokenExpiresAt,
        status: "connected",
        metadata: {
          account_type: me.account_type || null,
          connection_method: "instagram_login",
          token_type: tokenPayload.token_type || null,
          token_strategy: tokenStrategy,
          profile: savedProfile,
        },
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,instagram_user_id",
      }
    )

    if (upsertError) {
      console.error("[instagram/callback] upsert failed:", upsertError)
      return buildAutopostRedirect(appUrl, {
        error: "Failed to save Instagram connection.",
      })
    }

    return buildAutopostRedirect(appUrl, { connected: "1" })
  } catch (error) {
    console.error("[instagram/callback] GET exception:", error)
    return buildAutopostRedirect(appUrl, {
      error: error instanceof Error ? error.message : "Instagram callback failed.",
    })
  }
}
