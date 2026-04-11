import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

interface CreateSearchModelsToolOptions {
  supabase: SupabaseClient
}

type ModelTypeFilter = "image" | "video" | "audio" | "upscale"

const SEARCH_STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "for",
  "with",
  "use",
  "using",
  "model",
  "models",
  "image",
  "images",
  "video",
  "videos",
  "audio",
])

function normalizeForSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokenizeSearchTerms(value: string) {
  return normalizeForSearch(value)
    .split(" ")
    .filter((token) => token.length > 0 && !SEARCH_STOP_WORDS.has(token))
}

function scoreModelMatch(
  model: {
    identifier: string
    name: string
    description: string | null
    provider: string | null
    supportsReferenceAudio?: boolean
  },
  query: string,
) {
  if (!query) return 1

  const capabilityHints: string[] = []
  if (model.supportsReferenceAudio) {
    capabilityHints.push("reference audio", "audio reference", "soundtrack")
  }

  const rawHaystacks = [
    ...capabilityHints,
    model.name.toLowerCase(),
    model.identifier.toLowerCase(),
    (model.description ?? "").toLowerCase(),
    (model.provider ?? "").toLowerCase(),
  ]
  const normalizedHaystacks = rawHaystacks.map(normalizeForSearch)
  const normalizedQuery = normalizeForSearch(query)

  if (rawHaystacks.some((value) => value === query) || normalizedHaystacks.some((value) => value === normalizedQuery)) {
    return 120
  }

  if (rawHaystacks.some((value) => value.includes(query)) || normalizedHaystacks.some((value) => value.includes(normalizedQuery))) {
    return 90
  }

  const queryTokens = tokenizeSearchTerms(query)
  if (queryTokens.length === 0) {
    return normalizedHaystacks.some((value) => value.includes(normalizedQuery)) ? 60 : 0
  }

  const overlap = normalizedHaystacks.reduce((best, value) => {
    const tokenCount = queryTokens.filter((token) => value.includes(token)).length
    return Math.max(best, tokenCount)
  }, 0)

  if (overlap === queryTokens.length) {
    return 70 + overlap * 8
  }

  return overlap > 0 ? 35 + overlap * 10 : 0
}

export function createSearchModelsTool({ supabase }: CreateSearchModelsToolOptions) {
  return tool({
    description:
      "Search UniCan's active models. Use this when the user asks which models are available, which one supports a capability, or when you need a valid model identifier before generating an image, video, or audio asset.",
    inputSchema: z.object({
      query: z
        .string()
        .max(120)
        .optional()
        .describe("Optional search text such as nano banana, text-heavy poster, start frame, or fast image edit."),
      type: z
        .enum(["image", "video", "audio", "upscale"])
        .optional()
        .describe("Optional model type filter."),
    }),
    strict: true,
    execute: async ({ query, type }) => {
      let dbQuery = supabase
        .from("models")
        .select(
          "identifier, name, description, provider, type, model_cost, default_aspect_ratio, supports_reference_image, supports_reference_video, supports_reference_audio, supports_first_frame, supports_last_frame, max_images",
        )
        .eq("is_active", true)
        .order("name", { ascending: true })

      if (type) {
        dbQuery = dbQuery.eq("type", type)
      }

      const { data, error } = await dbQuery

      if (error) {
        throw new Error(`Failed to search models: ${error.message}`)
      }

      const normalizedQuery = (query ?? "").trim().toLowerCase()
      const models = (data ?? [])
        .map((model) => ({
          defaultAspectRatio:
            typeof model.default_aspect_ratio === "string" ? model.default_aspect_ratio : null,
          description: typeof model.description === "string" ? model.description : null,
          identifier: String(model.identifier),
          maxImages:
            typeof model.max_images === "number"
              ? model.max_images
              : model.max_images != null
                ? Number(model.max_images)
                : null,
          modelCost:
            typeof model.model_cost === "number"
              ? model.model_cost
              : model.model_cost != null
                ? Number(model.model_cost)
                : null,
          name: String(model.name),
          provider: typeof model.provider === "string" ? model.provider : null,
          supportsFirstFrame: Boolean(model.supports_first_frame),
          supportsLastFrame: Boolean(model.supports_last_frame),
          supportsReferenceAudio: Boolean(model.supports_reference_audio),
          supportsReferenceImage: Boolean(model.supports_reference_image),
          supportsReferenceVideo: Boolean(model.supports_reference_video),
          type: model.type as ModelTypeFilter,
        }))
        .map((model) => ({
          ...model,
          score: scoreModelMatch(model, normalizedQuery),
        }))
        .filter((model) => normalizedQuery.length === 0 || model.score > 0)
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
        .map(({ score: _score, ...model }) => model)

      return {
        message:
          models.length > 0
            ? `Found ${models.length} active ${type ?? ""} model${models.length === 1 ? "" : "s"}.`
            : "No active models matched that search.",
        models,
        query: query ?? null,
        total: models.length,
        type: type ?? null,
      }
    },
  })
}
