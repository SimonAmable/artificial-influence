import { NextRequest, NextResponse } from "next/server"
import { generateObject } from "ai"
import { z } from "zod"
import {
  AI_GATEWAY_CONFIG_ERROR,
  createAIGatewayProvider,
  hasAIGatewayCredentials,
} from "@/lib/ai/gateway"
import { createClient } from "@/lib/supabase/server"
import {
  createEmptyTemplateEditorDraft,
  normalizeTemplateEditorDraft,
  templateEditorDraftSchema,
} from "@/lib/templates/editor-draft"
import { assignInputIds } from "@/lib/templates/input-utils"
import {
  validatePromptPlaceholders,
  validateTemplateInputsUnique,
} from "@/lib/templates/validation"

const templateAuthoringRequestSchema = z.object({
  mode: z.enum(["create", "edit"]).default("create"),
  instruction: z.string().trim().min(1).max(4000),
  currentDraft: templateEditorDraftSchema.optional(),
})

const templateAuthoringOutputInputBaseSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/, "Field ids must be snake_case"),
  label: z.string().min(1).max(120),
})

const templateAuthoringOutputInputSchema = z.discriminatedUnion("kind", [
  templateAuthoringOutputInputBaseSchema.extend({
    kind: z.literal("image"),
    required: z.boolean(),
    helpText: z.string().max(500).optional(),
  }),
  templateAuthoringOutputInputBaseSchema.extend({
    kind: z.literal("video"),
    required: z.boolean(),
    helpText: z.string().max(500).optional(),
  }),
  templateAuthoringOutputInputBaseSchema.extend({
    kind: z.literal("audio"),
    required: z.boolean(),
    helpText: z.string().max(500).optional(),
  }),
  templateAuthoringOutputInputBaseSchema.extend({
    kind: z.literal("text"),
    required: z.boolean(),
    placeholder: z.string().max(500).optional(),
    multiline: z.boolean().optional(),
  }),
  templateAuthoringOutputInputBaseSchema.extend({
    kind: z.literal("boolean"),
    required: z.boolean(),
    default: z.boolean().optional(),
  }),
  templateAuthoringOutputInputBaseSchema.extend({
    kind: z.literal("aspect_ratio"),
    required: z.boolean(),
    default: z.enum(["auto", "9:16", "1:1", "16:9"]).optional(),
  }),
])

const templateAuthoringResultSchema = z.object({
  summary: z.string().min(1).max(240),
  draft: templateEditorDraftSchema.extend({
    inputs: z.array(templateAuthoringOutputInputSchema).max(20),
  }),
})

const TEMPLATE_AUTHORING_MODEL = "google/gemini-2.5-flash"

function buildTemplateAuthoringPrompt(input: {
  mode: "create" | "edit"
  instruction: string
  currentDraft: ReturnType<typeof createEmptyTemplateEditorDraft>
}) {
  const modeGuidance =
    input.mode === "edit"
      ? "You are editing an existing template draft. Make the smallest set of changes needed to satisfy the user's request. Preserve ids, visibility, and cover media unless the user clearly asked to change them."
      : "You are creating a new template draft from scratch. Fill in a complete draft the editor can open immediately."

  return [
    "You are helping build template drafts for UniCan, an AI content creation app.",
    modeGuidance,
    "Return a complete template draft and a one-sentence summary.",
    "Supported output_kind values: image, video, audio.",
    "Supported category values: photo, video, slideshow.",
    "Supported input kinds: image, video, audio, text, boolean, aspect_ratio.",
    "Every input must have a short snake_case id. The prompt may reference only those ids with {{field_id}} placeholders.",
    "Image, video, and audio inputs are attached automatically at run time, so do not force placeholders for them unless the user explicitly asked for that.",
    "Use placeholders mainly for text, boolean, and aspect_ratio fields when the AI needs those values in the instructions.",
    "Keep the user-facing title concise. Keep tips short and practical.",
    "Do not invent thumbnails. Keep thumbnail_url and thumbnail_kind unchanged unless the user explicitly asked to change them.",
    "Avoid making templates public unless the user explicitly asked for that.",
    `User request: ${input.instruction}`,
    `Current draft JSON:\n${JSON.stringify(input.currentDraft, null, 2)}`,
  ].join("\n\n")
}

export async function POST(request: NextRequest) {
  try {
    if (!hasAIGatewayCredentials()) {
      return NextResponse.json({ error: AI_GATEWAY_CONFIG_ERROR }, { status: 500 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = templateAuthoringRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const currentDraft = normalizeTemplateEditorDraft(
      parsed.data.currentDraft ?? createEmptyTemplateEditorDraft(),
    )

    const gateway = createAIGatewayProvider()
    const { object } = await generateObject({
      model: gateway(TEMPLATE_AUTHORING_MODEL),
      schema: templateAuthoringResultSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildTemplateAuthoringPrompt({
                mode: parsed.data.mode,
                instruction: parsed.data.instruction,
                currentDraft,
              }),
            },
          ],
        },
      ],
    })

    const draft = normalizeTemplateEditorDraft(object.draft)
    const resolvedInputs = assignInputIds(draft.inputs)

    const duplicateError = validateTemplateInputsUnique(resolvedInputs)
    if (duplicateError) {
      return NextResponse.json(
        { error: `AI returned an invalid draft: ${duplicateError}` },
        { status: 422 },
      )
    }

    const placeholderError = validatePromptPlaceholders(draft.prompt, resolvedInputs)
    if (placeholderError) {
      return NextResponse.json(
        { error: `AI returned an invalid draft: ${placeholderError}` },
        { status: 422 },
      )
    }

    return NextResponse.json({
      draft: {
        ...draft,
        inputs: resolvedInputs.map((input) => ({ ...input })),
      },
      summary: object.summary,
    })
  } catch (error) {
    console.error("[templates/ai/draft] POST error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate template draft",
      },
      { status: 500 },
    )
  }
}
