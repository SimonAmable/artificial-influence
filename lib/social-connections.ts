import type { SupabaseClient } from "@supabase/supabase-js"

export type SocialProvider = "instagram" | "tiktok"
export type SocialConnectionStatus = "connected" | "disconnected" | "error" | "expired"

type JsonRecord = Record<string, unknown>

function objectMetadata(raw: unknown): JsonRecord {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as JsonRecord) : {}
}

function stringArrayFromScopes(scope: string | string[] | null | undefined): string[] {
  if (Array.isArray(scope)) {
    return scope.map((s) => s.trim()).filter(Boolean)
  }
  return (scope ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

export function parseSocialMetadata(raw: unknown): JsonRecord {
  return objectMetadata(raw)
}

export function readStringMetadata(raw: unknown, key: string): string | null {
  const value = objectMetadata(raw)[key]
  return typeof value === "string" && value.trim() ? value : null
}

export async function upsertInstagramSocialConnection(
  supabase: SupabaseClient,
  row: {
    id: string
    user_id: string
    instagram_user_id: string
    instagram_username: string | null
    access_token_encrypted: string
    access_token_last4: string | null
    token_expires_at: string | null
    status: SocialConnectionStatus
    metadata: unknown
  }
) {
  const metadata = objectMetadata(row.metadata)
  const profile = objectMetadata(metadata.profile)
  const displayName =
    typeof profile.name === "string" && profile.name.trim()
      ? profile.name
      : row.instagram_username
  const avatarUrl =
    typeof profile.profile_picture_url === "string" && profile.profile_picture_url.trim()
      ? profile.profile_picture_url
      : null

  return supabase.from("social_connections").upsert(
    {
      user_id: row.user_id,
      provider: "instagram" satisfies SocialProvider,
      provider_account_id: row.instagram_user_id,
      username: row.instagram_username,
      display_name: displayName,
      avatar_url: avatarUrl,
      access_token_encrypted: row.access_token_encrypted,
      access_token_last4: row.access_token_last4,
      refresh_token_encrypted: null,
      refresh_token_last4: null,
      token_expires_at: row.token_expires_at,
      refresh_token_expires_at: null,
      scopes: stringArrayFromScopes(readStringMetadata(metadata, "scope")),
      status: row.status,
      metadata: {
        ...metadata,
        instagram_connection_id: row.id,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider,provider_account_id" }
  )
}

export async function markInstagramSocialConnectionDisconnected(
  supabase: SupabaseClient,
  params: {
    userId: string
    instagramUserId: string
  }
) {
  return supabase
    .from("social_connections")
    .update({
      status: "disconnected" satisfies SocialConnectionStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", params.userId)
    .eq("provider", "instagram")
    .eq("provider_account_id", params.instagramUserId)
}

export async function upsertTikTokSocialConnection(
  supabase: SupabaseClient,
  row: {
    userId: string
    openId: string
    username: string | null
    displayName: string | null
    avatarUrl: string | null
    accessTokenEncrypted: string
    accessTokenLast4: string | null
    refreshTokenEncrypted: string | null
    refreshTokenLast4: string | null
    tokenExpiresAt: string | null
    refreshTokenExpiresAt: string | null
    scopes: string[]
    metadata: unknown
  }
) {
  return supabase.from("social_connections").upsert(
    {
      user_id: row.userId,
      provider: "tiktok" satisfies SocialProvider,
      provider_account_id: row.openId,
      username: row.username,
      display_name: row.displayName,
      avatar_url: row.avatarUrl,
      access_token_encrypted: row.accessTokenEncrypted,
      access_token_last4: row.accessTokenLast4,
      refresh_token_encrypted: row.refreshTokenEncrypted,
      refresh_token_last4: row.refreshTokenLast4,
      token_expires_at: row.tokenExpiresAt,
      refresh_token_expires_at: row.refreshTokenExpiresAt,
      scopes: row.scopes,
      status: "connected" satisfies SocialConnectionStatus,
      metadata: objectMetadata(row.metadata),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider,provider_account_id" }
  )
}
