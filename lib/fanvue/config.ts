export const FANVUE_AUTH_BASE_URL = process.env.FANVUE_AUTH_BASE_URL?.trim() || "https://auth.fanvue.com"
export const FANVUE_API_BASE_URL = process.env.FANVUE_API_BASE_URL?.trim() || "https://api.fanvue.com"
export const FANVUE_API_VERSION = process.env.FANVUE_API_VERSION?.trim() || "2025-06-26"

export const FANVUE_OAUTH_SCOPES = [
  "openid",
  "offline_access",
  "offline",
  "read:creator",
  "read:insights",
  "read:media",
  "read:post",
  "read:self",
  "read:tracking_links",
  "write:media",
  "write:post",
].join(" ")

export function resolveFanvueOAuthRedirectUri(requestUrl: URL): string {
  const configured = process.env.FANVUE_OAUTH_REDIRECT_URI?.trim()
  if (configured) {
    return configured
  }
  return `${requestUrl.origin}/api/fanvue/callback`
}
