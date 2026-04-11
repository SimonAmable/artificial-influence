import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

interface CreateListRecentGenerationsToolOptions {
  supabase: SupabaseClient
  userId: string
}

type GenerationTypeFilter = "image" | "video" | "audio"

function normalizeForSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function scoreGenerationMatch(
  generation: {
    model: string | null
    prompt: string | null
    tool: string | null
    type: string
  },
  query: string,
) {
  if (!query) return 1

  const haystacks = [
    normalizeForSearch(generation.prompt ?? ""),
    normalizeForSearch(generation.model ?? ""),
    normalizeForSearch(generation.tool ?? ""),
    normalizeForSearch(generation.type),
  ]
  const normalizedQuery = normalizeForSearch(query)

  if (haystacks.some((value) => value === normalizedQuery)) return 100
  if (haystacks.some((value) => value.includes(normalizedQuery))) return 70

  const queryTokens = normalizedQuery.split(" ").filter(Boolean)
  const overlap = haystacks.reduce((best, value) => {
    const tokenCount = queryTokens.filter((token) => value.includes(token)).length
    return Math.max(best, tokenCount)
  }, 0)

  return overlap > 0 ? 30 + overlap * 10 : 0
}

function getPublicUrl(supabase: SupabaseClient, storagePath: string | null) {
  if (!storagePath) return null
  return supabase.storage.from("public-bucket").getPublicUrl(storagePath).data.publicUrl
}

export function createListRecentGenerationsTool({
  supabase,
  userId,
}: CreateListRecentGenerationsToolOptions) {
  return tool({
    description:
      "List the user's recent generations from chat and history. Use this when the user refers to a past render, wants to reuse or save an earlier output, asks about their last generation, or when you need a generation id before saving it as an asset.",
    inputSchema: z.object({
      query: z
        .string()
        .max(120)
        .optional()
        .describe("Optional text to narrow results, such as redhead portrait, nano banana, latest video, or thumbnail."),
      type: z
        .enum(["image", "video", "audio"])
        .optional()
        .describe("Optional generation type filter."),
      includePending: z
        .boolean()
        .optional()
        .describe("Whether to include pending generations. Defaults to false."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(12)
        .optional()
        .describe("Maximum number of recent generations to return."),
    }),
    strict: true,
    execute: async ({ includePending = false, limit = 6, query, type }) => {
      let dbQuery = supabase
        .from("generations")
        .select(
          "id, prompt, model, tool, type, status, supabase_storage_path, created_at, aspect_ratio, replicate_prediction_id, error_message",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(Math.max(limit * 4, 24))

      if (type) {
        dbQuery = dbQuery.eq("type", type)
      }

      if (!includePending) {
        dbQuery = dbQuery.neq("status", "pending")
      }

      const { data, error } = await dbQuery

      if (error) {
        throw new Error(`Failed to load recent generations: ${error.message}`)
      }

      const rows = (data ?? []).map((generation) => ({
        aspectRatio:
          typeof generation.aspect_ratio === "string" ? generation.aspect_ratio : null,
        createdAt: String(generation.created_at),
        errorMessage:
          typeof generation.error_message === "string" ? generation.error_message : null,
        id: String(generation.id),
        model: typeof generation.model === "string" ? generation.model : null,
        predictionId:
          typeof generation.replicate_prediction_id === "string"
            ? generation.replicate_prediction_id
            : null,
        prompt: typeof generation.prompt === "string" ? generation.prompt : null,
        status:
          generation.status === "pending" ||
          generation.status === "completed" ||
          generation.status === "failed"
            ? generation.status
            : "completed",
        tool: typeof generation.tool === "string" ? generation.tool : null,
        type: generation.type as GenerationTypeFilter,
        url: getPublicUrl(
          supabase,
          typeof generation.supabase_storage_path === "string"
            ? generation.supabase_storage_path
            : null,
        ),
      }))

      const generationIds = rows.map((row) => row.id)
      const assetMap = new Map<
        string,
        {
          id: string
          title: string
          visibility: "private" | "public"
        }
      >()

      if (generationIds.length > 0) {
        const { data: assetRows, error: assetError } = await supabase
          .from("assets")
          .select("id, title, visibility, source_generation_id")
          .eq("user_id", userId)
          .in("source_generation_id", generationIds)
          .order("created_at", { ascending: false })

        if (assetError) {
          throw new Error(`Failed to load linked assets: ${assetError.message}`)
        }

        for (const asset of assetRows ?? []) {
          const generationId =
            typeof asset.source_generation_id === "string" ? asset.source_generation_id : null

          if (!generationId || assetMap.has(generationId)) {
            continue
          }

          assetMap.set(generationId, {
            id: String(asset.id),
            title: String(asset.title ?? "Saved Asset"),
            visibility: asset.visibility === "public" ? "public" : "private",
          })
        }
      }

      const normalizedQuery = (query ?? "").trim()
      const generations = rows
        .map((generation) => ({
          ...generation,
          linkedAsset: assetMap.get(generation.id) ?? null,
          score: scoreGenerationMatch(generation, normalizedQuery),
        }))
        .filter((generation) => normalizedQuery.length === 0 || generation.score > 0)
        .sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map(({ score: _score, ...generation }) => generation)

      return {
        generations,
        message:
          generations.length > 0
            ? `Found ${generations.length} recent generation${generations.length === 1 ? "" : "s"}.`
            : "No recent generations matched that search.",
        query: query ?? null,
        total: generations.length,
        type: type ?? null,
      }
    },
  })
}
