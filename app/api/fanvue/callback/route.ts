import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { encryptAutopostToken } from "@/lib/autopost/crypto"
import {
  exchangeFanvueCodeForToken,
  FANVUE_OAUTH_STATE_COOKIE,
  FANVUE_OAUTH_VERIFIER_COOKIE,
} from "@/lib/fanvue/oauth"
import { resolveFanvueOAuthRedirectUri } from "@/lib/fanvue/config"
import { fetchFanvueUserProfile } from "@/lib/fanvue/profile"
import { requirePresenceProductResponse } from "@/lib/product/require-presence"
import { persistSocialAvatarUrl } from "@/lib/social/persist-social-avatar"
import {
  createSocialOAuthFinishRedirect,
  SOCIAL_OAUTH_RETURN_COOKIE,
} from "@/lib/social/oauth-return"
import { upsertFanvueSocialConnection } from "@/lib/social-connections"
import { createClient } from "@/lib/supabase/server"

function addSeconds(seconds: number | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return null
  }
  return new Date(Date.now() + seconds * 1000).toISOString()
}

function scopeList(scope: string | undefined): string[] {
  return (scope ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function GET(request: Request) {
  const blocked = requirePresenceProductResponse()
  if (blocked) return blocked

  const requestUrl = new URL(request.url)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin
  const cookieStore = await cookies()
  const socialReturnCookie = cookieStore.get(SOCIAL_OAUTH_RETURN_COOKIE)?.value

  const finish = (params: Record<string, string>) =>
    createSocialOAuthFinishRedirect(appUrl, socialReturnCookie ?? "/content", params, [
      { name: FANVUE_OAUTH_STATE_COOKIE },
      { name: FANVUE_OAUTH_VERIFIER_COOKIE },
    ])

  try {
    const code = requestUrl.searchParams.get("code")
    const state = requestUrl.searchParams.get("state")
    const error = requestUrl.searchParams.get("error")
    const errorDescription = requestUrl.searchParams.get("error_description")

    if (error) {
      return finish({
        provider: "fanvue",
        error: errorDescription || error,
      })
    }

    if (!code || !state) {
      return finish({
        provider: "fanvue",
        error: "Missing Fanvue OAuth code or state.",
      })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.redirect(`${appUrl}/login?next=/content`, 302)
    }

    const stateCookieValue = cookieStore.get(FANVUE_OAUTH_STATE_COOKIE)?.value
    const verifier = cookieStore.get(FANVUE_OAUTH_VERIFIER_COOKIE)?.value

    if (!stateCookieValue || stateCookieValue !== state || !verifier) {
      return finish({
        provider: "fanvue",
        error: "Invalid Fanvue OAuth state.",
      })
    }

    const token = await exchangeFanvueCodeForToken({
      code,
      redirectUri: resolveFanvueOAuthRedirectUri(requestUrl),
      codeVerifier: verifier,
    })

    if (!token.access_token) {
      return finish({
        provider: "fanvue",
        error: "Fanvue login succeeded, but the token response was incomplete.",
      })
    }

    const profile = await fetchFanvueUserProfile(token.access_token)
    const fanvueUuid = profile.uuid?.trim()
    if (!fanvueUuid) {
      return finish({
        provider: "fanvue",
        error: "Could not read your Fanvue account id.",
      })
    }

    const persistedAvatarUrl = await persistSocialAvatarUrl({
      userId: user.id,
      provider: "fanvue",
      accountId: fanvueUuid,
      sourceUrl: profile.avatarUrl,
    })

    const refreshToken = token.refresh_token ?? null
    const { error: upsertError } = await upsertFanvueSocialConnection(supabase, {
      userId: user.id,
      fanvueUuid,
      username: profile.handle ?? null,
      displayName: profile.displayName ?? profile.handle ?? null,
      avatarUrl: persistedAvatarUrl ?? profile.avatarUrl ?? null,
      accessTokenEncrypted: encryptAutopostToken(token.access_token),
      accessTokenLast4: token.access_token.slice(-4),
      refreshTokenEncrypted: refreshToken ? encryptAutopostToken(refreshToken) : null,
      refreshTokenLast4: refreshToken ? refreshToken.slice(-4) : null,
      tokenExpiresAt: addSeconds(token.expires_in),
      refreshTokenExpiresAt: addSeconds(token.refresh_expires_in),
      scopes: scopeList(token.scope),
      metadata: {
        profile: {
          ...profile,
          avatarUrl: persistedAvatarUrl ?? profile.avatarUrl,
        },
      },
    })

    if (upsertError) {
      console.error("[fanvue/callback] upsert failed:", upsertError)
      return finish({
        provider: "fanvue",
        error: "Connected to Fanvue, but saving the connection failed.",
      })
    }

    return finish({
      provider: "fanvue",
      connected: "1",
    })
  } catch (callbackError) {
    console.error("[fanvue/callback] GET exception:", callbackError)
    return finish({
      provider: "fanvue",
      error: callbackError instanceof Error ? callbackError.message : "Fanvue connection failed.",
    })
  }
}
