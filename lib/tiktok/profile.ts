const TIKTOK_USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/"
const USER_INFO_FIELDS = "open_id,display_name,avatar_url"

export type TikTokSavedProfile = {
  open_id: string
  display_name: string | null
  avatar_url: string | null
  fetched_at: string
}

type TikTokUserObject = {
  open_id?: string
  display_name?: string
  avatar_url?: string
}

type TikTokUserInfoResponse = {
  data?: {
    user?: TikTokUserObject
  }
  error?: {
    code?: string
    message?: string
    log_id?: string
  }
}

function tiktokErrorMessage(data: TikTokUserInfoResponse) {
  const message = data.error?.message || data.error?.code || "TikTok user info request failed."
  return data.error?.log_id ? `${message} (TikTok log ${data.error.log_id})` : message
}

export async function fetchTikTokUserProfile(accessToken: string): Promise<TikTokSavedProfile> {
  const url = new URL(TIKTOK_USER_INFO_URL)
  url.searchParams.set("fields", USER_INFO_FIELDS)

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  })

  const data = (await response.json()) as TikTokUserInfoResponse

  if (!response.ok || data.error?.code) {
    throw new Error(tiktokErrorMessage(data))
  }

  const user = data.data?.user
  if (!user?.open_id) {
    throw new Error("TikTok Login succeeded, but we could not read your profile.")
  }

  return {
    open_id: user.open_id,
    display_name: user.display_name ?? null,
    avatar_url: user.avatar_url ?? null,
    fetched_at: new Date().toISOString(),
  }
}

export function parseTikTokSavedProfile(metadata: unknown): TikTokSavedProfile | null {
  if (!metadata || typeof metadata !== "object") {
    return null
  }
  const raw = (metadata as { profile?: unknown }).profile
  if (!raw || typeof raw !== "object") {
    return null
  }
  const profile = raw as Record<string, unknown>
  const openId = typeof profile.open_id === "string" ? profile.open_id : null
  const fetchedAt = typeof profile.fetched_at === "string" ? profile.fetched_at : null
  if (!openId || !fetchedAt) {
    return null
  }

  return {
    open_id: openId,
    display_name: typeof profile.display_name === "string" ? profile.display_name : null,
    avatar_url: typeof profile.avatar_url === "string" ? profile.avatar_url : null,
    fetched_at: fetchedAt,
  }
}
