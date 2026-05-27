import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import {
  ANALYZE_MEDIA_FOCUS_VALUES,
  analyzeMediaImages,
  MAX_ANALYZE_MEDIA_IMAGES,
} from "@/lib/chat/analyze-media-core"
import { mediaIdStringSchema } from "@/lib/chat/media-id"
import { resolveToolImageReferences } from "@/lib/chat/resolve-tool-references"
import type { AvailableChatImageReference } from "@/lib/chat/tools/image-reference-types"

interface CreateAnalyzeMediaToolOptions {
  availableReferences: AvailableChatImageReference[]
  supabase: SupabaseClient
  threadId?: string
  userId: string
}

export function createAnalyzeMediaTool({
  availableReferences,
  supabase,
  threadId,
  userId,
}: CreateAnalyzeMediaToolOptions) {
  const availableReferenceMap = new Map(
    availableReferences.map((reference) => [reference.id, reference] as const),
  )

  return tool({
    description:
      "Analyze one or more image references with vision and return structured observations (summary, subjects, composition, lighting, palette, mood, visible text, optional recreation guidance or prompt pack). Use when the user asks to analyze, describe, break down, or understand image references—including public https image URLs, transcript refs (ref_N), thread uploads/generations (upl_/gen_), or URLs returned by downloadSocialReference for slideshow posts. Do NOT use generateImage for analysis-only requests. Supports up to 8 images per call. Video analysis is not supported yet; for video references use extractVideoFrames first, then analyze the stills.",
    inputSchema: z.object({
      referenceIds: z
        .array(z.string().min(1))
        .max(MAX_ANALYZE_MEDIA_IMAGES)
        .optional()
        .describe(
          "Image references to analyze: ref_N from the transcript manifest, upl_/gen_ from listThreadMedia, mediaId from listRecentGenerations, public https image URLs, or outputPublicUrl/outputPublicUrls from downloadSocialReference.",
        ),
      mediaIds: z
        .array(mediaIdStringSchema)
        .max(MAX_ANALYZE_MEDIA_IMAGES)
        .optional()
        .describe("Deprecated alias for referenceIds entries (upl_/gen_ ids)."),
      focus: z
        .enum(ANALYZE_MEDIA_FOCUS_VALUES)
        .optional()
        .describe(
          "What to emphasize: general (default), style, recreation, or prompt_pack for structured brief fields.",
        ),
    }),
    strict: true,
    execute: async ({ referenceIds, mediaIds, focus }) => {
      const { references, warnings } = await resolveToolImageReferences({
        supabase,
        userId,
        threadId,
        referenceIds,
        mediaIds,
        availableReferenceMap,
      })

      if (references.length === 0) {
        throw new Error("Provide at least one image via referenceIds or mediaIds.")
      }

      const resolvedFocus = focus ?? "general"
      const result = await analyzeMediaImages({
        focus: resolvedFocus,
        images: references.map((reference) => ({
          url: reference.url,
          filename: reference.filename,
          mediaType: reference.mediaType,
        })),
      })

      return {
        ...result,
        focus: resolvedFocus,
        message: result.summary,
        warnings: warnings.length > 0 ? warnings : undefined,
      }
    },
  })
}
