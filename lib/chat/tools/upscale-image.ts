import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { inferStoragePathFromUrl } from "@/lib/assets/library"
import type { AvailableChatImageReference } from "@/lib/chat/tools/image-reference-types"
import { mediaIdStringSchema } from "@/lib/chat/media-id"
import { resolveToolImageReferences } from "@/lib/chat/resolve-tool-references"
import {
  DEFAULT_UPSCALE_REPLICATE_INPUT,
  runImageUpscale,
  UPSCALE_MODEL_IDENTIFIER,
  type UpscaleMode,
} from "@/lib/server/upscale-image"

interface CreateUpscaleImageToolOptions {
  availableReferences: AvailableChatImageReference[]
  supabase: SupabaseClient
  threadId?: string
  userId: string
}

async function loadAssetImageUrl(
  assetId: string,
  supabase: SupabaseClient,
  userId: string,
): Promise<{ storagePath: string | null; url: string }> {
  const { data, error } = await supabase
    .from("assets")
    .select("id, user_id, asset_type, asset_url, visibility")
    .eq("id", assetId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load saved asset: ${error.message}`)
  }

  if (!data) {
    throw new Error(`Asset "${assetId}" was not found.`)
  }

  const isOwned = data.user_id === userId
  const isPublic = data.visibility === "public"
  if (!isOwned && !isPublic) {
    throw new Error(`Asset "${assetId}" could not be accessed.`)
  }

  if (data.asset_type !== "image") {
    throw new Error("Only saved image assets can be upscaled.")
  }

  const url = String(data.asset_url)
  return {
    storagePath: inferStoragePathFromUrl(url),
    url,
  }
}

export function createUpscaleImageTool({
  availableReferences,
  supabase,
  threadId,
  userId,
}: CreateUpscaleImageToolOptions) {
  const availableReferenceMap = new Map(
    availableReferences.map((reference) => [reference.id, reference] as const),
  )

  return tool({
    description:
      "Upscale an existing image to higher resolution using P-Image Upscale (prunaai/p-image-upscale on Replicate). Use when the user wants to increase resolution, make an image sharper/bigger, upscale to 4K/8MP, or clean up AI-generated softness—without changing composition or running a creative re-generation. Requires exactly one source image via referenceIds (ref_N, upl_/gen_, listThreadMedia, listRecentGenerations mediaId) or assetIds. Do NOT use generateImage for pure upscaling. No creative prompt is needed; set target megapixels and enhancement toggles instead.",
    inputSchema: z.object({
      referenceIds: z
        .array(z.string().min(1))
        .max(1)
        .optional()
        .describe(
          "Exactly one source image: ref_N from the transcript manifest, upl_/gen_ from listThreadMedia, mediaId from listRecentGenerations, or a safe public https image URL.",
        ),
      mediaIds: z
        .array(mediaIdStringSchema)
        .max(1)
        .optional()
        .describe("Deprecated alias for a single referenceIds entry."),
      assetIds: z
        .array(z.string().uuid())
        .max(1)
        .optional()
        .describe("Optional single saved image asset UUID from searchAssets."),
      modelIdentifier: z
        .string()
        .min(1)
        .max(120)
        .optional()
        .describe(
          `Upscale model identifier. Defaults to ${UPSCALE_MODEL_IDENTIFIER}. Only pass ids with type upscale from listModels.`,
        ),
      upscaleMode: z
        .enum(["target", "factor"])
        .optional()
        .describe(
          "target = fixed megapixel output (default); factor = multiply each side (capped at 8 MP).",
        ),
      targetMegapixels: z
        .number()
        .int()
        .min(1)
        .max(8)
        .optional()
        .describe("Target megapixels when upscaleMode is target (default 4)."),
      scaleFactor: z
        .number()
        .min(1)
        .max(8)
        .optional()
        .describe("Per-side scale when upscaleMode is factor."),
      enhanceRealism: z
        .boolean()
        .optional()
        .describe("Improve realism; often helpful for AI-generated images (default true)."),
      enhanceDetails: z
        .boolean()
        .optional()
        .describe("Sharpen fine textures; may over-sharpen clean photos (default false)."),
      outputFormat: z
        .enum(["jpg", "png", "webp"])
        .optional()
        .describe("Output file format (default png)."),
    }),
    strict: true,
    execute: async ({
      assetIds = [],
      enhanceDetails,
      enhanceRealism,
      mediaIds = [],
      modelIdentifier = UPSCALE_MODEL_IDENTIFIER,
      outputFormat,
      referenceIds = [],
      scaleFactor,
      targetMegapixels,
      upscaleMode,
    }) => {
      const resolvedModel = modelIdentifier.trim() || UPSCALE_MODEL_IDENTIFIER

      const { data: modelRow, error: modelError } = await supabase
        .from("models")
        .select("identifier, type, is_active")
        .eq("identifier", resolvedModel)
        .eq("type", "upscale")
        .eq("is_active", true)
        .maybeSingle()

      if (modelError) {
        throw new Error(`Failed to verify upscale model: ${modelError.message}`)
      }

      if (!modelRow) {
        throw new Error(
          `Upscale model "${resolvedModel}" not found or is inactive. Use listModels and pick an active type=upscale model (default: ${UPSCALE_MODEL_IDENTIFIER}).`,
        )
      }

      const mergedReferenceIds = [...referenceIds, ...mediaIds]
      const assetId = assetIds[0]

      if (mergedReferenceIds.length === 0 && !assetId) {
        throw new Error(
          "Upscale requires exactly one source image. Pass referenceIds (or mediaIds) or one assetId.",
        )
      }

      if (mergedReferenceIds.length > 1 || assetIds.length > 1) {
        throw new Error("Upscale accepts only one source image per call.")
      }

      let sourceImageUrl: string
      let referenceImageStoragePaths: string[] | null = null

      if (assetId) {
        if (mergedReferenceIds.length > 0) {
          throw new Error("Pass either referenceIds or assetIds, not both.")
        }
        const asset = await loadAssetImageUrl(assetId, supabase, userId)
        sourceImageUrl = asset.url
        referenceImageStoragePaths = asset.storagePath ? [asset.storagePath] : null
      } else {
        const { references, warnings } = await resolveToolImageReferences({
          supabase,
          userId,
          threadId,
          referenceIds: mergedReferenceIds,
          availableReferenceMap,
          allowCrossThread: true,
        })

        if (references.length !== 1) {
          throw new Error("Upscale requires exactly one resolved source image.")
        }

        sourceImageUrl = references[0].url
        const inferredPath = inferStoragePathFromUrl(sourceImageUrl)
        referenceImageStoragePaths = inferredPath ? [inferredPath] : null

        if (warnings.length > 0) {
          console.warn("[chat/upscale-image] reference warnings:", warnings)
        }
      }

      const mode: UpscaleMode =
        upscaleMode ??
        (typeof DEFAULT_UPSCALE_REPLICATE_INPUT.upscale_mode === "string"
          ? (DEFAULT_UPSCALE_REPLICATE_INPUT.upscale_mode as UpscaleMode)
          : "target")

      const result = await runImageUpscale({
        supabase,
        userId,
        imageUrl: sourceImageUrl,
        modelIdentifier: resolvedModel,
        threadId,
        tool: "chat-upscale-image",
        referenceImageStoragePaths,
        parameters: {
          upscale_mode: mode,
          ...(targetMegapixels != null ? { target: targetMegapixels } : {}),
          ...(scaleFactor != null ? { factor: scaleFactor } : {}),
          ...(enhanceRealism != null ? { enhance_realism: enhanceRealism } : {}),
          ...(enhanceDetails != null ? { enhance_details: enhanceDetails } : {}),
          ...(outputFormat ? { output_format: outputFormat } : {}),
        },
      })

      const outputFormatResolved =
        outputFormat ??
        (typeof DEFAULT_UPSCALE_REPLICATE_INPUT.output_format === "string"
          ? DEFAULT_UPSCALE_REPLICATE_INPUT.output_format
          : "png")

      const mimeType =
        outputFormatResolved === "jpg"
          ? "image/jpeg"
          : outputFormatResolved === "webp"
            ? "image/webp"
            : "image/png"

      return {
        creditsUsed: result.creditsUsed,
        generationId: result.generationId,
        images: [
          {
            mimeType,
            storagePath: result.storagePath,
            url: result.imageUrl,
          },
        ],
        message: `Upscaled image with ${result.modelIdentifier}.`,
        model: result.modelIdentifier,
        status: "completed" as const,
        usedReferenceCount: 1,
        referenceImageUrls: [sourceImageUrl],
      }
    },
  })
}
