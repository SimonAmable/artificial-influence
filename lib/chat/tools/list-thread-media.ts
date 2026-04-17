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
      "List media for this chat thread (uploads + completed generations). Each item has a stable `id`—use those as `mediaIds` on generation tools, or pass a **video** row's `id` as **mediaId** to **extractVideoFrames**. **Required** whenever the user refers to visuals from earlier in the thread (not only current attachments): e.g. last image, previous generation, that render, edit the poster, same as before. Call before generateImage / generateImageWithNanoBanana / generateVideo when you need those ids. Never use `generationId` from an old tool output as `mediaIds`. Results are newest first.",
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
