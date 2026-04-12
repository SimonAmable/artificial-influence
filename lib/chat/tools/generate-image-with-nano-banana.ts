import Replicate from "replicate"
import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { inferStoragePathFromUrl } from "@/lib/assets/library"
import {
  runReplicatePollingImageGeneration,
} from "@/lib/server/replicate-image-generation"
import { checkUserHasCredits } from "@/lib/credits"

const NANO_BANANA_MODEL = "google/nano-banana-2" as const
const MAX_REFERENCE_IMAGES = 4
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

const aspectRatioSchema = z.enum([
  "1:1",
  "3:4",
  "4:5",
  "9:16",
  "16:9",
  "match_input_image",
])

export interface ChatImageReference {
  filename?: string
  mediaType?: string
  url: string
}

export interface AvailableChatImageReference extends ChatImageReference {
  id: string
  label: string
  source: "user-upload" | "generated"
}

interface CreateGenerateImageWithNanoBananaToolOptions {
  availableReferences: AvailableChatImageReference[]
  latestUserImages: ChatImageReference[]
  supabase: SupabaseClient
  userId: string
}

interface StoredAsset {
  mimeType: string
  storagePath: string
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
      storagePath: null,
      url: reference.url,
    }
  }

  const { buffer, mimeType } = parseDataUrl(reference.url)

  if (!mimeType.startsWith("image/")) {
    throw new Error("Only image attachments can be used as Nano Banana references.")
  }

  const storedAsset = await uploadBufferToStorage({
    buffer,
    filenameHint: reference.filename ?? `reference-${index + 1}`,
    folder: "chat-reference-images",
    mimeType,
    supabase,
    userId,
  })

  return storedAsset
}

