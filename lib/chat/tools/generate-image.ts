import { generateImage } from "ai"
import { xai } from "@ai-sdk/xai"
import Replicate from "replicate"
import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { inferStoragePathFromUrl } from "@/lib/assets/library"
import { checkUserHasCredits } from "@/lib/credits"
import { enhancePrompt, enhancePromptForJSONModels } from "@/lib/prompt-enhancement"
import {
  persistGeneratedBase64Images,
  runReplicatePollingImageGeneration,
} from "@/lib/server/replicate-image-generation"
import {
  aspectRatioToQwenImageSize,
  buildQwenFalInput,
  QWEN_IMAGE2_CANONICAL_ID,
  resolveQwenImage2Route,
  submitQwenImage2Queue,
  type QwenUnifiedParams,
} from "@/lib/server/fal-qwen-image-2"
import { aspectRatioToDimensions, modelUsesDimensions } from "@/lib/utils/model-parameters"
import type {
  AvailableChatImageReference,
  ChatImageReference,
} from "@/lib/chat/tools/generate-image-with-nano-banana"
import { resolveThreadMediaIdsToImageReferences } from "@/lib/chat/thread-media/server"

const DEFAULT_IMAGE_MODEL = "google/nano-banana-2" as const
const MAX_REFERENCE_IMAGES = 4
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const JSON_SUPPORTED_MODELS = new Set([
  "google/nano-banana",
  "google/nano-banana-pro",
  "google/nano-banana-2",
  "bytedance/seedream-4.5",
])

interface CreateGenerateImageToolOptions {
  availableReferences: AvailableChatImageReference[]
  latestUserImages: ChatImageReference[]
  supabase: SupabaseClient
  threadId?: string
  userId: string
}

interface StoredAsset {
  mimeType: string
  storagePath: string | null
  url: string
}

function getFileExtension(mimeType: string, fallback = "png") {
  const normalized = mimeType.toLowerCase()

  if (normalized === "image/jpeg") return "jpg"
  if (normalized === "image/png") return "png"
  if (normalized === "image/webp") return "webp"
  if (normalized === "image/gif") return "gif"
  if (normalized === "image/avif") return "avif"
  if (normalized === "image/svg+xml") return "svg"

  return fallback
}

function sanitizeFileStem(value: string | undefined, fallback: string) {
  const cleaned = value?.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "")
  return cleaned && cleaned.length > 0 ? cleaned.toLowerCase() : fallback
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/)

  if (!match) {
    throw new Error("Only base64 data URLs are supported for chat image references.")
  }

  const [, mimeType, base64] = match
  const buffer = Buffer.from(base64, "base64")

  if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new Error("Reference image is too large. Maximum size is 10MB.")
  }

  return {
    buffer,
    mimeType,
  }
}

function validateReferenceUrl(url: string) {
  if (url.startsWith("data:")) {
    return
  }

  let parsedUrl: URL

  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error("Reference image URL is invalid.")
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  const isAllowedSupabaseUrl = (() => {
    if (!supabaseUrl) return false

    try {
      const parsedSupabaseUrl = new URL(supabaseUrl)
      return (
        parsedUrl.origin === parsedSupabaseUrl.origin &&
        parsedUrl.pathname.startsWith("/storage/v1/object/public/public-bucket/")
      )
    } catch {
      return false
    }
  })()

  const isAllowedAppUrl = (() => {
    if (!appUrl) return false

    try {
      const parsedAppUrl = new URL(appUrl)
      return parsedUrl.origin === parsedAppUrl.origin
    } catch {
      return false
    }
  })()

  if (!isAllowedSupabaseUrl && !isAllowedAppUrl) {
    throw new Error("Reference image URLs must come from this app's stored assets.")
  }
}

function dedupeReferences(references: ChatImageReference[]) {
  const seen = new Set<string>()

  return references.filter((reference) => {
    if (seen.has(reference.url)) {
      return false
    }

    seen.add(reference.url)
    return true
  })
}

