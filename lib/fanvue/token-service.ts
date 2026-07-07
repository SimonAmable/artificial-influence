import type { SupabaseClient } from "@supabase/supabase-js"

import { decryptAutopostToken, encryptAutopostToken } from "@/lib/autopost/crypto"
import { refreshFanvueAccessToken } from "@/lib/fanvue/oauth"

const REFRESH_SKEW_MS = 10 * 60 * 1000

type FanvueConnectionRow = {
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

export type ValidFanvueToken = {
  accessToken: string
  connection: FanvueConnectionRow
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
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  return parsed.length > 0 ? parsed : fallback ?? []
}

export async function getValidFanvueAccessToken(
  supabase: SupabaseClient,
  params: {
    connectionId: string
    userId: string
  }
): Promise<ValidFanvueToken> {
  const { data: connection, error } = await supabase
    .from("social_connections")
    .select(
      "id, user_id, provider_account_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, refresh_token_expires_at, scopes, status, metadata"
    )
    .eq("id", params.connectionId)
    .eq("user_id", params.userId)
    .eq("provider", "fanvue")
    .maybeSingle()

  if (error || !connection?.access_token_encrypted) {
    throw new Error("Fanvue connection not found.")
  }

  const row = connection as FanvueConnectionRow
  if (row.status !== "connected") {
    throw new Error("Reconnect Fanvue before publishing.")
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
    throw new Error("Fanvue access token expired. Reconnect Fanvue.")
  }

  const refreshToken = decryptAutopostToken(row.refresh_token_encrypted)
  const refreshed = await refreshFanvueAccessToken(refreshToken)

  if (!refreshed.access_token) {
    await supabase
      .from("social_connections")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("user_id", row.user_id)
    throw new Error("Fanvue token refresh failed. Reconnect Fanvue.")
  }

  const nextRefresh = refreshed.refresh_token ?? refreshToken
  const { error: updateError } = await supabase
    .from("social_connections")
    .update({
      access_token_encrypted: encryptAutopostToken(refreshed.access_token),
      access_token_last4: refreshed.access_token.slice(-4),
      refresh_token_encrypted: encryptAutopostToken(nextRefresh),
      refresh_token_last4: nextRefresh.slice(-4),
      token_expires_at: addSeconds(refreshed.expires_in),
      refresh_token_expires_at: addSeconds(refreshed.refresh_expires_in) ?? row.refresh_token_expires_at,
      scopes: parseScopes(refreshed.scope, row.scopes),
      status: "connected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("user_id", row.user_id)

  if (updateError) {
    console.error("[fanvue/token-service] refresh persist failed:", updateError)
  }

  return {
    accessToken: refreshed.access_token,
    connection: row,
    scopes: parseScopes(refreshed.scope, row.scopes),
  }
}
