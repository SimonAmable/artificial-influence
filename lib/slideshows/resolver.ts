import "server-only"

import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createGenerateImageTool } from "@/lib/chat/tools/generate-image"
import { listSlideshowCollections } from "@/lib/slideshow/database-server"
import {
  getSlideshowProject,
  updateSlideshowProject,
} from "@/lib/slideshows/database-server"
import { collectAiEditReferenceUrls, collectSlideReferenceUrls } from "@/lib/slideshows/reference-images"
import type { ResolvedSlideshowSlide, SlideshowProject } from "@/lib/slideshows/types"
import { tryCompleteFalPendingImage } from "@/lib/server/fal-image-completion"
import { resolveStoredObjectUrl } from "@/lib/uploads/server"

type ImageToolResult = {
  status?: "pending" | "completed" | "failed"
  generationId?: string
  images?: Array<{ url?: string }>
  message?: string
}

function interpolate(value: string, slide: ResolvedSlideshowSlide) {
  return value
    .replaceAll("{{resolvedText}}", slide.content.resolvedText)
    .replaceAll("{{content.resolvedText}}", slide.content.resolvedText)
}

function deterministicIndex(seed: string, length: number) {
  if (length <= 1) return 0
  return createHash("sha1").update(seed).digest().readUInt32BE(0) % length
}

async function resolveCompletedGeneration(
  supabase: SupabaseClient,
  userId: string,
  generationId: string,
) {
  const { data: initial } = await supabase
    .from("generations")
    .select("status, supabase_storage_path, error_message, replicate_prediction_id")
    .eq("id", generationId)
    .eq("user_id", userId)
    .maybeSingle()

  if (!initial) return null

  if (initial.status === "pending" && initial.replicate_prediction_id) {
    await tryCompleteFalPendingImage(supabase, userId, initial.replicate_prediction_id)
  }

  const { data } = await supabase
    .from("generations")
    .select("status, supabase_storage_path, error_message")
    .eq("id", generationId)
    .eq("user_id", userId)
    .maybeSingle()

  if (!data) return null
  if (data.status === "failed") {
    return { status: "failed" as const, url: null, error: data.error_message || "Image generation failed." }
  }
  if (data.status !== "completed" || !data.supabase_storage_path) return null
  return {
    status: "completed" as const,
    url: await resolveStoredObjectUrl(supabase, "public-bucket", String(data.supabase_storage_path)),
    error: null,
  }
}

async function runImageGeneration(input: {
  supabase: SupabaseClient
  userId: string
  prompt: string
  modelIdentifier: string | null
  referenceUrls?: string[]
  aspectRatio: "9:16" | "4:5" | "1:1"
}) {
  const imageTool = createGenerateImageTool({
    availableReferences: [],
    requireApproval: false,
    supabase: input.supabase,
    userId: input.userId,
  })
  const execute = imageTool.execute
  if (!execute) throw new Error("Image generation is unavailable.")

  const referenceUrls = input.referenceUrls?.filter(Boolean) ?? []

  const output = await execute(
    {
      prompt: input.prompt,
      modelIdentifier: input.modelIdentifier ?? "openai/gpt-image-2",
      aspectRatio: input.aspectRatio,
      variantCount: 1,
      referenceIds: referenceUrls,
      enhancePrompt: false,
      rawPrompt: false,
      mediaIds: [],
      assetIds: [],
    },
    {} as never,
  )
  return output as ImageToolResult
}

function projectStatusForSlides(slides: ResolvedSlideshowSlide[]) {
  if (slides.some((slide) => slide.status === "failed")) return "failed" as const
  if (slides.every((slide) => slide.status === "ready")) return "ready" as const
  return "resolving" as const
}

