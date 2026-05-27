import { tool } from "ai"
import { z } from "zod"
import {
  createTemplate,
  getTemplateById,
  getTemplateBySlugForUser,
  searchTemplatesForUser,
  updateTemplate,
} from "@/lib/templates/database-server"
import { buildTemplateSlug } from "@/lib/templates/types"
import {
  createTemplateBodySchema,
  updateTemplateBodySchema,
  validatePromptPlaceholders,
  validateTemplateInputsUnique,
} from "@/lib/templates/validation"

interface CreateManageTemplateToolOptions {
  userId: string
}

const templateSearchScopeSchema = z.enum(["mine", "public", "all"])
const manageTemplateCreateSchema = createTemplateBodySchema.extend({
  slug: createTemplateBodySchema.shape.slug.optional(),
})

const manageTemplateInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("search"),
    query: z.string().trim().max(200).optional(),
    scope: templateSearchScopeSchema.optional(),
    category: z.enum(["all", "photo", "video", "slideshow"]).optional(),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  z
    .object({
      action: z.literal("get"),
      templateId: z.string().min(1).optional(),
      slug: z.string().trim().min(1).optional(),
    })
    .refine((input) => input.templateId || input.slug, {
      message: "Provide templateId or slug",
      path: ["templateId"],
    }),
  z.object({
    action: z.literal("create"),
    template: manageTemplateCreateSchema,
  }),
  z
    .object({
      action: z.literal("update"),
      templateId: z.string().min(1),
      changes: updateTemplateBodySchema,
    })
    .refine((input) => Object.keys(input.changes).length > 0, {
      message: "Provide at least one field to update",
      path: ["changes"],
    }),
])

function toTemplateSummary(template: {
  id: string
  slug: string
  title: string
  description: string
  visibility: string
  category: string
  output_kind: string
  updated_at: string
  creator_id: string
}, currentUserId: string) {
  return {
    id: template.id,
    slug: template.slug,
    title: template.title,
    description: template.description,
    visibility: template.visibility,
    category: template.category,
    outputKind: template.output_kind,
    updatedAt: template.updated_at,
    editUrl: `/templates/edit/${template.id}`,
    runUrl: `/templates/${template.slug}`,
    creatorId: template.creator_id,
    isOwner: template.creator_id === currentUserId,
  }
}

export function createManageTemplateTool({ userId }: CreateManageTemplateToolOptions) {
  return tool({
    description:
      "Search, inspect, create, or update AI content templates. Use this when the user wants a reusable gallery workflow, wants to find one of their templates, or wants to edit a template they own.",
    inputSchema: manageTemplateInputSchema,
    execute: async (input) => {
      try {
        if (input.action === "search") {
          const templates = await searchTemplatesForUser(userId, {
            query: input.query,
            scope: input.scope ?? "all",
            category: input.category ?? "all",
            limit: input.limit ?? 8,
          })

          return {
            status: "ok" as const,
            action: input.action,
            total: templates.length,
            templates: templates.map((template) => toTemplateSummary(template, userId)),
            message:
              templates.length > 0
                ? `Found ${templates.length} matching template${templates.length === 1 ? "" : "s"}.`
                : "No matching templates found.",
          }
        }

        if (input.action === "get") {
          const template = input.templateId
            ? await getTemplateById(input.templateId, userId)
            : await getTemplateBySlugForUser(input.slug!, userId)

          if (!template) {
            return {
              status: "error" as const,
              action: input.action,
              message: "Template not found",
            }
          }

          return {
            status: "ok" as const,
            action: input.action,
            template: {
              ...toTemplateSummary(template, userId),
              prompt: template.prompt,
              inputs: template.inputs,
              tips: template.tips,
              thumbnailUrl: template.thumbnail_url,
              thumbnailKind: template.thumbnail_kind,
              creditsCost: template.credits_cost,
            },
            message: `Loaded template "${template.title}".`,
          }
        }

        if (input.action === "create") {
          const duplicateError = validateTemplateInputsUnique(input.template.inputs)
          if (duplicateError) {
            return { status: "error" as const, action: input.action, message: duplicateError }
          }

          const placeholderError = validatePromptPlaceholders(
            input.template.prompt,
            input.template.inputs,
          )
          if (placeholderError) {
            return { status: "error" as const, action: input.action, message: placeholderError }
          }

          const slug = input.template.slug?.trim() || buildTemplateSlug(input.template.title)
          const template = await createTemplate(userId, {
            ...input.template,
            slug,
            visibility: input.template.visibility ?? "private",
          })

          return {
            status: "ok" as const,
            action: input.action,
            template: toTemplateSummary(template, userId),
            message: `Template "${template.title}" created (${template.visibility}).`,
          }
        }

        const existing = await getTemplateById(input.templateId, userId)
        if (!existing || existing.creator_id !== userId) {
          return {
            status: "error" as const,
            action: input.action,
            message: "Template not found",
          }
        }

        const nextInputs = input.changes.inputs ?? existing.inputs
        const nextPrompt = input.changes.prompt ?? existing.prompt

        if (input.changes.inputs) {
          const duplicateError = validateTemplateInputsUnique(input.changes.inputs)
          if (duplicateError) {
            return { status: "error" as const, action: input.action, message: duplicateError }
          }
        }

        const placeholderError = validatePromptPlaceholders(nextPrompt, nextInputs)
        if (placeholderError) {
          return { status: "error" as const, action: input.action, message: placeholderError }
        }

        const nextVisibility = input.changes.visibility ?? existing.visibility
        const nextThumbnail = input.changes.thumbnail_url ?? existing.thumbnail_url
        if (nextVisibility === "public" && !nextThumbnail) {
          return {
            status: "error" as const,
            action: input.action,
            message: "Thumbnail is required to publish a public template",
          }
        }

        const template = await updateTemplate(input.templateId, userId, input.changes)

        return {
          status: "ok" as const,
          action: input.action,
          template: toTemplateSummary(template, userId),
          message: `Template "${template.title}" updated.`,
        }
      } catch (error) {
        return {
          status: "error" as const,
          action: input.action,
          message: error instanceof Error ? error.message : "Failed to manage template",
        }
      }
    },
  })
}
