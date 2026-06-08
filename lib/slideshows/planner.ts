import "server-only"

import { generateObject } from "ai"
import { z } from "zod"
import { createAIGatewayProvider } from "@/lib/ai/gateway"
import type { SlideshowCollection } from "@/lib/slideshow/types"
import {
  slideshowBlueprintStoredSchema,
  type SlideshowAspectRatio,
  type SlideshowBlueprint,
} from "@/lib/slideshows/types"
import { applyBlueprintTextRules, briefDisablesOverlays } from "@/lib/slideshows/text-treatment"

const plannerOutputSchema = z.object({
  templateName: z.string().trim().min(1).max(120),
  templateDescription: z.string().trim().max(500),
  blueprint: slideshowBlueprintStoredSchema,
})

function summarizeCollections(collections: SlideshowCollection[]) {
  return collections
    .map((collection) => ({
      id: collection.id,
      name: collection.name,
      description: collection.description,
      imageCount: collection.items.length,
      sampleTags: Array.from(new Set(collection.items.flatMap((item) => item.tags))).slice(0, 10),
    }))
}

export async function planSlideshowTemplate(input: {
  brief: string
  aspectRatio: SlideshowAspectRatio
  slideCount?: number
  collections: SlideshowCollection[]
}): Promise<{ templateName: string; templateDescription: string; blueprint: SlideshowBlueprint }> {
  const gateway = createAIGatewayProvider()
  const desiredCount = input.slideCount ? `Create exactly ${input.slideCount} slides.` : "Choose 2 to 8 slides."
  const collectionSummary = summarizeCollections(input.collections)

  const { object } = await generateObject({
    model: gateway("google/gemini-2.5-flash"),
    schema: plannerOutputSchema,
    prompt: [
      "Create a reusable static-image social slideshow template and its first resolved content pass.",
      desiredCount,
      `Aspect ratio: ${input.aspectRatio}.`,
      "Keep the structure simple and repeatable.",
      "Each slide visual source must be collection, generate, reuse, or manual.",
      "Use collection only when a suitable collection is available; collectionId must be a provided UUID.",
      "A collection slide may optionally use aiEditPrompt for one AI edit after selection.",
      "Each slide must set textTreatment to exactly 'off' or 'overlay'.",
      "Use textTreatment 'off' for image-only slides and whenever visible text belongs inside the generated image (screenshots, app UI, notes). Put that copy in the visual generation prompt.",
      "Use textTreatment 'overlay' only for caption-style text composited on top of the image. Populate overlays only on those slides.",
      "If the user asks for no text overlays, set textTreatment to 'off' on every slide and leave overlays empty.",
      "Every overlay style must be minimal (white text with thick black stroke, no background box).",
      "Set fresh_each_run for advice/hooks that should change and prefer_unused for collection visuals that should rotate.",
      "",
      `User brief:\n${input.brief}`,
      "",
      `Available collections:\n${JSON.stringify(collectionSummary)}`,
    ].join("\n"),
  })

  const parsed = plannerOutputSchema.parse(object)
  const blueprint = applyBlueprintTextRules(
    {
      ...parsed.blueprint,
      slides: parsed.blueprint.slides.map((slide) => ({
        ...slide,
        overlays: slide.overlays.map((overlay) => ({
          ...overlay,
          style: "minimal" as const,
        })),
      })),
    },
    { forceOff: briefDisablesOverlays(input.brief) },
  )
  return { ...parsed, blueprint }
}

const runContentSchema = z.object({
  slides: z.array(z.object({
    slideId: z.string(),
    resolvedText: z.string().max(1200),
    overlays: z.array(z.object({
      overlayId: z.string(),
      resolvedText: z.string().max(500),
    })),
  })),
})

export async function resolveBlueprintContent(input: {
  brief: string
  blueprint: SlideshowBlueprint
}) {
  const gateway = createAIGatewayProvider()
  const { object } = await generateObject({
    model: gateway("google/gemini-2.5-flash"),
    schema: runContentSchema,
    prompt: [
      "Resolve fresh content for one run of this reusable slideshow template.",
      "Return one entry for every slide and every overlay using the exact supplied ids.",
      "Preserve fixed resolved text. Rewrite fresh_each_run content to fit the new brief.",
      "Only populate overlay resolvedText for slides whose textTreatment is 'overlay'. Leave overlays empty for textTreatment 'off'.",
      "Avoid repeating the same advice or hook within this run.",
      `Brief:\n${input.brief}`,
      `Template:\n${JSON.stringify(input.blueprint)}`,
    ].join("\n\n"),
  })

  const bySlideId = new Map(object.slides.map((slide) => [slide.slideId, slide]))
  return applyBlueprintTextRules({
    ...input.blueprint,
    slides: input.blueprint.slides.map((slide) => {
      const resolved = bySlideId.get(slide.id)
      const overlays = new Map(resolved?.overlays.map((overlay) => [overlay.overlayId, overlay.resolvedText]) ?? [])
      const usesOverlays = slide.textTreatment === "overlay"
      return {
        ...slide,
        content: {
          ...slide.content,
          resolvedText: slide.content.variation === "fixed"
            ? slide.content.resolvedText
            : resolved?.resolvedText || slide.content.resolvedText,
        },
        overlays: usesOverlays
          ? slide.overlays.map((overlay) => ({
              ...overlay,
              resolvedText: overlay.variation === "fixed"
                ? overlay.resolvedText
                : overlays.get(overlay.id) || overlay.resolvedText,
            }))
          : [],
      }
    }),
  }, { forceOff: briefDisablesOverlays(input.brief) }) satisfies SlideshowBlueprint
}

export function instantiateBlueprint(blueprint: SlideshowBlueprint) {
  return blueprint.slides.map((slide, index) => ({
    ...slide,
    index,
    sourceImageUrl: null,
    sourceCollectionImageId: null,
    generationId: null,
    finalImageUrl: null,
    status: "pending" as const,
    errorMessage: null,
  }))
}
