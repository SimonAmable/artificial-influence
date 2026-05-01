import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import {
  FALLBACK_LATENCY_SECONDS_BY_KIND,
  GENERATION_TIME_FALLBACK_DISCLAIMER,
} from "@/lib/constants/generation-time-estimates"

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))
  return sorted[idx] ?? null
}

async function loadLatencyStats(
  supabase: SupabaseClient,
  model: string,
  type: "image" | "video",
) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("generations")
    .select("created_at, finished_at")
    .eq("model", model)
    .eq("type", type)
    .eq("status", "completed")
    .not("finished_at", "is", null)
    .gte("created_at", since)
    .limit(500)

  if (error) {
    console.error("[estimateModelLatency] query failed:", error.message)
    return null
  }

  const rows = (data ?? []) as Array<{ created_at: string; finished_at: string | null }>
  const durationsSec: number[] = []
  for (const row of rows) {
    if (!row.finished_at) continue
    const start = new Date(row.created_at).getTime()
    const end = new Date(row.finished_at).getTime()
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue
    durationsSec.push((end - start) / 1000)
  }

  durationsSec.sort((a, b) => a - b)
  const sampleSize = durationsSec.length
  if (sampleSize < 3) {
    return null
  }

  return {
    p50Seconds: percentile(durationsSec, 0.5),
    p90Seconds: percentile(durationsSec, 0.9),
    sampleSize,
  }
}

interface CreateEstimateModelLatencyToolOptions {
  supabase: SupabaseClient
  userId: string
}

export function createEstimateModelLatencyTool({ supabase, userId }: CreateEstimateModelLatencyToolOptions) {
  return tool({
    description:
      "Estimate typical wall-clock time for a completed generation for a given model and type (image vs video), using recent completed jobs in this app. Use when setting user expectations before or after starting async generation. Falls back to broad defaults if sample size is small.",
    inputSchema: z.object({
      model: z.string().min(1).describe("Exact model identifier (e.g. from listModels)."),
      type: z.enum(["image", "video"]).describe("Generation type."),
    }),
    strict: true,
    execute: async ({ model, type }) => {
      void userId
      const stats = await loadLatencyStats(supabase, model, type)
      const fallback = FALLBACK_LATENCY_SECONDS_BY_KIND[type]

      if (stats?.p50Seconds != null && stats?.p90Seconds != null) {
        return {
          source: "database" as const,
          model,
          type,
          p50Seconds: Math.round(stats.p50Seconds * 10) / 10,
          p90Seconds: Math.round(stats.p90Seconds * 10) / 10,
          sampleSize: stats.sampleSize,
          disclaimer: GENERATION_TIME_FALLBACK_DISCLAIMER,
        }
      }

      return {
        source: "fallback" as const,
        model,
        type,
        p50Seconds: fallback.p50,
        p90Seconds: fallback.p90,
        sampleSize: 0,
        disclaimer: GENERATION_TIME_FALLBACK_DISCLAIMER,
      }
    },
  })
}
