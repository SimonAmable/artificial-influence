import Replicate from "replicate"
import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { inferStoragePathFromUrl } from "@/lib/assets/library"
import {
  runReplicatePollingImageGeneration,
} from "@/lib/server/replicate-image-generation"
import { checkUserHasCredits } from "@/lib/credits"
import { mediaIdStringSchema } from "@/lib/chat/media-id"
import { resolveToolImageReferences } from "@/lib/chat/resolve-tool-references"

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
  supabase: SupabaseClient
  threadId?: string
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
  supabase,
  threadId,
  userId,
}: CreateGenerateImageWithNanoBananaToolOptions) {
  const availableReferenceMap = new Map(
    availableReferences.map((reference) => [reference.id, reference] as const),
  )

  return tool({
    description:
      "Generate or edit an image with Nano Banana 2 (google/nano-banana-2). Nano Banana accepts **either** plain prose **or** a JSON creative brief in the `prompt` field. Pick based on the user's intent, not a blanket rule.\n\n" +
      "Decide the mode before calling:\n" +
      "- **Literal mode** (set `rawPrompt: true`): pass the user's exact wording as `prompt`. Use when the user supplied a quoted prompt, labeled it (`prompt:` / `\"prompt\": \"...\"`), said exact/verbatim/literal/as-written/copy-paste/don't rewrite, pasted a finished prompt, or issued a short edit command paired with reference images (e.g. \"merge these\", \"swap outfits\", \"make it night\"). Do **not** wrap their text in JSON, do **not** add image_description/edit_description/negative_constraints, do **not** \"polish\" it. Short is fine.\n" +
      "- **Expand mode** (leave `rawPrompt` unset): the user gave a vague idea and expects you to compose a production-ready prompt. Build a JSON string with a rich `image_description` object (new images) **or** `edit_description` object (edits), a fluent master `prompt` field, and `negative_constraints` when useful. Omit `recommended_model` and `output_specs`; set `aspectRatio` and `variantCount` as tool args instead.\n\n" +
      "When in doubt between Literal and Expand, prefer Literal. Silently rewriting a user's prompt is worse than a terser result they can iterate on.\n\n" +
      "If this tool returns **pending**, do not call awaitGeneration unless another tool in this same turn immediately needs the finished image.\n\n" +
      "For reference images from earlier in the chat or from listRecentGenerations, pass **referenceIds**: `ref_1`…`ref_N` (transcript), `upl_<uuid>` / `gen_<uuid>`, or raw UUID (`mediaId` from listRecentGenerations). Deprecated alias: **mediaIds** (same values).",
    inputSchema: z.object({
      prompt: z
        .string()
        .min(2)
        .describe(
          "Text sent to google/nano-banana-2. Content depends on mode: (Literal, with rawPrompt=true) the user's exact wording, no wrapper, no added fields; (Expand, rawPrompt omitted) a JSON string with `image_description` OR `edit_description`, a fluent master `prompt`, and `negative_constraints` when useful. Omit `recommended_model` and `output_specs`. Never silently expand a user's verbatim prompt.",
        ),
      rawPrompt: z
        .boolean()
        .optional()
        .describe(
          "Set true for Literal mode: the `prompt` string is the user's exact wording and must be passed through without wrapping in JSON or adding creative fields. Triggers: quoted prompt, explicit requests for exact/verbatim/literal/as-written/copy-paste/don't-rewrite, pasted finished prompts, or short edit commands with references (e.g. \"merge these\"). Defaults to false (Expand mode: agent-composed JSON brief).",
        ),
      aspectRatio: aspectRatioSchema
        .optional()
        .describe("Preferred aspect ratio. Use match_input_image when editing or recreating from a reference image. Omit when the user didn't specify. The tool defaults sensibly based on references."),
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
        .describe(
          "Reference images: `ref_1`…`ref_N` (transcript), `upl_<uuid>` / `gen_<uuid>` or raw UUID from listThreadMedia / listRecentGenerations (mediaId).",
        ),
      mediaIds: z
        .array(mediaIdStringSchema)
        .max(MAX_REFERENCE_IMAGES)
        .optional()
        .describe("Deprecated alias for referenceIds (same accepted shapes)."),
    }),
    execute: async ({
      aspectRatio,
      prompt,
      rawPrompt = false,
      mediaIds = [],
      referenceIds = [],
      variantCount = 1,
    }) => {
      if (!process.env.REPLICATE_API_TOKEN) {
        throw new Error("REPLICATE_API_TOKEN is not configured.")
      }

      const { references: resolvedFromIds, warnings: referenceWarnings } =
        referenceIds.length > 0 || mediaIds.length > 0
          ? await resolveToolImageReferences({
              supabase,
              userId,
              threadId,
              referenceIds,
              mediaIds,
              availableReferenceMap: availableReferenceMap,
              allowCrossThread: true,
            })
          : { references: [] as ChatImageReference[], warnings: [] as string[] }

      const referenceImages = dedupeReferences(resolvedFromIds).slice(0, MAX_REFERENCE_IMAGES)
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
            ...(threadId ? { chat_thread_id: threadId } : {}),
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
          message: `Started an image generation with ${NANO_BANANA_MODEL}. If no later tool in this same turn needs the finished image, stop here and let the UI update asynchronously.`,
          model: NANO_BANANA_MODEL,
          nextStepHint:
            "Only call awaitGeneration when a later tool in this same turn needs the finished image (for example image -> video or image -> extract frames). Otherwise reply to the user and stop.",
          predictionId: prediction.id,
          promptMode: rawPrompt ? ("literal" as const) : ("expanded" as const),
          status: "pending" as const,
          usedReferenceCount: referenceUrls.length,
          variantCount: effectiveVariantCount,
          ...(referenceWarnings.length > 0 ? { warnings: referenceWarnings } : {}),
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
        promptMode: rawPrompt ? ("literal" as const) : ("expanded" as const),
        status: "completed" as const,
        usedReferenceCount: referenceUrls.length,
        variantCount: result.images.length,
        ...(referenceWarnings.length > 0 ? { warnings: referenceWarnings } : {}),
      }
    },
  })
}
