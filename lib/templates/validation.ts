import { z } from "zod"
import type { OutputKind, TemplateCategory, TemplateInput, TemplateVisibility } from "@/lib/templates/types"

const templateInputBase = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
})

const templateInputSchema: z.ZodType<TemplateInput> = z.discriminatedUnion("kind", [
  templateInputBase.extend({
    kind: z.literal("image"),
    required: z.boolean(),
    helpText: z.string().max(500).optional(),
  }),
  templateInputBase.extend({
    kind: z.literal("video"),
    required: z.boolean(),
    helpText: z.string().max(500).optional(),
  }),
  templateInputBase.extend({
    kind: z.literal("audio"),
    required: z.boolean(),
    helpText: z.string().max(500).optional(),
  }),
  templateInputBase.extend({
    kind: z.literal("text"),
    required: z.boolean(),
    placeholder: z.string().max(500).optional(),
    multiline: z.boolean().optional(),
  }),
  templateInputBase.extend({
    kind: z.literal("boolean"),
    required: z.boolean(),
    default: z.boolean().optional(),
  }),
  templateInputBase.extend({
    kind: z.literal("aspect_ratio"),
    required: z.boolean(),
    default: z.enum(["auto", "9:16", "1:1", "16:9"]).optional(),
  }),
])

export const templateCategorySchema = z.enum([
  "photo",
  "video",
  "slideshow",
])

export const outputKindSchema = z.enum(["image", "video", "audio", "slideshow", "mixed"])

export const templateVisibilitySchema = z.enum(["private", "public"])

const templatePromptAttachmentSchema = z.object({
  url: z.string().url(),
  title: z.string().max(240).nullable().optional(),
})

export const createTemplateBodySchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase with hyphens"),
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  tips: z.string().max(500).nullable().optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  thumbnail_kind: z.enum(["image", "video"]).optional(),
  category: templateCategorySchema,
  prompt: z.string().min(1).max(8000),
  prompt_attachments: z.array(templatePromptAttachmentSchema).max(12).optional(),
  output_kind: outputKindSchema,
  inputs: z.array(templateInputSchema).max(20),
  credits_cost: z.number().int().min(0).max(10000).optional(),
  visibility: templateVisibilitySchema.optional(),
})

export const updateTemplateBodySchema = createTemplateBodySchema.partial()

export const templateRunValuesSchema = z.record(z.string(), z.unknown())

export function validateTemplateInputsUnique(inputs: TemplateInput[]): string | null {
  const ids = new Set<string>()
  for (const input of inputs) {
    if (ids.has(input.id)) {
      return `Duplicate field: ${input.label}`
    }
    ids.add(input.id)
  }
  return null
}

export function validatePromptPlaceholders(
  prompt: string,
  inputs: TemplateInput[],
): string | null {
  const placeholderPattern = /\{\{([a-z][a-z0-9_]*)\}\}/g
  const inputIds = new Set(inputs.map((i) => i.id))
  const matches = [...prompt.matchAll(placeholderPattern)]

  for (const match of matches) {
    const id = match[1]
    if (!inputIds.has(id)) {
      return `Instructions reference an unknown field. Use the insert buttons to add field references.`
    }
  }

  return null
}

export function isMediaInputKind(kind: TemplateInput["kind"]): boolean {
  return kind === "image" || kind === "video" || kind === "audio"
}

export function getDefaultInputValue(input: TemplateInput): string | boolean {
  switch (input.kind) {
    case "aspect_ratio":
      return input.default ?? "9:16"
    case "boolean":
      return input.default ?? false
    case "text":
      return ""
    default:
      return ""
  }
}

export type { TemplateCategory, TemplateVisibility, OutputKind }
