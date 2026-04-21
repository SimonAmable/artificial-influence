import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { formatGenerationMediaId } from "@/lib/chat/media-id"

const POLL_MS_MIN = 2000
const POLL_MS_MAX = 6000
const MAX_ROUTE_MS = 280_000
const IMAGE_CAP_MS = 60_000
const VIDEO_CAP_MS = 90_000

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

function inferMime(type: "image" | "video", storagePath: string) {
  const lower = storagePath.toLowerCase()
  if (type === "video") {
    if (lower.endsWith(".webm")) return "video/webm"
    if (lower.endsWith(".mov")) return "video/quicktime"
    return "video/mp4"
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".png")) return "image/png"
  return "image/png"
}

type AgentTurnContext = { turnStartedAtMs?: number }

interface CreateAwaitGenerationToolOptions {
  supabase: SupabaseClient
  userId: string
}

export function createAwaitGenerationTool({ supabase, userId }: CreateAwaitGenerationToolOptions) {
  return tool({
    description:
      "Wait (poll) until a pending Replicate generation completes or fails, up to a bounded time (image cap: 60s, video cap: 90s). **Only** when a **chain** needs the finished file in the **same** turn (otherwise skip — UI updates alone). **Images:** this is the correct wait path when chaining (e.g. image then video/draft/tools); never use scheduleGenerationFollowUp for images. **Video:** use when the next tool needs the file and the job can plausibly complete within ~90s; for long models (e.g. Kling Motion Control, Seedance 2.0) that need a chained next step after many minutes, use scheduleGenerationFollowUp instead. Requires predictionId from generateImage/generateVideo pending output, or a generations table id. Do not call twice for the same prediction. If this returns timeout, tell the user the UI will keep updating.",
    inputSchema: z
      .object({
        predictionId: z
          .string()
          .min(1)
          .optional()
          .describe("Replicate prediction id from a pending generateImage / generateVideo tool result."),
        generationId: z
          .string()
          .uuid()
          .optional()
          .describe("Alternative: UUID from the generations row."),
        maxWaitSeconds: z
          .number()
          .min(5)
          .max(120)
          .optional()
          .describe("Max seconds to poll (server clamps by medium and route budget)."),
        pollIntervalSeconds: z
          .number()
          .min(2)
          .max(8)
          .optional()
          .describe("Seconds between polls (default ~4)."),
      })
      .refine((v) => Boolean(v.predictionId?.trim()) || Boolean(v.generationId), {
        message: "Provide predictionId or generationId.",
      }),
    strict: true,
    execute: async ({ predictionId, generationId, maxWaitSeconds, pollIntervalSeconds }, options) => {
      const ctx = options.experimental_context as AgentTurnContext | undefined
      const turnStart = typeof ctx?.turnStartedAtMs === "number" ? ctx.turnStartedAtMs : Date.now()

      const pollMs = Math.min(
        POLL_MS_MAX,
        Math.max(POLL_MS_MIN, Math.round((pollIntervalSeconds ?? 4) * 1000)),
      )

      const deadline = Date.now() + MAX_ROUTE_MS - (Date.now() - turnStart) - 3000

      let capMs = VIDEO_CAP_MS
      const started = Date.now()

      const fetchRows = async () => {
        if (generationId) {
          const { data, error } = await supabase
            .from("generations")
            .select(
              "id, status, error_message, supabase_storage_path, type, replicate_prediction_id, finished_at",
            )
            .eq("user_id", userId)
            .eq("id", generationId)
            .maybeSingle()
          if (error) throw new Error(error.message)
          return data ? [data] : []
        }

        const pid = predictionId!.trim()
        const { data, error } = await supabase
          .from("generations")
          .select(
            "id, status, error_message, supabase_storage_path, type, replicate_prediction_id, finished_at, created_at",
          )
          .eq("user_id", userId)
          .eq("replicate_prediction_id", pid)
          .order("created_at", { ascending: true })

        if (error) throw new Error(error.message)
        return (data ?? []) as Array<{
          id: string
          status: string
          error_message: string | null
          supabase_storage_path: string | null
          type: "image" | "video"
          replicate_prediction_id: string | null
          finished_at: string | null
        }>
      }

      const first = await fetchRows()
      if (first.length === 0) {
        return { status: "failed" as const, error: "No matching generation row found." }
      }

      const primary = first[0]!
      capMs = primary.type === "video" ? VIDEO_CAP_MS : IMAGE_CAP_MS
      const userCapMs = Math.min(
        capMs,
        Math.round((maxWaitSeconds ?? (primary.type === "video" ? 90 : 60)) * 1000),
      )

      const effectiveDeadline = Math.min(deadline, started + userCapMs)

      const isPending = (rows: typeof first) => rows.some((r) => r.status === "pending")

      let rows = first
      const computeAggregateStatus = (r: typeof rows) => {
        if (r.some((row) => row.status === "failed")) return "failed" as const
        if (r.some((row) => row.status === "completed")) return "completed" as const
        return "pending" as const
      }
      let lastStatus = computeAggregateStatus(rows)

      while (Date.now() < effectiveDeadline && isPending(rows)) {
        await sleep(pollMs)
        rows = await fetchRows()
        if (rows.length === 0) break
        lastStatus = computeAggregateStatus(rows)
      }

      if (rows.length === 0) {
        return {
          status: "failed" as const,
          error: "Generation rows disappeared while polling.",
        }
      }

      const failed = rows.find((r) => r.status === "failed")
      if (failed) {
        return {
          status: "failed" as const,
          generationId: failed.id,
          error: failed.error_message ?? "Generation failed.",
        }
      }

      const completed = rows.find((r) => r.status === "completed" && r.supabase_storage_path)
      if (completed?.supabase_storage_path) {
        const url = supabase.storage
          .from("public-bucket")
          .getPublicUrl(completed.supabase_storage_path).data.publicUrl

        return {
          status: "completed" as const,
          generationId: completed.id,
          mediaId: formatGenerationMediaId(completed.id),
          url,
          mimeType: inferMime(completed.type, completed.supabase_storage_path),
          kind: completed.type,
        }
      }

      return {
        status: "timeout" as const,
        generationId: primary.id,
        lastStatus,
        message:
          "Generation is still pending or storage is not ready. The chat UI will update when it completes; do not loop awaitGeneration in the same turn.",
      }
    },
  })
}