export async function resolveSlideshowProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<SlideshowProject> {
  const project = await getSlideshowProject(supabase, userId, projectId)
  if (!project) throw new Error("Slideshow project not found.")

  const collections = await listSlideshowCollections(supabase, userId)
  const collectionsById = new Map(collections.map((collection) => [collection.id, collection]))
  const usedCollectionImages = new Set<string>()
  const resolvedBySlideId = new Map<string, ResolvedSlideshowSlide>()
  const nextSlides: ResolvedSlideshowSlide[] = []

  for (const original of [...project.slides].sort((a, b) => a.index - b.index)) {
    let slide = { ...original, visual: { ...original.visual } }

    if (slide.status === "ready" && slide.sourceImageUrl) {
      nextSlides.push(slide)
      resolvedBySlideId.set(slide.id, slide)
      if (slide.sourceCollectionImageId) usedCollectionImages.add(slide.sourceCollectionImageId)
      continue
    }

    if (slide.generationId) {
      const completed = await resolveCompletedGeneration(supabase, userId, slide.generationId)
      if (!completed) {
        nextSlides.push({ ...slide, status: "resolving" })
        continue
      }
      slide = completed.status === "failed"
        ? { ...slide, status: "failed", errorMessage: completed.error }
        : { ...slide, sourceImageUrl: completed.url, status: "ready", errorMessage: null }
      nextSlides.push(slide)
      resolvedBySlideId.set(slide.id, slide)
      continue
    }

    try {
      let baseImageUrl: string | null = slide.sourceImageUrl
      let collectionImageId: string | null = slide.sourceCollectionImageId

      if (slide.visual.source === "collection") {
        const collection = slide.visual.collectionId ? collectionsById.get(slide.visual.collectionId) : null
        if (!collection || collection.items.length === 0) {
          throw new Error("The assigned image collection is empty or unavailable.")
        }
        const pinned = slide.sourceCollectionImageId
          ? collection.items.find((item) => item.id === slide.sourceCollectionImageId)
          : null
        const selected = pinned ?? (() => {
          const candidates = collection.items.filter((item) => !usedCollectionImages.has(item.id))
          const pool = candidates.length > 0 ? candidates : collection.items
          return pool[deterministicIndex(`${project.id}:${slide.id}`, pool.length)]
        })()
        baseImageUrl = selected.url
        collectionImageId = selected.id
        usedCollectionImages.add(selected.id)
      } else if (slide.visual.source === "reuse") {
        const source = slide.visual.reuseSlideId ? resolvedBySlideId.get(slide.visual.reuseSlideId) : null
        if (!source?.sourceImageUrl) throw new Error("The referenced slide visual is not ready.")
        baseImageUrl = source.sourceImageUrl
      } else if (slide.visual.source === "manual") {
        if (slide.visual.manualImageUrl) {
          baseImageUrl = slide.visual.manualImageUrl
        } else {
          nextSlides.push({ ...slide, status: "pending" })
          continue
        }
      }

      const generationPrompt = slide.visual.source === "generate"
        ? interpolate(slide.visual.prompt, slide)
        : slide.visual.aiEditPrompt
          ? interpolate(slide.visual.aiEditPrompt, slide)
          : null

      if (generationPrompt) {
        const referenceUrls = slide.visual.source === "generate"
          ? collectSlideReferenceUrls(slide)
          : slide.visual.aiEditPrompt
            ? collectAiEditReferenceUrls(slide, baseImageUrl)
            : baseImageUrl
              ? [baseImageUrl]
              : []

        const result = await runImageGeneration({
          supabase,
          userId,
          prompt: generationPrompt,
          modelIdentifier: slide.visual.modelIdentifier,
          referenceUrls,
          aspectRatio: project.aspectRatio,
        })
        const completedUrl = result.images?.find((image) => image.url)?.url ?? null
        slide = {
          ...slide,
          sourceCollectionImageId: collectionImageId,
          sourceImageUrl: completedUrl,
          generationId: result.generationId ?? null,
          status: completedUrl ? "ready" : "resolving",
          errorMessage: null,
        }
      } else if (baseImageUrl) {
        slide = {
          ...slide,
          sourceCollectionImageId: collectionImageId,
          sourceImageUrl: baseImageUrl,
          status: "ready",
          errorMessage: null,
        }
      } else {
        throw new Error("This slide does not have a resolvable visual.")
      }
    } catch (error) {
      slide = {
        ...slide,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Failed to resolve slide.",
      }
    }

    nextSlides.push(slide)
    resolvedBySlideId.set(slide.id, slide)
  }

  return updateSlideshowProject(supabase, userId, project.id, {
    slides: nextSlides,
    status: projectStatusForSlides(nextSlides),
    errorMessage: nextSlides.some((slide) => slide.status === "failed")
      ? "One or more slides could not be resolved."
      : null,
  })
}
