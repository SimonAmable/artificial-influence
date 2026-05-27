import { generateObject } from "ai"
import { z } from "zod"

import {
  AI_GATEWAY_CONFIG_ERROR,
  createAIGatewayProvider,
  hasAIGatewayCredentials,
} from "@/lib/ai/gateway"
import { validateExternalReferenceUrl } from "@/lib/server/external-reference-url"

export const ANALYZE_MEDIA_VISION_MODEL = "google/gemini-3.1-flash-lite" as const
export const MAX_ANALYZE_MEDIA_IMAGES = 8
export const MAX_ANALYZE_MEDIA_BYTES = 10 * 1024 * 1024

export const ANALYZE_MEDIA_FOCUS_VALUES = [
  "general",
  "style",
  "recreation",
  "prompt_pack",
] as const

export type AnalyzeMediaFocus = (typeof ANALYZE_MEDIA_FOCUS_VALUES)[number]

export type AnalyzeMediaImageInput = {
  filename?: string
  mediaType?: string
  url: string
}

export const analyzeMediaAnalysisSchema = z.object({
  summary: z
    .string()
    .describe("2-4 sentence overview the creative agent can rely on in the next reply."),
  subjects: z
    .array(z.string())
    .describe("Main subjects, people, products, or focal elements."),
  composition: z.string().describe("Framing, layout, depth, and visual hierarchy."),
  lighting: z
    .string()
    .describe("Lighting direction, quality, and time-of-day feel if inferable."),
  colorPalette: z.array(z.string()).describe("Dominant colors or palette descriptors."),
  mood: z.string().describe("Overall mood or emotional tone."),
  visibleText: z
    .array(z.string())
    .optional()
    .describe("Readable text, logos, captions, stickers, or UI overlays."),
  styleNotes: z
    .string()
    .optional()
    .describe("Aesthetic, camera, grade, and art-direction notes when relevant."),
  recreationGuidance: z
    .object({
      preserve: z
        .array(z.string())
        .describe("Elements that should stay the same in a recreation."),
      changeable: z.array(z.string()).describe("Elements that can or should change."),
      suggestedWorkflow: z
        .string()
        .describe("Plain-language workflow suggestion for recreating this."),
    })
    .optional(),
  promptPack: z
    .object({
      imageDescription: z.record(z.string(), z.string()).optional(),
      editDescription: z.record(z.string(), z.string()).optional(),
      masterPrompt: z.string().optional(),
    })
    .optional(),
})

export type AnalyzeMediaAnalysis = z.infer<typeof analyzeMediaAnalysisSchema>

export type AnalyzeMediaCoreResult = {
  analysis: AnalyzeMediaAnalysis
  analyzedUrls: string[]
  imageCount: number
  mediaKind: "image" | "slideshow"
  summary: string
}

function focusInstruction(focus: AnalyzeMediaFocus, imageCount: number): string {
  const multi =
    imageCount > 1
      ? ` You are analyzing ${imageCount} related images (for example a carousel or slideshow). Compare slides and note the overall narrative.`
      : ""

  switch (focus) {
    case "style":
      return `Focus on aesthetic, camera language, color grade, and art direction useful for style-matched recreation.${multi}`
    case "recreation":
      return `Focus on what to preserve versus change if the user wants to recreate this, plus a practical workflow suggestion.${multi}`
    case "prompt_pack":
      return `Focus on filling promptPack with structured fields (imageDescription or editDescription plus masterPrompt) suitable for copy-paste creative briefs.${multi}`
    default:
      return `Provide a balanced general analysis covering subject, composition, lighting, palette, mood, and any visible text.${multi}`
  }
}

async function prepareImageUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) {
    throw new Error(
      "Data URL references are not supported for analyzeMedia. Re-attach the image or use a stored upl_/gen_ id.",
    )
  }

  return validateExternalReferenceUrl({
    url,
    expectedKind: "image",
    maxContentLengthBytes: MAX_ANALYZE_MEDIA_BYTES,
  })
}

export async function analyzeMediaImages({
  focus = "general",
  images,
}: {
  focus?: AnalyzeMediaFocus
  images: AnalyzeMediaImageInput[]
}): Promise<AnalyzeMediaCoreResult> {
  if (!hasAIGatewayCredentials()) {
    throw new Error(AI_GATEWAY_CONFIG_ERROR)
  }

  if (images.length === 0) {
    throw new Error("At least one image reference is required.")
  }

  if (images.length > MAX_ANALYZE_MEDIA_IMAGES) {
    throw new Error(`analyzeMedia supports at most ${MAX_ANALYZE_MEDIA_IMAGES} images per call.`)
  }

  const analyzedUrls: string[] = []
  for (const image of images) {
    analyzedUrls.push(await prepareImageUrl(image.url))
  }

  const gateway = createAIGatewayProvider()
  const model = gateway(ANALYZE_MEDIA_VISION_MODEL)

  const imageParts = analyzedUrls.map((url) => ({
    type: "image" as const,
    image: new URL(url),
  }))

  const { object } = await generateObject({
    model,
    schema: analyzeMediaAnalysisSchema,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              "Analyze these reference image(s) for a creative AI agent that generates images and videos.",
              focusInstruction(focus, images.length),
              "Be specific and technical enough that a downstream generation step could use your analysis without seeing the pixels.",
              "Fill recreationGuidance when focus is recreation or when recreation seems likely.",
              "Fill promptPack when focus is prompt_pack.",
              "Fill styleNotes when focus is style or when aesthetic details matter.",
            ].join("\n\n"),
          },
          ...imageParts,
        ],
      },
    ],
  })

  return {
    summary: object.summary,
    analysis: object,
    mediaKind: images.length > 1 ? "slideshow" : "image",
    analyzedUrls,
    imageCount: images.length,
  }
}
