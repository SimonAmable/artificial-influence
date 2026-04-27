export function resolveTikTokOAuthRedirectUri(requestUrl: URL): string {
  const configured = process.env.TIKTOK_REDIRECT_URI?.trim()
  if (configured) {
    return configured
  }

  return `${requestUrl.origin}/api/tiktok/callback`
}
