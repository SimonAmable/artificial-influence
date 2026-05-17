/**
 * TikTok Login Kit `scope` query param (comma-separated).
 * Default matches Content Posting “upload to inbox” (video.upload) + minimal Login Kit profile.
 * Override with `TIKTOK_OAUTH_SCOPES` when your TikTok app has additional products approved
 * (e.g. `user.info.profile,video.publish`).
 */
const DEFAULT_TIKTOK_LOGIN_SCOPES = "user.info.basic,video.upload"

function normalizeScopeParam(raw: string): string {
  return raw
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(",")
}

export function resolveTikTokOAuthScopeParam(): string {
  const fromEnv = process.env.TIKTOK_OAUTH_SCOPES?.trim()
  if (fromEnv) {
    return normalizeScopeParam(fromEnv)
  }
  return DEFAULT_TIKTOK_LOGIN_SCOPES
}
