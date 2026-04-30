import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { listSocialConnections } from "@/lib/chat/tools/list-social-connections"

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
      const connections = (await listSocialConnections({
        provider: "instagram",
        supabase,
        userId,
      }))
        .filter((connection) => connection.instagramConnectionId)
        .map((connection) => ({
          accountType: connection.accountType,
          id: connection.instagramConnectionId as string,
          instagramUserId: connection.instagramUserId,
          instagramUsername: connection.username,
          profileFetchedAt: connection.profileFetchedAt,
          tokenExpiresAt: connection.tokenExpiresAt,
          updatedAt: connection.updatedAt,
        }))

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