async function uploadBufferToStorage({
  buffer,
  filenameHint,
  folder,
  mimeType,
  supabase,
  userId,
}: {
  buffer: Buffer
  filenameHint?: string
  folder: string
  mimeType: string
  supabase: SupabaseClient
  userId: string
}): Promise<StoredAsset> {
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).slice(2, 10)
  const extension = getFileExtension(mimeType)
  const safeStem = sanitizeFileStem(filenameHint, folder)
  const storagePath = `${userId}/${folder}/${timestamp}-${safeStem}-${randomStr}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from("public-bucket")
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Failed to upload ${folder} asset: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage.from("public-bucket").getPublicUrl(storagePath)

  return {
    mimeType,
    storagePath,
    url: urlData.publicUrl,
  }
}

async function uploadReferenceImage(
  reference: ChatImageReference,
  index: number,
  supabase: SupabaseClient,
  userId: string,
) {
  if (!reference.url.startsWith("data:")) {
    validateReferenceUrl(reference.url)

    return {
      mimeType: reference.mediaType ?? "image/png",
      storagePath: inferStoragePathFromUrl(reference.url),
      url: reference.url,
    }
  }

  const { buffer, mimeType } = parseDataUrl(reference.url)

  if (!mimeType.startsWith("image/")) {
    throw new Error("Only image attachments can be used as image generation references.")
  }

  return uploadBufferToStorage({
    buffer,
    filenameHint: reference.filename ?? `reference-${index + 1}`,
    folder: "chat-reference-images",
    mimeType,
    supabase,
    userId,
  })
}

async function loadAssetReferences(
  assetIds: string[],
  supabase: SupabaseClient,
  userId: string,
): Promise<StoredAsset[]> {
  if (assetIds.length === 0) return []

  const { data, error } = await supabase
    .from("assets")
    .select("id, user_id, asset_type, asset_url, visibility")
    .in("id", assetIds)

  if (error) {
    throw new Error(`Failed to load saved assets: ${error.message}`)
  }

  const assets = (data ?? []).filter((asset) => {
    const isOwned = asset.user_id === userId
    const isPublic = asset.visibility === "public"
    return isOwned || isPublic
  })

  const invalidAsset = assets.find((asset) => asset.asset_type !== "image")
  if (invalidAsset) {
    throw new Error("Only saved image assets can be used as references for image generation.")
  }

  if (assets.length !== assetIds.length) {
    throw new Error("One or more saved assets could not be accessed.")
  }

  return assets.map((asset) => ({
    mimeType: "image/png",
    storagePath: inferStoragePathFromUrl(String(asset.asset_url)),
    url: String(asset.asset_url),
  }))
}

async function maybeEnhancePrompt({
  modelIdentifier,
  prompt,
  referenceImageUrls,
  shouldEnhance,
}: {
  modelIdentifier: string
  prompt: string
  referenceImageUrls: string[]
  shouldEnhance: boolean
}) {
  if (!shouldEnhance) return prompt

  try {
    if (JSON_SUPPORTED_MODELS.has(modelIdentifier)) {
      return await enhancePromptForJSONModels(prompt, modelIdentifier, {
        imageUrls: referenceImageUrls,
      })
    }

    return await enhancePrompt(prompt, "generate")
  } catch (error) {
    console.error("[chat/generate-image] Prompt enhancement failed, using original prompt:", error)
    return prompt
  }
}

export function createGenerateImageTool({
  availableReferences,
  latestUserImages,
  supabase,
  threadId,
  userId,
}: CreateGenerateImageToolOptions) {
  const availableReferenceMap = new Map(
    availableReferences.map((reference) => [reference.id, reference] as const),
  )

  return tool({
    description:
      "Generate or edit an image using any active UniCan image model. Use this when the user explicitly wants an image created now, especially if they name a model, ask for non-Nano output, or want you to use saved asset references. For earlier thread images, use listThreadMedia + mediaIds (UUIDs).",
    inputSchema: z.object({
      prompt: z
        .string()
        .min(2)
        .describe(
          "Image brief for the model. If the user gave detailed or explicit wording, or asked for exact/literal use, paste it verbatim (same meaning and phrasing). Only rewrite or expand when the user message was vague and they did not forbid changes.",
        ),
      modelIdentifier: z
        .string()
        .min(1)
        .max(120)
        .optional()
        .describe("Image model identifier, preferably selected from searchModels. Defaults to google/nano-banana-2."),
      aspectRatio: z
        .string()
        .min(1)
        .max(32)
        .optional()
        .describe("Preferred aspect ratio such as 1:1, 4:5, 9:16, 16:9, or match_input_image."),
      variantCount: z
        .number()
        .int()
        .min(1)
        .max(4)
        .optional()
        .describe("How many image variations to generate. Keep this low unless the user explicitly asks for multiple options."),
      mediaIds: z
        .array(z.string().uuid())
        .max(MAX_REFERENCE_IMAGES)
        .optional()
        .describe(
          "UUIDs from listThreadMedia for earlier thread images or generated images (same thread). Prefer this over legacy referenceIds.",
        ),
      referenceIds: z
        .array(z.string().min(1))
        .max(MAX_REFERENCE_IMAGES)
        .optional()
        .describe("Legacy ref_1 style IDs from older chats only when listThreadMedia UUIDs are unavailable."),
      useLatestUserImages: z
        .boolean()
        .optional()
        .describe(
          "When true, include image files attached on the latest user message as references. Defaults to false. Ignored when mediaIds/referenceIds are provided.",
        ),
      assetIds: z
        .array(z.string().uuid())
        .max(MAX_REFERENCE_IMAGES)
        .optional()
        .describe("Saved image asset UUIDs returned by searchAssets. Do not pass URLs or storage paths here."),
      enhancePrompt: z
        .boolean()
        .optional()
        .describe(
          "Server-side prompt rewrite pass. Omit or false when the user supplied a finished prompt or asked for exact/verbatim/literal/no-rewrite. True only for brief underspecified asks where enhancement is appropriate.",
        ),
    }),
    strict: true,
    execute: async ({
      aspectRatio,
      assetIds = [],
      enhancePrompt: shouldEnhance = false,
      modelIdentifier = DEFAULT_IMAGE_MODEL,
      prompt,
      mediaIds = [],
      referenceIds = [],
      useLatestUserImages = false,
      variantCount = 1,
    }) => {
      const resolvedFromThread =
        threadId && mediaIds.length > 0
          ? await resolveThreadMediaIdsToImageReferences(supabase, userId, threadId, mediaIds)
          : []

      const resolvedReferenceIds = referenceIds.map((referenceId) => {
        const reference = availableReferenceMap.get(referenceId)

        if (!reference) {
          throw new Error(`Unknown reference ID: ${referenceId}`)
        }

        return reference
      })

      const explicitReferences = dedupeReferences([
        ...resolvedFromThread,
        ...resolvedReferenceIds,
      ]).slice(0, MAX_REFERENCE_IMAGES)
      const referenceCandidates =
        explicitReferences.length > 0
          ? explicitReferences
          : useLatestUserImages
            ? dedupeReferences(latestUserImages).slice(0, MAX_REFERENCE_IMAGES)
            : []

      const [uploadedReferences, assetReferences, modelResponse] = await Promise.all([
        Promise.all(
          referenceCandidates.map((reference, index) =>
            uploadReferenceImage(reference, index, supabase, userId),
          ),
        ),
        loadAssetReferences(assetIds, supabase, userId),
        supabase
          .from("models")
          .select("*")
          .eq("identifier", modelIdentifier)
          .eq("type", "image")
          .eq("is_active", true)
          .single(),
      ])

      if (modelResponse.error || !modelResponse.data) {
        throw new Error(`Model "${modelIdentifier}" not found or is inactive`)
      }

      const modelData = modelResponse.data
      const maxImages = Math.max(1, Number(modelData.max_images ?? 1) || 1)
      const effectiveVariantCount = Math.min(variantCount, maxImages)
      const costPerImage = Math.max(1, Number(modelData.model_cost ?? 1) || 1)
      const allReferences = [...uploadedReferences, ...assetReferences].slice(0, MAX_REFERENCE_IMAGES)
      const referenceImageUrls = allReferences.map((reference) => reference.url)
      const referenceImageStoragePaths = allReferences
        .map((reference) => reference.storagePath)
        .filter((value): value is string => Boolean(value))
      const finalPrompt = await maybeEnhancePrompt({
        modelIdentifier,
        prompt,
        referenceImageUrls,
        shouldEnhance,
      })
      const provider = String(modelData.provider ?? "").toLowerCase()
      const requiredCredits = Math.max(1, costPerImage * effectiveVariantCount)

      if (provider === "xai") {
        const hasCredits = await checkUserHasCredits(userId, requiredCredits, supabase)
        if (!hasCredits) {
          throw new Error(`Insufficient credits. This generation requires ${requiredCredits} credits.`)
        }

        if (!process.env.XAI_API_KEY) {
          throw new Error("XAI_API_KEY environment variable is not set.")
        }

        const xaiModelIdentifier = modelIdentifier.replace(/^xai\//, "")
        const xaiAspectRatio =
          aspectRatio && /^\d+:\d+$/.test(aspectRatio) ? aspectRatio : undefined
        let base64Images: string[]

        if (referenceImageUrls.length > 0) {
          const imagePayload =
            referenceImageUrls.length === 1
              ? {
                  image: {
                    url: referenceImageUrls[0],
                    type: "image_url" as const,
                  },
                }
              : {
                  images: referenceImageUrls.map((url) => ({
                    url,
                    type: "image_url" as const,
                  })),
                }

          const response = await fetch("https://api.x.ai/v1/images/edits", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.XAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: xaiModelIdentifier,
              prompt: finalPrompt,
              ...imagePayload,
              response_format: "b64_json",
              n: effectiveVariantCount,
              ...(xaiAspectRatio ? { aspect_ratio: xaiAspectRatio } : {}),
            }),
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`xAI API error: ${response.status} - ${errorText}`)
          }

          const payload = (await response.json()) as {
            data?: Array<{ b64_json?: string }>
          }
          base64Images = (payload.data ?? [])
            .map((item) => item.b64_json)
            .filter((value): value is string => typeof value === "string" && value.length > 0)
        } else {
          const result = await generateImage({
            model: xai.image(xaiModelIdentifier),
            prompt: finalPrompt,
            ...(aspectRatio && /^\d+:\d+$/.test(aspectRatio)
              ? { aspectRatio: aspectRatio as `${number}:${number}` }
              : {}),
            ...(effectiveVariantCount > 1 ? { n: effectiveVariantCount } : {}),
          })

          base64Images = result.images?.length
            ? result.images.map((image) => image.base64)
            : result.image?.base64
              ? [result.image.base64]
              : []
        }

        if (base64Images.length === 0) {
          throw new Error("xAI returned no images.")
        }

        const persisted = await persistGeneratedBase64Images({
          aspectRatio: aspectRatio ?? null,
          base64Images,
          modelIdentifier,
          prompt: finalPrompt,
          referenceImageStoragePaths,
          requiredCredits,
          supabase,
          tool: "chat-generate-image",
          userId,
        })

        return {
          aspectRatio: aspectRatio ?? null,
          creditsUsed: persisted.creditsUsed,
          images: persisted.images.map((image) => ({
            mimeType: image.mimeType,
            storagePath: image.storagePath,
            url: image.url,
          })),
          message:
            persisted.images.length === 1
              ? `Generated 1 image with ${modelIdentifier}.`
              : `Generated ${persisted.images.length} images with ${modelIdentifier}.`,
          model: modelIdentifier,
          status: "completed" as const,
          usedReferenceCount: referenceImageUrls.length,
          variantCount: persisted.images.length,
        }
      }

      if (provider === "fal" && modelIdentifier === QWEN_IMAGE2_CANONICAL_ID) {
        const hasCredits = await checkUserHasCredits(userId, requiredCredits, supabase)
        if (!hasCredits) {
          throw new Error(`Insufficient credits. This generation requires ${requiredCredits} credits.`)
        }

        if (!process.env.FAL_KEY) {
          throw new Error("FAL_KEY environment variable is not set.")
        }

        const { endpointId } = resolveQwenImage2Route(referenceImageUrls)
        const resolvedAspectRatio =
          aspectRatio ?? (referenceImageUrls.length > 0 ? "match_input_image" : "1:1")
        const qwenParams: QwenUnifiedParams = {
          prompt: finalPrompt,
          negativePrompt: null,
          numImages: effectiveVariantCount,
          seed: null,
          outputFormat: "png",
          enablePromptExpansion: true,
          enableSafetyChecker: false,
          imageSize: aspectRatioToQwenImageSize(resolvedAspectRatio),
        }
        const input = buildQwenFalInput(endpointId, qwenParams, referenceImageUrls)
        const { requestId, endpointId: falEndpoint } = await submitQwenImage2Queue(endpointId, input)

        const { data: pendingGeneration, error: saveError } = await supabase
          .from("generations")
          .insert({
            user_id: userId,
            prompt: finalPrompt,
            supabase_storage_path: null,
            reference_images_supabase_storage_path:
              referenceImageStoragePaths.length > 0 ? referenceImageStoragePaths : null,
            aspect_ratio: resolvedAspectRatio,
            model: modelIdentifier,
            type: "image",
            is_public: true,
            tool: "chat-generate-image",
            status: "pending",
            replicate_prediction_id: requestId,
            fal_endpoint_id: falEndpoint,
          })
          .select("id")
          .single()

        if (saveError || !pendingGeneration) {
          console.error("[chat/generate-image] Failed to save Fal pending generation:", saveError)
          throw new Error("Failed to create pending image generation.")
        }

        return {
          aspectRatio: resolvedAspectRatio,
          generationId: pendingGeneration.id,
          message: `Started an image generation with ${modelIdentifier}.`,
          model: modelIdentifier,
          predictionId: requestId,
          status: "pending" as const,
          usedReferenceCount: referenceImageUrls.length,
          variantCount: effectiveVariantCount,
        }
      }

      if (provider === "fal") {
        throw new Error(`Unsupported Fal image model: ${modelIdentifier}`)
      }

      const usesDimensions = modelUsesDimensions(modelData.parameters)
      const resolvedAspectRatio =
        aspectRatio ?? (referenceImageUrls.length > 0 ? "match_input_image" : "1:1")
      const replicateInput: Record<string, unknown> = {
        prompt: finalPrompt,
        ...(effectiveVariantCount > 1 ? { num_outputs: effectiveVariantCount } : {}),
      }

      if (usesDimensions) {
        const dims = aspectRatioToDimensions(resolvedAspectRatio)
        replicateInput.width = dims.width
        replicateInput.height = dims.height
      } else {
        replicateInput.aspect_ratio = resolvedAspectRatio
      }

      if (referenceImageUrls.length > 0) {
        replicateInput.image_input = referenceImageUrls
      }

      if (modelIdentifier === "google/nano-banana-2") {
        replicateInput.google_search = true
        replicateInput.image_search = true
      }

      const webhookBase = process.env.REPLICATE_WEBHOOK_BASE_URL?.replace(/\/$/, "")
      if (webhookBase) {
        const hasCredits = await checkUserHasCredits(userId, requiredCredits, supabase)
        if (!hasCredits) {
          throw new Error(`Insufficient credits. This generation requires ${requiredCredits} credits.`)
        }

        const replicate = new Replicate({
          auth: process.env.REPLICATE_API_TOKEN,
        })
        const webhookUrl = `${webhookBase}/api/webhooks/replicate`
        const replicateModelMatch = modelIdentifier.match(/^([^/]+\/[^:]+):(.+)$/)
        const prediction = await replicate.predictions.create(
          replicateModelMatch
            ? {
                version: replicateModelMatch[2],
                input: replicateInput,
                webhook: webhookUrl,
                webhook_events_filter: ["completed"],
              }
            : {
                model: modelIdentifier as `${string}/${string}`,
                input: replicateInput,
                webhook: webhookUrl,
                webhook_events_filter: ["completed"],
              },
        )

        const { data: pendingGeneration, error: saveError } = await supabase
          .from("generations")
          .insert({
            user_id: userId,
            prompt: finalPrompt,
            supabase_storage_path: null,
            reference_images_supabase_storage_path:
              referenceImageStoragePaths.length > 0 ? referenceImageStoragePaths : null,
            aspect_ratio: resolvedAspectRatio,
            model: modelIdentifier,
            type: "image",
            is_public: true,
            tool: "chat-generate-image",
            status: "pending",
            replicate_prediction_id: prediction.id,
          })
          .select("id")
          .single()

        if (saveError || !pendingGeneration) {
          console.error("[chat/generate-image] Failed to save generation row:", saveError)
          throw new Error("Failed to create pending image generation.")
        }

        return {
          aspectRatio: resolvedAspectRatio,
          generationId: pendingGeneration.id,
          message: `Started an image generation with ${modelIdentifier}.`,
          model: modelIdentifier,
          predictionId: prediction.id,
          status: "pending" as const,
          usedReferenceCount: referenceImageUrls.length,
          variantCount: effectiveVariantCount,
        }
      }

      const persisted = await runReplicatePollingImageGeneration({
        aspectRatio: resolvedAspectRatio,
        modelIdentifier,
        prompt: finalPrompt,
        referenceImageStoragePaths,
        replicateInput,
        requiredCredits,
        supabase,
        tool: "chat-generate-image",
        userId,
      })

      return {
        aspectRatio: resolvedAspectRatio,
        creditsUsed: persisted.creditsUsed,
        images: persisted.images.map((image) => ({
          mimeType: image.mimeType,
          storagePath: image.storagePath,
          url: image.url,
        })),
        message:
          persisted.images.length === 1
              ? `Generated 1 image with ${modelIdentifier}.`
              : `Generated ${persisted.images.length} images with ${modelIdentifier}.`,
        model: modelIdentifier,
        status: "completed" as const,
        usedReferenceCount: referenceImageUrls.length,
        variantCount: persisted.images.length,
      }
    },
  })
}
