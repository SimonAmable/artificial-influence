import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { parseSavedProfileFromMetadata } from "@/lib/instagram/profile"

interface CreateListInstagramConnectionsToolOptions {
  supabase: SupabaseClient
  userId: string
}

export function createListInstagramConnectionsTool({
  supabase,
  userId,
}: CreateListInstagramConnectionsToolOptions) {
  return tool({
    description:
      "List the user's connected Instagram accounts. Use this before preparing a post whenever the exact account is missing or ambiguous. Do not guess between multiple connected accounts.",
    inputSchema: z.object({}),
    strict: true,
    execute: async () => {
      const { data, error } = await supabase
        .from("instagram_connections")
        .select("id, instagram_user_id, instagram_username, token_expires_at, updated_at, metadata")
        .eq("user_id", userId)
        .eq("status", "connected")
        .order("updated_at", { ascending: false })

      if (error) {
        throw new Error(`Failed to load Instagram connections: ${error.message}`)
      }

      const connections = (data ?? []).map((row) => {
        const metadata =
          row.metadata && typeof row.metadata === "object"
            ? (row.metadata as Record<string, unknown>)
            : null
        const profile = parseSavedProfileFromMetadata(row.metadata)

        return {
          accountType:
            metadata && typeof metadata.account_type === "string" ? metadata.account_type : null,
          id: row.id,
          instagramUserId: row.instagram_user_id,
          instagramUsername: row.instagram_username,
          profileFetchedAt: profile?.fetched_at ?? null,
          tokenExpiresAt: row.token_expires_at,
          updatedAt: row.updated_at,
        }
      })

      return {
        connections,
        message:
          connections.length > 0
            ? `Found ${connections.length} connected Instagram account${connections.length === 1 ? "" : "s"}.`
            : "No connected Instagram accounts were found.",
        total: connections.length,
      }
    },
  })
}
