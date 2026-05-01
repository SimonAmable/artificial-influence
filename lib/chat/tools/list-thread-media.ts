import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import {
  listThreadMediaPage,
  type ChatThreadMediaKind,
} from "@/lib/chat/thread-media/server"

interface CreateListThreadMediaToolOptions {
  supabase: SupabaseClient
  threadId: string
  userId: string
}

export function createListThreadMediaTool({
  supabase,
  threadId,
  userId,
}: CreateListThreadMediaToolOptions) {
  return tool({
    description:
      "List media for this chat thread (uploads + completed generations). Each item has a stable `id`: `upl_<uuid>` (uploads / frames / compose) or `gen_<uuid>` (model outputs). Pass those ids as **referenceIds** on generation tools (deprecated alias: **mediaIds**), as **referenceAudioIds** on generateVideo when reusing audio, as **segments[].mediaId** or **audioSegments[].mediaId** on **composeTimelineVideo**, or pass a **video** row's `id` as **mediaId** to **extractVideoFrames**. **Required** whenever the user refers to earlier thread media instead of only current attachments. Results are newest first.",
    inputSchema: z.object({
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Max rows to return (default 50)."),
      mediaKind: z
        .enum(["user_upload", "generation", "all"])
        .optional()
        .describe("Filter by source, or all (default)."),
    }),
    execute: async ({
      limit,
      mediaKind = "all",
    }: {
      limit?: number
      mediaKind?: "user_upload" | "generation" | "all"
    }) => {
      const rows = await listThreadMediaPage(supabase, userId, threadId, {
        limit,
        mediaKind:
          mediaKind === "all" ? "all" : (mediaKind as ChatThreadMediaKind),
      })

      return {
        threadId,
        items: rows.map((row) => ({
          id: row.id,
          mediaKind: row.media_kind,
          mimeType: row.mime_type,
          label: row.label ?? (row.media_kind === "generation" ? "Generation" : "Upload"),
          publicUrl: row.public_url,
          createdAt: row.created_at,
        })),
        count: rows.length,
      }
    },
  })
}
