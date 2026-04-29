const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
const TIKTOK_REVOKE_URL = "https://open.tiktokapis.com/v2/oauth/revoke/"

export type TikTokTokenResponse = {
  access_token: string
  expires_in: number
  open_id: string
  refresh_expires_in?: number
  refresh_token?: string
  scope?: string
  token_type?: string
}

type TikTokOAuthError = {
  error?: string
  error_description?: string
  log_id?: string
}

function getTikTokClientConfig() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim()
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim()

  if (!clientKey || !clientSecret) {
    throw new Error("TikTok OAuth is not configured. Missing TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET.")
  }

  return { clientKey, clientSecret }
}

async function postTikTokForm<T>(url: string, body: URLSearchParams): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body,
    cache: "no-store",
  })

  const text = await response.text()
  const data = text ? (JSON.parse(text) as T & TikTokOAuthError) : ({} as T & TikTokOAuthError)

  if (!response.ok) {
    const message = data.error_description || data.error || "TikTok OAuth request failed."
    const suffix = data.log_id ? ` (TikTok log ${data.log_id})` : ""
    throw new Error(`${message}${suffix}`)
  }

  return data
}

export async function exchangeTikTokCodeForToken(params: {
  code: string
  redirectUri: string
}): Promise<TikTokTokenResponse> {
  const { clientKey, clientSecret } = getTikTokClientConfig()

  return postTikTokForm<TikTokTokenResponse>(
    TIKTOK_TOKEN_URL,
    new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code: params.code,
      grant_type: "authorization_code",
      redirect_uri: params.redirectUri,
    })
  )
}

export async function refreshTikTokAccessToken(refreshToken: string): Promise<TikTokTokenResponse> {
  const { clientKey, clientSecret } = getTikTokClientConfig()

  return postTikTokForm<TikTokTokenResponse>(
    TIKTOK_TOKEN_URL,
    new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  )
}

export async function revokeTikTokToken(accessToken: string): Promise<void> {
  const { clientKey, clientSecret } = getTikTokClientConfig()

  await postTikTokForm(
    TIKTOK_REVOKE_URL,
    new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      token: accessToken,
    })
  )
}
