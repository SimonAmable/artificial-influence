import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { DEFAULT_IMAGE_MODEL_IDENTIFIER } from "@/lib/constants/models"
import { filterPublicCatalogModels } from "@/lib/server/model-catalog-visibility"
import { parseAgentUsageGuide } from "@/lib/types/agent-usage"
import type { AgentUsageGuide } from "@/lib/types/models"

export type { AgentUsageGuide }

interface CreateModelsToolOptions {
  supabase: SupabaseClient
}

type ModelTypeFilter = "image" | "video" | "audio" | "upscale"

export type ListedModel = {
  aspectRatios: string[]
  defaultAspectRatio: string | null
  description: string | null
  identifier: string
  maxImages: number | null
  modelCost: number | null
  name: string
  provider: string | null
  supportsFirstFrame: boolean
  supportsLastFrame: boolean
  supportsReferenceAudio: boolean
  supportsReferenceImage: boolean
  supportsReferenceVideo: boolean
  type: ModelTypeFilter
  usageGuide: AgentUsageGuide | null
}

export async function loadActiveModels(supabase: SupabaseClient): Promise<ListedModel[]> {
  const { data, error } = await supabase
    .from("models")
    .select(
      "identifier, name, description, provider, type, model_cost, aspect_ratios, default_aspect_ratio, supports_reference_image, supports_reference_video, supports_reference_audio, supports_first_frame, supports_last_frame, max_images, agent_usage",
    )
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (error) {
    throw new Error(`Failed to list models: ${error.message}`)
  }

  const visibleRows = filterPublicCatalogModels(data ?? [])

  return visibleRows.map((model) => ({
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
    usageGuide: parseAgentUsageGuide(model.agent_usage),
  }))
}

function buildListModelsResponse(models: ListedModel[]) {
  return {
    defaultImageModel: DEFAULT_IMAGE_MODEL_IDENTIFIER,
    message:
      models.length > 0
        ? `Listed ${models.length} active model${models.length === 1 ? "" : "s"}.`
        : "No active models available.",
    models,
    total: models.length,
  }
}

/**
 * Serialises the active model list into a compact text block for direct
 * injection into the agent system prompt. This removes the need for the
 * agent to call listModels before every generation turn — the data is
 * already in context from step 0.
 */
export function buildActiveModelsSnapshotText(models: ListedModel[]): string {
  if (models.length === 0) {
    return `<active_models_snapshot>\nNo active models available.\n</active_models_snapshot>`
  }

  const groups: Partial<Record<string, ListedModel[]>> = {}
  for (const model of models) {
    if (!groups[model.type]) groups[model.type] = []
    groups[model.type]!.push(model)
  }

  const lines: string[] = [
    `default_image_model: ${DEFAULT_IMAGE_MODEL_IDENTIFIER}`,
    `total: ${models.length} active models`,
  ]

  for (const type of ["image", "video", "audio", "upscale"] as const) {
    const group = groups[type]
    if (!group || group.length === 0) continue

    lines.push(`\n[${type}]`)
    for (const model of group) {
      const caps: string[] = []
      if (model.supportsReferenceImage) caps.push("ref_image")
      if (model.supportsReferenceVideo) caps.push("ref_video")
      if (model.supportsReferenceAudio) caps.push("ref_audio")
      if (model.supportsFirstFrame) caps.push("first_frame")
      if (model.supportsLastFrame) caps.push("last_frame")

      const parts: string[] = [model.identifier, `"${model.name}"`]
      if (caps.length > 0) parts.push(`caps: ${caps.join(",")}`)
      if (model.aspectRatios.length > 0) parts.push(`aspects: ${model.aspectRatios.join(",")}`)
      if (model.defaultAspectRatio) parts.push(`default: ${model.defaultAspectRatio}`)
      if (model.maxImages != null && model.maxImages > 1) parts.push(`max: ${model.maxImages}`)

      lines.push(parts.join(" | "))

      if (model.usageGuide) {
        const g = model.usageGuide
        if (g.agentSummary) lines.push(`  summary: ${g.agentSummary}`)
        if (g.bestFor?.length) lines.push(`  best_for: ${g.bestFor.join(", ")}`)
        if (g.avoidFor?.length) lines.push(`  avoid_for: ${g.avoidFor.join(", ")}`)
        if (g.routingRules?.length) lines.push(`  routing: ${g.routingRules.join("; ")}`)
        if (g.promptGuidance?.length) lines.push(`  prompt_guidance: ${g.promptGuidance.join("; ")}`)
        if (g.pitfalls?.length) lines.push(`  pitfalls: ${g.pitfalls.join("; ")}`)
        if (g.inputSemantics) {
          const semantics = Object.entries(g.inputSemantics)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ")
          lines.push(`  input_semantics: ${semantics}`)
        }
        if (g.workflows?.length) {
          const activeWorkflows = g.workflows.filter((w) => w.active !== false)
          if (activeWorkflows.length > 0) {
            lines.push(`  workflows: ${activeWorkflows.map((w) => w.id).join(", ")}`)
          }
        }
      }
    }
  }

  return `<active_models_snapshot>\n${lines.join("\n")}\n</active_models_snapshot>`
}

export function createListModelsTool({ supabase }: CreateModelsToolOptions) {
  return tool({
    description:
      "List UniCan's active models. Use this when the user asks which models are available, which one supports a capability, or when you need a valid model identifier before generating an image, video, or audio asset. This tool accepts no search or filter parameters. Inspect the returned list and match by name or identifier yourself. For image models, the default image generation model is returned as `defaultImageModel` and is currently `openai/gpt-image-2`. The response includes model-specific `aspectRatios` and `usageGuide` when available, including optional workflow playbooks, so use those instead of guessing supported ratios, input semantics, and model-specific routing rules.",
    inputSchema: z.object({}),
    strict: true,
    execute: async () => buildListModelsResponse(await loadActiveModels(supabase)),
  })
}

export function createSearchModelsTool({ supabase }: CreateModelsToolOptions) {
  return tool({
    description:
      "Deprecated compatibility alias for `listModels`. Accepts the legacy `type` field only so older stored chat threads continue to validate, but it always returns the full active model list without filtering. New calls should use `listModels` instead.",
    inputSchema: z.object({
      type: z
        .enum(["image", "video", "audio", "upscale"])
        .optional()
        .describe("Legacy compatibility field. Ignored; this tool always returns the full active model list."),
    }),
    strict: true,
    execute: async () => buildListModelsResponse(await loadActiveModels(supabase)),
  })
}
