export const FANVUE_AUTH_BASE_URL = process.env.FANVUE_AUTH_BASE_URL?.trim() || "https://auth.fanvue.com"
export const FANVUE_API_BASE_URL = process.env.FANVUE_API_BASE_URL?.trim() || "https://api.fanvue.com"
export const FANVUE_API_VERSION = process.env.FANVUE_API_VERSION?.trim() || "2025-06-26"

const FANVUE_DEFAULT_SCOPES = ["openid", "offline_access", "offline"] as const

const FANVUE_APP_SCOPES = [
  "read:creator",
  "read:insights",
  "read:media",
  "read:post",
  "read:self",
  "read:tracking_links",
  "write:media",
  "write:post",
] as const

export const FANVUE_OAUTH_SCOPES = [...FANVUE_DEFAULT_SCOPES, ...FANVUE_APP_SCOPES].join(" ")

function readConfiguredFanvueRedirectUri(): string | undefined {
  const configured =
    process.env.FANVUE_OAUTH_REDIRECT_URI?.trim() ||
    process.env.FANVUE_OAUTH_REDIRECT_URL?.trim()

  return configured || undefined
}

export function resolveFanvueOAuthRedirectUri(requestUrl: URL): string {
  const configured = readConfiguredFanvueRedirectUri()
  if (configured) {
    return configured
  }
  return `${requestUrl.origin}/api/fanvue/callback`
}

export function resolveFanvueOAuthOrigin(requestUrl: URL): string {
  return new URL(resolveFanvueOAuthRedirectUri(requestUrl)).origin
}
