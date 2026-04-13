import { getInstagramGraphVersion } from "@/lib/instagram/graph"

const GRAPH_HOST = "https://graph.instagram.com"

/** Persisted on connect; returned by `/api/instagram/status`. */
export type InstagramSavedProfile = {
  name: string | null
  biography: string | null
  profile_picture_url: string | null
  followers_count: number | null
  follows_count: number | null
  media_count: number | null
  website: string | null
  fetched_at: string
}

export type InstagramMeResponse = {
  id?: string
  username?: string
  account_type?: string
  name?: string
  biography?: string
  profile_picture_url?: string
  followers_count?: number
  follows_count?: number
  media_count?: number
  website?: string
  error?: { message?: string }
}

const EXTENDED_ME_FIELDS =
  "id,username,account_type,name,profile_picture_url,biography,followers_count,follows_count,media_count,website"

const MINIMAL_ME_FIELDS = "id,username,account_type"

async function fetchMe(accessToken: string, fields: string): Promise<InstagramMeResponse> {
  const version = getInstagramGraphVersion()
  const url = new URL(`${GRAPH_HOST}/${version}/me`)
  url.searchParams.set("fields", fields)
  url.searchParams.set("access_token", accessToken)

  const response = await fetch(url.toString(), { cache: "no-store" })
  const data = (await response.json()) as InstagramMeResponse

  if (!response.ok || data.error) {
    throw new Error(data.error?.message || "Instagram /me request failed.")
  }

  return data
}

function toSavedProfile(me: InstagramMeResponse): InstagramSavedProfile {
  const fetchedAt = new Date().toISOString()
  return {
    name: me.name ?? null,
    biography: me.biography ?? null,
    profile_picture_url: me.profile_picture_url ?? null,
    followers_count: typeof me.followers_count === "number" ? me.followers_count : null,
    follows_count: typeof me.follows_count === "number" ? me.follows_count : null,
    media_count: typeof me.media_count === "number" ? me.media_count : null,
    website: me.website ?? null,
    fetched_at: fetchedAt,
  }
}

/**
 * Loads IG User fields for the token. Tries extended fields first; falls back to id/username/account_type
 * so linking still succeeds if Meta rejects optional field names for this app.
 */
export async function fetchInstagramMeForLink(accessToken: string): Promise<{
  me: InstagramMeResponse
  profile: InstagramSavedProfile
}> {
  let me: InstagramMeResponse
  try {
    me = await fetchMe(accessToken, EXTENDED_ME_FIELDS)
  } catch (firstError) {
    console.warn("[instagram/profile] extended /me failed, retrying minimal fields:", firstError)
    me = await fetchMe(accessToken, MINIMAL_ME_FIELDS)
  }

  return { me, profile: toSavedProfile(me) }
}

export function parseSavedProfileFromMetadata(metadata: unknown): InstagramSavedProfile | null {
  if (!metadata || typeof metadata !== "object") {
    return null
  }
  const raw = (metadata as { profile?: unknown }).profile
  if (!raw || typeof raw !== "object") {
    return null
  }
  const p = raw as Record<string, unknown>
  const fetchedAt = typeof p.fetched_at === "string" ? p.fetched_at : null
  if (!fetchedAt) {
    return null
  }
  return {
    name: typeof p.name === "string" ? p.name : null,
    biography: typeof p.biography === "string" ? p.biography : null,
    profile_picture_url: typeof p.profile_picture_url === "string" ? p.profile_picture_url : null,
    followers_count: typeof p.followers_count === "number" ? p.followers_count : null,
    follows_count: typeof p.follows_count === "number" ? p.follows_count : null,
    media_count: typeof p.media_count === "number" ? p.media_count : null,
    website: typeof p.website === "string" ? p.website : null,
    fetched_at: fetchedAt,
  }
}
