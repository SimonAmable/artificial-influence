import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { encryptAutopostToken } from "@/lib/autopost/crypto"
import { persistSocialAvatarUrl } from "@/lib/social/persist-social-avatar"
import {
  createSocialOAuthFinishRedirect,
  SOCIAL_OAUTH_RETURN_COOKIE,
} from "@/lib/social/oauth-return"
import { upsertTikTokSocialConnection } from "@/lib/social-connections"
import { exchangeTikTokCodeForToken } from "@/lib/tiktok/oauth"
import { resolveTikTokOAuthRedirectUri } from "@/lib/tiktok/oauth-redirect"
import { fetchTikTokUserProfile } from "@/lib/tiktok/profile"
import { createClient } from "@/lib/supabase/server"

const OAUTH_STATE_COOKIE = "tiktok_oauth_state"

function addSeconds(seconds: number | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return null
  }
  return new Date(Date.now() + seconds * 1000).toISOString()
}

function scopeList(scope: string | undefined): string[] {
  return (scope ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin
  const cookieStore = await cookies()
  const socialReturnCookie = cookieStore.get(SOCIAL_OAUTH_RETURN_COOKIE)?.value

  const finish = (params: Record<string, string>) =>
    createSocialOAuthFinishRedirect(appUrl, socialReturnCookie, params, [
      { name: OAUTH_STATE_COOKIE },
    ])

  try {
    const code = requestUrl.searchParams.get("code")
    const state = requestUrl.searchParams.get("state")
    const error = requestUrl.searchParams.get("error")
    const errorDescription = requestUrl.searchParams.get("error_description")

    if (error) {
      return finish({
        provider: "tiktok",
        error: errorDescription || error,
      })
    }

    if (!code || !state) {
      return finish({
        provider: "tiktok",
        error: "Missing TikTok OAuth code or state.",
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

    const stateCookieValue = cookieStore.get(OAUTH_STATE_COOKIE)?.value

    if (!stateCookieValue || stateCookieValue !== state) {
      return finish({
        provider: "tiktok",
        error: "Invalid TikTok OAuth state.",
      })
    }

    const token = await exchangeTikTokCodeForToken({
      code,
      redirectUri: resolveTikTokOAuthRedirectUri(requestUrl),
    })

    if (!token.access_token || !token.open_id) {
      return finish({
        provider: "tiktok",
        error: "TikTok Login succeeded, but the token response was incomplete.",
      })
    }

    const profile = await fetchTikTokUserProfile(token.access_token)
    const persistedAvatarUrl = await persistSocialAvatarUrl({
      userId: user.id,
      provider: "tiktok",
      accountId: token.open_id,
      sourceUrl: profile.avatar_url,
    })
    const profileForStorage = persistedAvatarUrl
      ? { ...profile, avatar_url: persistedAvatarUrl }
      : profile
    const refreshToken = token.refresh_token ?? null
    const { error: upsertError } = await upsertTikTokSocialConnection(supabase, {
      userId: user.id,
      openId: token.open_id,
      username: null,
      displayName: profileForStorage.display_name,
      avatarUrl: profileForStorage.avatar_url,
      accessTokenEncrypted: encryptAutopostToken(token.access_token),
      accessTokenLast4: token.access_token.slice(-4),
      refreshTokenEncrypted: refreshToken ? encryptAutopostToken(refreshToken) : null,
      refreshTokenLast4: refreshToken ? refreshToken.slice(-4) : null,
      tokenExpiresAt: addSeconds(token.expires_in),
      refreshTokenExpiresAt: addSeconds(token.refresh_expires_in),
      scopes: scopeList(token.scope),
      metadata: {
        profile: profileForStorage,
        token_type: token.token_type ?? null,
      },
    })

    if (upsertError) {
      console.error("[tiktok/callback] social upsert failed:", upsertError)
      return finish({
        provider: "tiktok",
        error: "Failed to save TikTok connection.",
      })
    }

    return finish({ provider: "tiktok", connected: "1" })
  } catch (error) {
    console.error("[tiktok/callback] GET exception:", error)
    return finish({
      provider: "tiktok",
      error: error instanceof Error ? error.message : "TikTok callback failed.",
    })
  }
}