export function createGenerateImageWithNanoBananaTool({
  availableReferences,
  latestUserImages,
  supabase,
  userId,
}: CreateGenerateImageWithNanoBananaToolOptions) {
  const availableReferenceMap = new Map(
    availableReferences.map((reference) => [reference.id, reference] as const),
  )

  return tool({
    description:
      "Generate or edit an image with Nano Banana 2 (google/nano-banana-2). The Replicate `prompt` input must be a JSON string whose **content** describes the scene or edit: include a rich `image_description` object (text-to-image) **or** a rich `edit_description` object (edits), plus `prompt` and `negative_constraints` as needed. Do **not** embed `recommended_model` or `output_specs` here—the tool is always Nano Banana 2; set aspectRatio and variantCount on the tool instead. Current-turn image attachments are passed automatically; include referenceIds for earlier chat images when needed.",
    inputSchema: z.object({
      prompt: z
        .string()
        .min(2)
        .describe(
          "JSON string sent to the model: structured brief only. Use either (1) `image_description` { ... } for new images, or (2) `edit_description` { ... } for edits (what to preserve vs change, target outcome). Always include a fluent master `prompt` and `negative_constraints` when useful. Omit `recommended_model` and `output_specs`. Do not pass prose-only when a structured package was composed.",
        ),
      aspectRatio: aspectRatioSchema
        .optional()
        .describe("Preferred aspect ratio. Use match_input_image when editing or recreating from a reference image."),
      variantCount: z
        .number()
        .int()
        .min(1)
        .max(4)
        .optional()
        .describe("How many image variations to generate. Keep this low unless the user explicitly asks for multiple options."),
      referenceIds: z
        .array(z.string().min(1))
        .max(MAX_REFERENCE_IMAGES)
        .optional()
        .describe("Reference IDs for earlier chat images, such as ref_1 or ref_2. Use these when the request depends on an earlier image from the conversation."),
    }),
    execute: async ({
      aspectRatio,
      prompt,
      referenceIds = [],
      variantCount = 1,
    }) => {
      if (!process.env.REPLICATE_API_TOKEN) {
        throw new Error("REPLICATE_API_TOKEN is not configured.")
      }

      const resolvedReferenceIds = referenceIds.map((referenceId) => {
        const reference = availableReferenceMap.get(referenceId)

        if (!reference) {
          throw new Error(`Unknown reference ID: ${referenceId}`)
        }

        return reference
      })

      const referenceImages = dedupeReferences([
        ...latestUserImages,
        ...resolvedReferenceIds,
      ]).slice(0, MAX_REFERENCE_IMAGES)
      const uploadedReferences = await Promise.all(
        referenceImages.map((reference, index) =>
          uploadReferenceImage(reference, index, supabase, userId),
        ),
      )

      const referenceUrls = uploadedReferences.map((reference) => reference.url)
      const referenceStoragePaths = uploadedReferences
        .map((reference) => reference.storagePath ?? inferStoragePathFromUrl(reference.url))
        .filter((value): value is string => Boolean(value))
      const resolvedAspectRatio =
        aspectRatio ?? (referenceUrls.length > 0 ? "match_input_image" : "1:1")
      const { data: modelData, error: modelError } = await supabase
        .from("models")
        .select("model_cost, max_images")
        .eq("identifier", NANO_BANANA_MODEL)
        .eq("type", "image")
        .eq("is_active", true)
        .single()

      if (modelError || !modelData) {
        throw new Error(`Model "${NANO_BANANA_MODEL}" not found or is inactive`)
      }

      const maxImages = Math.max(1, Number(modelData.max_images ?? 1) || 1)
      const effectiveVariantCount = Math.min(variantCount, maxImages)
      const costPerImage = Math.max(1, Number(modelData.model_cost ?? 1) || 1)
      const requiredCredits = Math.max(1, costPerImage * effectiveVariantCount)
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
        const prediction = await replicate.predictions.create({
          model: NANO_BANANA_MODEL,
          input: {
            prompt,
            aspect_ratio: resolvedAspectRatio,
            ...(referenceUrls.length > 0 ? { image_input: referenceUrls } : {}),
            ...(effectiveVariantCount > 1 ? { num_outputs: effectiveVariantCount } : {}),
            google_search: true,
            image_search: true,
          },
          webhook: webhookUrl,
          webhook_events_filter: ["completed"],
        })

        const { data: pendingGeneration, error: saveError } = await supabase
          .from("generations")
          .insert({
            user_id: userId,
            prompt,
            supabase_storage_path: null,
            reference_images_supabase_storage_path: referenceStoragePaths.length > 0 ? referenceStoragePaths : null,
            aspect_ratio: resolvedAspectRatio,
            model: NANO_BANANA_MODEL,
            type: "image",
            is_public: true,
            tool: "chat-nano-banana",
            status: "pending",
            replicate_prediction_id: prediction.id,
          })
          .select("id")
          .single()

        if (saveError || !pendingGeneration) {
          console.error("[chat/nano-banana] Failed to save generation row:", saveError)
          throw new Error("Failed to create pending image generation.")
        }

        return {
          aspectRatio: resolvedAspectRatio,
          generationId: pendingGeneration.id,
          message: `Started an image generation with ${NANO_BANANA_MODEL}.`,
          model: NANO_BANANA_MODEL,
          predictionId: prediction.id,
          status: "pending" as const,
          usedReferenceCount: referenceUrls.length,
          variantCount: effectiveVariantCount,
        }
      }

      const result = await runReplicatePollingImageGeneration({
        aspectRatio: resolvedAspectRatio,
        modelIdentifier: NANO_BANANA_MODEL,
        prompt,
        referenceImageStoragePaths: referenceStoragePaths,
        replicateInput: {
          prompt,
          aspect_ratio: resolvedAspectRatio,
          ...(referenceUrls.length > 0 ? { image_input: referenceUrls } : {}),
          ...(effectiveVariantCount > 1 ? { num_outputs: effectiveVariantCount } : {}),
          google_search: true,
          image_search: true,
        },
        requiredCredits,
        supabase,
        tool: "chat-nano-banana",
        userId,
      })

      return {
        aspectRatio: resolvedAspectRatio,
        creditsUsed: result.creditsUsed,
        images: result.images.map((image) => ({
          mimeType: image.mimeType,
          storagePath: image.storagePath,
          url: image.url,
        })),
        message:
          result.images.length === 1
            ? "Generated 1 image with Nano Banana 2."
            : `Generated ${result.images.length} images with Nano Banana 2.`,
        model: NANO_BANANA_MODEL,
        status: "completed" as const,
        usedReferenceCount: referenceUrls.length,
        variantCount: result.images.length,
      }
    },
  })
}
