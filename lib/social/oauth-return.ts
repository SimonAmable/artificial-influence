import { NextResponse } from "next/server"

/** Set by `/api/instagram/connect` or `/api/tiktok/connect` when `?next=` is allowed; read on OAuth callback. */
export const SOCIAL_OAUTH_RETURN_COOKIE = "social_oauth_return" as const

export function parseSocialOAuthReturnPath(
  raw: string | null | undefined
): "/onboarding" | "/autopost" | null {
  if (raw === "/onboarding" || raw === "/autopost") {
    return raw
  }
  return null
}

type CookieClearSpec = { name: string; path?: string }

/**
 * Redirect after Instagram/TikTok OAuth completes (success or error).
 * Uses optional return cookie for safe internal paths; defaults to `/autopost`.
 */
export function createSocialOAuthFinishRedirect(
  appUrl: string,
  returnCookieValue: string | undefined,
  searchParams: Record<string, string>,
  clearCookies: CookieClearSpec[]
): NextResponse {
  const basePath = parseSocialOAuthReturnPath(returnCookieValue) ?? "/autopost"
  const url = new URL(basePath, appUrl)
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value)
  }

  const response = NextResponse.redirect(url, 302)
  const emptyOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 0,
    path: "/" as const,
  }

  for (const spec of clearCookies) {
    response.cookies.set(spec.name, "", { ...emptyOpts, path: spec.path ?? "/" })
  }
  response.cookies.set(SOCIAL_OAUTH_RETURN_COOKIE, "", emptyOpts)

  return response
}
