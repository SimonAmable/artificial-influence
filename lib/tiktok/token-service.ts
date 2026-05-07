import type { SupabaseClient } from "@supabase/supabase-js"

import { decryptAutopostToken, encryptAutopostToken } from "@/lib/autopost/crypto"
import { refreshTikTokAccessToken } from "@/lib/tiktok/oauth"

const REFRESH_SKEW_MS = 10 * 60 * 1000

type TikTokConnectionRow = {
  id: string
  user_id: string
  provider_account_id: string
  access_token_encrypted: string
  refresh_token_encrypted: string | null
  token_expires_at: string | null
  refresh_token_expires_at: string | null
  scopes: string[] | null
  status: string
  metadata: unknown
}

export type ValidTikTokToken = {
  accessToken: string
  connection: TikTokConnectionRow
  scopes: string[]
}

function expiresSoon(value: string | null): boolean {
  if (!value) return true
  const time = new Date(value).getTime()
  return !Number.isFinite(time) || time <= Date.now() + REFRESH_SKEW_MS
}

function addSeconds(seconds: number | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return null
  }
  return new Date(Date.now() + seconds * 1000).toISOString()
}

function parseScopes(scope: string | undefined, fallback: string[] | null): string[] {
  const parsed = (scope ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  return parsed.length > 0 ? parsed : fallback ?? []
}

export async function getValidTikTokAccessToken(
  supabase: SupabaseClient,
  params: {
    connectionId: string
    userId: string
  }
): Promise<ValidTikTokToken> {
  const { data: connection, error } = await supabase
    .from("social_connections")
    .select(
      "id, user_id, provider_account_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, refresh_token_expires_at, scopes, status, metadata"
    )
    .eq("id", params.connectionId)
    .eq("user_id", params.userId)
    .eq("provider", "tiktok")
    .maybeSingle()

  if (error || !connection?.access_token_encrypted) {
    throw new Error("TikTok connection not found.")
  }

  const row = connection as TikTokConnectionRow
  if (row.status !== "connected") {
    throw new Error("Reconnect TikTok before publishing.")
  }

  if (!expiresSoon(row.token_expires_at)) {
    return {
      accessToken: decryptAutopostToken(row.access_token_encrypted),
      connection: row,
      scopes: row.scopes ?? [],
    }
  }

  if (!row.refresh_token_encrypted) {
    await supabase
      .from("social_connections")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("user_id", row.user_id)
    throw new Error("TikTok access token expired. Reconnect TikTok.")
  }

  if (row.refresh_token_expires_at) {
    const refreshExpires = new Date(row.refresh_token_expires_at).getTime()
    if (Number.isFinite(refreshExpires) && refreshExpires <= Date.now()) {
      await supabase
        .from("social_connections")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("user_id", row.user_id)
      throw new Error("TikTok refresh token expired. Reconnect TikTok.")
    }
  }

  let refreshed
  try {
    refreshed = await refreshTikTokAccessToken(decryptAutopostToken(row.refresh_token_encrypted))
  } catch (refreshError) {
    await supabase
      .from("social_connections")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("user_id", row.user_id)
    throw refreshError instanceof Error
      ? new Error(`TikTok token refresh failed: ${refreshError.message}`)
      : new Error("TikTok token refresh failed.")
  }

  const nextRefreshToken = refreshed.refresh_token ?? decryptAutopostToken(row.refresh_token_encrypted)
  const nextScopes = parseScopes(refreshed.scope, row.scopes)
  const nextAccessToken = refreshed.access_token

  if (!nextAccessToken) {
    throw new Error("TikTok token refresh returned no access token.")
  }

  const { data: updated, error: updateError } = await supabase
    .from("social_connections")
    .update({
      access_token_encrypted: encryptAutopostToken(nextAccessToken),
      access_token_last4: nextAccessToken.slice(-4),
      refresh_token_encrypted: encryptAutopostToken(nextRefreshToken),
      refresh_token_last4: nextRefreshToken.slice(-4),
      token_expires_at: addSeconds(refreshed.expires_in),
      refresh_token_expires_at: addSeconds(refreshed.refresh_expires_in) ?? row.refresh_token_expires_at,
      scopes: nextScopes,
      status: "connected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("user_id", row.user_id)
    .select(
      "id, user_id, provider_account_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, refresh_token_expires_at, scopes, status, metadata"
    )
    .single()

  if (updateError || !updated) {
    throw new Error("Could not save refreshed TikTok token.")
  }

  return {
    accessToken: nextAccessToken,
    connection: updated as TikTokConnectionRow,
    scopes: nextScopes,
  }
}
