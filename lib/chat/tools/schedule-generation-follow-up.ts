import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

interface CreateScheduleGenerationFollowUpToolOptions {
  supabase: SupabaseClient
  threadId: string
  userId: string
}

export function createScheduleGenerationFollowUpTool({
  supabase,
  threadId,
  userId,
}: CreateScheduleGenerationFollowUpToolOptions) {
  return tool({
    description:
      "Schedule work to run automatically when a pending generation finishes (Replicate webhook). Use for long-running video/image jobs (often several minutes) when the user asked for a follow-up step that needs the finished file (e.g. save as Instagram draft, extract frames, chain to another tool). Do **not** use **awaitGeneration** for jobs likely to exceed ~60s; schedule a follow-up instead and tell the user the next step will run when ready. Requires the **generationId** UUID from **generateImage** / **generateVideo** (same row as the pending job). Only one follow-up per generation; if you need multiple steps, describe them all in **plan**. The plan must be self-contained (no user in the loop).",
    inputSchema: z.object({
      generationId: z.string().uuid().describe("UUID of the generations row (pending or just started)."),
      plan: z
        .string()
        .min(1)
        .max(12_000)
        .describe(
          "Concrete instructions for the automatic follow-up turn: which tools to call, mediaId format gen_<uuid>, captions, Instagram connection id if known, etc.",
        ),
    }),
    strict: true,
    execute: async ({ generationId, plan }) => {
      const { data: gen, error } = await supabase
        .from("generations")
        .select("id, chat_thread_id, user_id, status")
        .eq("id", generationId)
        .eq("user_id", userId)
        .maybeSingle()

      if (error) {
        throw new Error(error.message)
      }
      if (!gen) {
        return { status: "failed" as const, error: "Generation not found." }
      }
      if (gen.chat_thread_id != null && gen.chat_thread_id !== threadId) {
        return {
          status: "failed" as const,
          error: "That generation does not belong to this chat thread.",
        }
      }
      if (gen.chat_thread_id == null) {
        const { error: bindError } = await supabase
          .from("generations")
          .update({ chat_thread_id: threadId })
          .eq("id", generationId)
          .eq("user_id", userId)
        if (bindError) {
          throw new Error(bindError.message)
        }
      }

      const { error: insertError } = await supabase.from("generation_follow_ups").insert({
        user_id: userId,
        thread_id: threadId,
        generation_id: generationId,
        plan,
        status: "pending",
      })

      if (insertError) {
        if (insertError.code === "23505") {
          return {
            status: "failed" as const,
            error: "A follow-up is already scheduled for this generation.",
          }
        }
        throw new Error(insertError.message)
      }

      return {
        status: "scheduled" as const,
        generationId,
        message:
          "Follow-up scheduled. It will run automatically when this generation completes (no need to call awaitGeneration for this job).",
      }
    },
  })
}
