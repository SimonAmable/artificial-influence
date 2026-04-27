import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { DEFAULT_IMAGE_MODEL_IDENTIFIER } from "@/lib/constants/models"
import { filterPublicCatalogModels } from "@/lib/server/model-catalog-visibility"

interface CreateSearchModelsToolOptions {
  supabase: SupabaseClient
}

type ModelTypeFilter = "image" | "video" | "audio" | "upscale"

export function createSearchModelsTool({ supabase }: CreateSearchModelsToolOptions) {
  return tool({
    description:
      "List UniCan's active models (optional type filter). Use this when the user asks which models are available, which one supports a capability, or when you need a valid model identifier before generating an image, video, or audio asset. For image models, the default image generation model is returned as `defaultImageModel` and is currently `openai/gpt-image-2`. The response includes model-specific `aspectRatios` and `usageGuide` when available, so use those instead of guessing supported ratios, input semantics, and model-specific routing rules. There is no text search. Inspect the returned list and match by name or identifier yourself.",
    inputSchema: z.object({
      type: z
        .enum(["image", "video", "audio", "upscale"])
        .optional()
        .describe("Optional model type filter. Omit to list all active models."),
    }),
    strict: true,
    execute: async ({ type }) => {
      let dbQuery = supabase
        .from("models")
        .select(
          "identifier, name, description, provider, type, model_cost, aspect_ratios, default_aspect_ratio, supports_reference_image, supports_reference_video, supports_reference_audio, supports_first_frame, supports_last_frame, max_images, agent_usage",
        )
        .eq("is_active", true)
        .order("name", { ascending: true })

      if (type) {
        dbQuery = dbQuery.eq("type", type)
      }

      const { data, error } = await dbQuery

      if (error) {
        throw new Error(`Failed to list models: ${error.message}`)
      }

      const visibleRows = filterPublicCatalogModels(data ?? [])

      const models = visibleRows.map((model) => ({
        aspectRatios: Array.isArray(model.aspect_ratios)
          ? model.aspect_ratios.filter((value): value is string => typeof value === "string")
          : [],
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
        usageGuide:
          model.agent_usage && typeof model.agent_usage === "object" && !Array.isArray(model.agent_usage)
            ? model.agent_usage
            : null,
      }))

      return {
        defaultImageModel:
          type === "image" || type == null ? DEFAULT_IMAGE_MODEL_IDENTIFIER : null,
        message:
          models.length > 0
            ? `Listed ${models.length} active ${type ?? ""} model${models.length === 1 ? "" : "s"}.`
            : "No active models for that filter.",
        models,
        total: models.length,
        type: type ?? null,
      }
    },
  })
}
