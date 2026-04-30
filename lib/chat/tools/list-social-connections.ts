import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { parseSavedProfileFromMetadata } from "@/lib/instagram/profile"
import { parseSocialMetadata, readStringMetadata, type SocialProvider } from "@/lib/social-connections"
import { parseTikTokSavedProfile } from "@/lib/tiktok/profile"

export type SocialConnectionToolSummary = {
  id: string
  provider: SocialProvider
  displayName: string | null
  username: string | null
  scopes: string[]
  status: string
  updatedAt: string
  tokenExpiresAt: string | null
  instagramConnectionId: string | null
  instagramUserId: string | null
  accountType: string | null
  profileFetchedAt: string | null
}

type SocialConnectionRow = {
  id: string
  provider: SocialProvider
  provider_account_id: string
  username: string | null
  display_name: string | null
  scopes: string[] | null
  status: string
  token_expires_at: string | null
  metadata: unknown
  updated_at: string
}

interface CreateListSocialConnectionsToolOptions {
  supabase: SupabaseClient
  userId: string
}

function toToolSummary(row: SocialConnectionRow): SocialConnectionToolSummary {
  const metadata = parseSocialMetadata(row.metadata)
  const instagramProfile = row.provider === "instagram" ? parseSavedProfileFromMetadata(row.metadata) : null
  const tiktokProfile = row.provider === "tiktok" ? parseTikTokSavedProfile(row.metadata) : null

  return {
    accountType: readStringMetadata(metadata, "account_type"),
    displayName: row.display_name,
    id: row.id,
    instagramConnectionId: row.provider === "instagram" ? readStringMetadata(metadata, "instagram_connection_id") : null,
    instagramUserId: row.provider === "instagram" ? row.provider_account_id : null,
    profileFetchedAt: instagramProfile?.fetched_at ?? tiktokProfile?.fetched_at ?? null,
    provider: row.provider,
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    status: row.status,
    tokenExpiresAt: row.token_expires_at,
    updatedAt: row.updated_at,
    username: row.username,
  }
}

export async function listSocialConnections({
  provider,
  supabase,
  userId,
}: {
  provider?: SocialProvider
  supabase: SupabaseClient
  userId: string
}) {
  let query = supabase
    .from("social_connections")
    .select(
      "id, provider, provider_account_id, username, display_name, scopes, status, token_expires_at, metadata, updated_at"
    )
    .eq("user_id", userId)
    .eq("status", "connected")
    .order("updated_at", { ascending: false })

  if (provider) {
    query = query.eq("provider", provider)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to load social connections: ${error.message}`)
  }

  return ((data ?? []) as SocialConnectionRow[]).map(toToolSummary)
}

export function createListSocialConnectionsTool({
  supabase,
  userId,
}: CreateListSocialConnectionsToolOptions) {
  return tool({
    description:
      "List the user's connected social posting accounts. Use this before preparing an Instagram or TikTok post whenever the exact account is missing or ambiguous. Do not guess between multiple connected accounts.",
    inputSchema: z.object({
      provider: z.enum(["instagram", "tiktok"]).optional().describe("Optional provider filter."),
    }),
    strict: true,
    execute: async (input) => {
      const connections = await listSocialConnections({
        provider: input.provider,
        supabase,
        userId,
      })

      const providerLabel =
        input.provider === "instagram" ? "Instagram" : input.provider === "tiktok" ? "TikTok" : "social"

      return {
        connections,
        message:
          connections.length > 0
            ? `Found ${connections.length} connected ${providerLabel} account${connections.length === 1 ? "" : "s"}.`
            : `No connected ${providerLabel} accounts were found.`,
        provider: input.provider ?? null,
        total: connections.length,
      }
    },
  })
}
