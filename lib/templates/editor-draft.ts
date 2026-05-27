import { z } from "zod"
import type { Template } from "@/lib/templates/types"
import type { DraftTemplateInput } from "@/lib/templates/input-utils"
import { assignInputIds } from "@/lib/templates/input-utils"

const templateDraftInputBaseSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/, "Field ids must be snake_case")
    .optional(),
  label: z.string().min(1).max(120),
})

export const templateDraftInputSchema = z.discriminatedUnion("kind", [
  templateDraftInputBaseSchema.extend({
    kind: z.literal("image"),
    required: z.boolean(),
    helpText: z.string().max(500).optional(),
  }),
  templateDraftInputBaseSchema.extend({
    kind: z.literal("video"),
    required: z.boolean(),
    helpText: z.string().max(500).optional(),
  }),
  templateDraftInputBaseSchema.extend({
    kind: z.literal("audio"),
    required: z.boolean(),
    helpText: z.string().max(500).optional(),
  }),
  templateDraftInputBaseSchema.extend({
    kind: z.literal("text"),
    required: z.boolean(),
    placeholder: z.string().max(500).optional(),
    multiline: z.boolean().optional(),
  }),
  templateDraftInputBaseSchema.extend({
    kind: z.literal("boolean"),
    required: z.boolean(),
    default: z.boolean().optional(),
  }),
  templateDraftInputBaseSchema.extend({
    kind: z.literal("aspect_ratio"),
    required: z.boolean(),
    default: z.enum(["auto", "9:16", "1:1", "16:9"]).optional(),
  }),
])

export const templateEditorDraftSchema = z.object({
  title: z.string().max(120),
  description: z.string().max(2000),
  tips: z.string().max(500),
  category: z.enum(["photo", "video", "slideshow"]),
  output_kind: z.enum(["image", "video", "audio"]),
  prompt: z.string().max(8000),
  inputs: z.array(templateDraftInputSchema).max(20),
  visibility: z.enum(["private", "public"]),
  thumbnail_url: z.string().url().nullable(),
  thumbnail_kind: z.enum(["image", "video"]),
})

export type TemplateEditorDraft = z.infer<typeof templateEditorDraftSchema>

export function createEmptyTemplateEditorDraft(): TemplateEditorDraft {
  return {
    title: "",
    description: "",
    tips: "",
    category: "photo",
    output_kind: "image",
    prompt: "",
    inputs: [],
    visibility: "private",
    thumbnail_url: null,
    thumbnail_kind: "image",
  }
}

export function createTemplateEditorDraftFromTemplate(template: Template): TemplateEditorDraft {
  return {
    title: template.title,
    description: template.description,
    tips: template.tips ?? "",
    category: template.category,
    output_kind: template.output_kind === "slideshow" || template.output_kind === "mixed"
      ? "image"
      : template.output_kind,
    prompt: template.prompt,
    inputs: template.inputs.map((input) => ({ ...input })) as DraftTemplateInput[],
    visibility: template.visibility,
    thumbnail_url: template.thumbnail_url,
    thumbnail_kind: template.thumbnail_kind,
  }
}

export function normalizeTemplateEditorDraft(
  draft: Partial<TemplateEditorDraft> | null | undefined,
): TemplateEditorDraft {
  const base = createEmptyTemplateEditorDraft()

  const next: TemplateEditorDraft = {
    ...base,
    ...draft,
    title: draft?.title ?? base.title,
    description: draft?.description ?? base.description,
    tips: draft?.tips ?? base.tips,
    category: draft?.category ?? base.category,
    output_kind: draft?.output_kind ?? base.output_kind,
    prompt: draft?.prompt ?? base.prompt,
    visibility: draft?.visibility ?? base.visibility,
    thumbnail_url: draft?.thumbnail_url ?? base.thumbnail_url,
    thumbnail_kind: draft?.thumbnail_kind ?? base.thumbnail_kind,
    inputs: Array.isArray(draft?.inputs)
      ? (draft.inputs.map((input) => ({ ...input })) as DraftTemplateInput[])
      : base.inputs,
  }

  next.inputs = assignInputIds(next.inputs).map((input) => ({ ...input }))
  return next
}
