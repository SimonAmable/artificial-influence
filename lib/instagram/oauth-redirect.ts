/**
 * OAuth redirect_uri must exactly match entries under:
 * Meta App Dashboard → Instagram → API setup with Instagram login →
 * Set up Instagram business login → Business login settings → OAuth redirect URIs.
 *
 * @see https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
 */
export function resolveInstagramOAuthRedirectUri(requestUrl: URL): string {
  const fromEnv = process.env.INSTAGRAM_REDIRECT_URI?.trim()
  if (fromEnv) {
    return fromEnv
  }
  return `${requestUrl.origin}/api/instagram/callback`
}
