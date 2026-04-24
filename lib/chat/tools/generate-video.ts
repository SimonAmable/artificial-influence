import Replicate from "replicate"
import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { inferStoragePathFromUrl } from "@/lib/assets/library"
import { resolveWan27Replicate } from "@/lib/server/wan-2.7-replicate"
import { checkUserHasCredits } from "@/lib/credits"
import type {
  AvailableChatImageReference,
  ChatImageReference,
} from "@/lib/chat/tools/image-reference-types"
import { mediaIdStringSchema } from "@/lib/chat/media-id"
import { resolveToolAudioReferences } from "@/lib/chat/resolve-tool-audio-references"
import { resolveToolImageReferences } from "@/lib/chat/resolve-tool-references"
import { resolveToolVideoReferences } from "@/lib/chat/resolve-tool-video-references"

const DEFAULT_TEXT_TO_VIDEO_MODEL = "kwaivgi/kling-v2.6" as const
const DEFAULT_MOTION_COPY_MODEL = "kwaivgi/kling-v3-motion-control" as const
const MAX_REFERENCE_IMAGES = 4
const MAX_REFERENCE_VIDEOS = 2
const MAX_REFERENCE_AUDIOS = 3
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

export interface ChatVideoReference {
  filename?: string
  mediaType?: string
  url: string
}

/** Same shape as {@link ChatVideoReference}; used for user audio attachments. */
export type ChatAudioReference = ChatVideoReference

/** Transcript id `refv_N` → user-uploaded video in this conversation. */
export interface AvailableChatVideoReference extends ChatVideoReference {
  id: string
  label: string
}

/** Transcript id `refa_N` → uploaded or generated audio in this conversation. */
export interface AvailableChatAudioReference extends ChatAudioReference {
  id: string
  label: string
}

interface CreateGenerateVideoToolOptions {
  availableReferences: AvailableChatImageReference[]
  availableVideoReferences: AvailableChatVideoReference[]
  availableAudioReferences: AvailableChatAudioReference[]
  supabase: SupabaseClient
  threadId?: string
  userId: string
}

interface StoredMediaAsset {
  mimeType: string
  storagePath: string | null
  url: string
}

function getFileExtension(mimeType: string, fallback: string) {
  const normalized = mimeType.toLowerCase()

  if (normalized === "video/webm") return "webm"
  if (normalized === "video/quicktime") return "mov"
  if (normalized === "video/mp4") return "mp4"
  if (normalized === "image/jpeg") return "jpg"
  if (normalized === "image/png") return "png"
  if (normalized === "image/webp") return "webp"
  if (normalized === "audio/mpeg" || normalized === "audio/mp3") return "mp3"
  if (normalized === "audio/wav" || normalized === "audio/x-wav") return "wav"
  if (normalized === "audio/webm") return "webm"
  if (normalized === "audio/ogg") return "ogg"
  if (normalized === "audio/flac") return "flac"
  if (normalized === "audio/mp4" || normalized === "audio/x-m4a") return "m4a"
  if (normalized === "audio/aac") return "aac"

  return fallback
}

function sanitizeFileStem(value: string | undefined, fallback: string) {
  const cleaned = value?.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "")
  return cleaned && cleaned.length > 0 ? cleaned.toLowerCase() : fallback
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/)

  if (!match) {
    throw new Error("Only base64 data URLs are supported for chat media references.")
  }

  const [, mimeType, base64] = match
  const buffer = Buffer.from(base64, "base64")

  if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new Error("Attached media is too large for chat video generation.")
  }

  return {
    buffer,
    mimeType,
  }
}

function validateReferenceUrl(url: string) {
  if (url.startsWith("data:")) return

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error("Reference media URL is invalid.")
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
    throw new Error("Reference media URLs must come from this app's stored assets.")
  }
}

function dedupeReferences<T extends { url: string }>(references: T[]) {
  const seen = new Set<string>()

  return references.filter((reference) => {
    if (seen.has(reference.url)) return false
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
}): Promise<StoredMediaAsset> {
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).slice(2, 10)
  const extension = getFileExtension(mimeType, folder.includes("video") ? "mp4" : "png")
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

async function uploadMediaReference({
  folder,
  kind,
  reference,
  index,
  supabase,
  userId,
}: {
  folder: string
  kind: "image" | "video" | "audio"
  reference: { filename?: string; mediaType?: string; url: string }
  index: number
  supabase: SupabaseClient
  userId: string
}) {
  if (!reference.url.startsWith("data:")) {
    validateReferenceUrl(reference.url)
    return {
      mimeType:
        reference.mediaType ??
        (kind === "video" ? "video/mp4" : kind === "audio" ? "audio/mpeg" : "image/png"),
      storagePath: inferStoragePathFromUrl(reference.url),
      url: reference.url,
    }
  }

  const { buffer, mimeType } = parseDataUrl(reference.url)
  if (!mimeType.startsWith(`${kind}/`)) {
    throw new Error(`Only ${kind} attachments can be used here.`)
  }

  return uploadBufferToStorage({
    buffer,
    filenameHint: reference.filename ?? `${kind}-reference-${index + 1}`,
    folder,
    mimeType,
    supabase,
    userId,
  })
}

async function loadAssetReferences(assetIds: string[], supabase: SupabaseClient, userId: string) {
  if (assetIds.length === 0) return []

  const { data, error } = await supabase
    .from("assets")
    .select("id, user_id, asset_type, asset_url, visibility, title")
    .in("id", assetIds)

  if (error) {
    throw new Error(`Failed to load saved assets: ${error.message}`)
  }

  const assets = (data ?? []).filter((asset) => asset.user_id === userId || asset.visibility === "public")
  if (assets.length !== assetIds.length) {
    throw new Error("One or more saved assets could not be accessed.")
  }

  return assets.map((asset) => ({
    assetType: asset.asset_type as "image" | "video" | "audio",
    storagePath: inferStoragePathFromUrl(String(asset.asset_url)),
    title: typeof asset.title === "string" ? asset.title : undefined,
    url: String(asset.asset_url),
  }))
}

export function createGenerateVideoTool({
  availableReferences,
  availableVideoReferences,
  availableAudioReferences,
  supabase,
  threadId,
  userId,
}: CreateGenerateVideoToolOptions) {
  const availableReferenceMap = new Map(
    availableReferences.map((reference) => [reference.id, reference] as const),
  )
  const availableVideoReferenceMap = new Map(
    availableVideoReferences.map((reference) => [reference.id, reference] as const),
  )
  const availableAudioReferenceMap = new Map(
    availableAudioReferences.map((reference) => [reference.id, reference] as const),
  )

  return tool({
    description:
      "Generate a video using UniCan's active video models. Pass **reference images** via **referenceIds** (`ref_1`…`ref_N`, `upl_<uuid>` / `gen_<uuid>`, raw UUID, or **mediaId** from listRecentGenerations). Pass **videos** via **referenceVideoIds** (`refv_1`…, same upl_/gen_ shapes). Pass **audio** via **referenceAudioIds** (`refa_1`…, same upl_/gen_ shapes). Deprecated alias for image refs: **mediaIds**. Use assetIds only for saved library assets. Nothing is auto-included from attachments. Use the transcript manifest or listThreadMedia. If this returns **pending**, do not call awaitGeneration or scheduleGenerationFollowUp unless another tool or automatic follow-up in this same workflow needs the finished video.",
    inputSchema: z.object({
      prompt: z
        .string()
        .max(2000)
        .optional()
        .describe(
          "Video prompt. When the user gave detailed/explicit wording or asked for exact/literal use, pass it verbatim. May be empty for motion-copy models that use an image and a video reference.",
        ),
      modelIdentifier: z
        .string()
        .min(1)
        .max(120)
        .optional()
        .describe("Active video model identifier. Defaults to kling-v2.6, or kwaivgi/kling-v3-motion-control (Kling 3.0 motion copy) when both image and video references are present."),
      assetIds: z
        .array(z.string().uuid())
        .max(6)
        .optional()
        .describe(
          "Saved asset UUIDs from searchAssets. Mixed image, video, and audio assets are allowed (e.g. reference audio for Seedance 2.0). Do not pass URLs or storage paths here.",
        ),
      referenceIds: z
        .array(z.string().min(1))
        .max(MAX_REFERENCE_IMAGES)
        .optional()
        .describe(
          "Reference images: ref_1…ref_N, upl_/gen_ prefixed, raw UUID, or mediaId from listRecentGenerations.",
        ),
      referenceVideoIds: z
        .array(z.string().min(1))
        .max(MAX_REFERENCE_VIDEOS)
        .optional()
        .describe(
          "Reference videos: refv_1…ref_N, upl_/gen_ prefixed, raw UUID, or mediaId from listThreadMedia / listRecentGenerations.",
        ),
      referenceAudioIds: z
        .array(z.string().min(1))
        .max(MAX_REFERENCE_AUDIOS)
        .optional()
        .describe(
          "Reference audio: refa_1…, upl_/gen_ prefixed, raw UUID, or mediaId from listThreadMedia / listRecentGenerations.",
        ),
      mediaIds: z
        .array(mediaIdStringSchema)
        .max(MAX_REFERENCE_IMAGES)
        .optional()
        .describe("Deprecated alias for referenceIds."),
      aspectRatio: z.string().min(1).max(32).optional(),
      duration: z.number().int().min(1).max(15).optional(),
      negativePrompt: z.string().max(1000).optional(),
      generateAudio: z.boolean().optional(),
      keepOriginalSound: z.boolean().optional(),
      mode: z.enum(["pro", "std"]).optional(),
      characterOrientation: z
        .enum(["image", "video"])
        .optional()
        .describe(
          "Kling motion-control only. 'video' (default) matches the reference video's orientation and allows reference videos up to 30s. 'image' keeps the still-image orientation but caps the reference video at 10s. Only pass 'image' if the user explicitly wants the character locked to the still image.",
        ),
    }),
    strict: true,
    execute: async ({
      prompt = "",
      modelIdentifier,
      assetIds = [],
      mediaIds = [],
      referenceIds = [],
      referenceVideoIds = [],
      referenceAudioIds = [],
      aspectRatio,
      duration,
      negativePrompt,
      generateAudio,
      keepOriginalSound,
      mode,
      characterOrientation,
    }) => {
      const { references: resolvedFromIds, warnings: imageRefWarnings } =
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

      const { references: resolvedVideoFromIds, warnings: videoRefWarnings } =
        referenceVideoIds.length > 0
          ? await resolveToolVideoReferences({
              supabase,
              userId,
              threadId,
              referenceIds: referenceVideoIds,
              availableReferenceMap: availableVideoReferenceMap,
              allowCrossThread: true,
            })
          : { references: [] as ChatVideoReference[], warnings: [] as string[] }

      const { references: resolvedAudioFromIds, warnings: audioRefWarnings } =
        referenceAudioIds.length > 0
          ? await resolveToolAudioReferences({
              supabase,
              userId,
              threadId,
              referenceIds: referenceAudioIds,
              availableReferenceMap: availableAudioReferenceMap,
              allowCrossThread: true,
            })
          : { references: [] as ChatAudioReference[], warnings: [] as string[] }

      const referenceWarnings = [...imageRefWarnings, ...videoRefWarnings, ...audioRefWarnings]

      if (!process.env.REPLICATE_API_TOKEN) {
        throw new Error("REPLICATE_API_TOKEN is not configured.")
      }

      const assetReferences = await loadAssetReferences(assetIds, supabase, userId)
      const imageReferences = dedupeReferences([
        ...resolvedFromIds,
        ...assetReferences
          .filter((asset) => asset.assetType === "image")
          .map((asset) => ({
            filename: asset.title,
            mediaType: "image/png",
            url: asset.url,
          })),
      ]).slice(0, MAX_REFERENCE_IMAGES)
      const videoReferences = dedupeReferences([
        ...resolvedVideoFromIds,
        ...assetReferences
          .filter((asset) => asset.assetType === "video")
          .map((asset) => ({
            filename: asset.title,
            mediaType: "video/mp4",
            url: asset.url,
          })),
      ]).slice(0, MAX_REFERENCE_VIDEOS)
      const audioReferences = dedupeReferences([
        ...resolvedAudioFromIds,
        ...assetReferences
          .filter((asset) => asset.assetType === "audio")
          .map((asset) => ({
            filename: asset.title,
            mediaType: "audio/mpeg",
            url: asset.url,
          })),
      ]).slice(0, MAX_REFERENCE_AUDIOS)

      const [uploadedImages, uploadedVideos, uploadedAudios] = await Promise.all([
        Promise.all(
          imageReferences.map((reference, index) =>
            uploadMediaReference({
              folder: "chat-video-image-references",
              index,
              kind: "image",
              reference,
              supabase,
              userId,
            }),
          ),
        ),
        Promise.all(
          videoReferences.map((reference, index) =>
            uploadMediaReference({
              folder: "chat-video-video-references",
              index,
              kind: "video",
              reference,
              supabase,
              userId,
            }),
          ),
        ),
        Promise.all(
          audioReferences.map((reference, index) =>
            uploadMediaReference({
              folder: "chat-video-audio-references",
              index,
              kind: "audio",
              reference,
              supabase,
              userId,
            }),
          ),
        ),
      ])

      const primaryImage = uploadedImages[0]?.url
      const secondaryImage = uploadedImages[1]?.url
      const additionalImages = uploadedImages.slice(2).map((item) => item.url)
      const primaryVideo = uploadedVideos[0]?.url
      const referenceAudioUrls = uploadedAudios.map((item) => item.url).filter((url) => typeof url === "string" && url.length > 0)
      const normalizedPrompt = prompt.trim()
      const resolvedModel =
        modelIdentifier ??
        (primaryImage && primaryVideo ? DEFAULT_MOTION_COPY_MODEL : DEFAULT_TEXT_TO_VIDEO_MODEL)
      const isMotionCopy =
        resolvedModel === "kwaivgi/kling-v2.6-motion-control" ||
        resolvedModel === "kwaivgi/kling-v3-motion-control"

      if (isMotionCopy && (!primaryImage || !primaryVideo)) {
        throw new Error("Motion-copy video generation requires both an image and a video reference.")
      }

      if (!isMotionCopy && normalizedPrompt.length === 0) {
        throw new Error("A prompt is required for this video model.")
      }

      if (
        resolvedModel === "bytedance/seedance-2.0" &&
        referenceAudioUrls.length > 0 &&
        uploadedImages.length === 0 &&
        uploadedVideos.length === 0
      ) {
        throw new Error(
          "Seedance 2.0 reference audio requires at least one reference image, reference video, or first-frame image. Attach an image or video (or use saved image/video assets) alongside the audio.",
        )
      }

      const { data: modelData, error: modelError } = await supabase
        .from("models")
        .select("model_cost")
        .eq("identifier", resolvedModel)
        .eq("type", "video")
        .eq("is_active", true)
        .single()

      if (modelError || !modelData) {
        throw new Error(`Model "${resolvedModel}" not found or is inactive`)
      }

      const requiredCredits = Math.max(1, Number(modelData.model_cost ?? 10) || 10)
      const hasCredits = await checkUserHasCredits(userId, requiredCredits, supabase)
      if (!hasCredits) {
        throw new Error(`Insufficient credits. This video generation requires ${requiredCredits} credits.`)
      }

      const webhookBase = process.env.REPLICATE_WEBHOOK_BASE_URL?.replace(/\/$/, "")
      if (!webhookBase) {
        throw new Error("REPLICATE_WEBHOOK_BASE_URL is not configured for async video generation.")
      }

      let replicateInput: Record<string, unknown> = {
        prompt: isMotionCopy ? normalizedPrompt : normalizedPrompt,
      }
      let replicateApiModel: string = resolvedModel

      switch (resolvedModel) {
        case "minimax/hailuo-2.3-fast":
          if (primaryImage) replicateInput.first_frame_image = primaryImage
          if (duration != null) replicateInput.duration = duration
          if (aspectRatio) replicateInput.aspect_ratio = aspectRatio
          break
        case "google/veo-3.1-fast":
          if (primaryImage) replicateInput.image = primaryImage
          if (secondaryImage) replicateInput.last_frame = secondaryImage
          if (negativePrompt) replicateInput.negative_prompt = negativePrompt
          if (duration != null) replicateInput.duration = duration
          if (aspectRatio) replicateInput.aspect_ratio = aspectRatio
          if (generateAudio !== undefined) replicateInput.generate_audio = generateAudio
          break
        case "kwaivgi/kling-v2.6":
          if (primaryImage) replicateInput.start_image = primaryImage
          if (aspectRatio) replicateInput.aspect_ratio = aspectRatio
          if (duration != null) replicateInput.duration = duration
          if (generateAudio !== undefined) replicateInput.generate_audio = generateAudio
          if (negativePrompt) replicateInput.negative_prompt = negativePrompt
          break
        case "kwaivgi/kling-v2.5-turbo-pro":
          if (primaryImage) replicateInput.start_image = primaryImage
          if (secondaryImage) replicateInput.end_image = secondaryImage
          if (aspectRatio) replicateInput.aspect_ratio = aspectRatio
          if (duration != null) replicateInput.duration = duration
          if (negativePrompt) replicateInput.negative_prompt = negativePrompt
          break
        case "kwaivgi/kling-v2.6-motion-control":
        case "kwaivgi/kling-v3-motion-control":
          if (primaryImage) replicateInput.image = primaryImage
          if (primaryVideo) replicateInput.video = primaryVideo
          if (mode) replicateInput.mode = mode
          if (keepOriginalSound !== undefined) replicateInput.keep_original_sound = keepOriginalSound
          replicateInput.character_orientation = characterOrientation ?? "video"
          break
        case "veed/fabric-1.0":
          if (duration != null) replicateInput.duration = duration
          break
        case "xai/grok-imagine-video":
          if (primaryImage) replicateInput.image = primaryImage
          if (primaryVideo) replicateInput.video = primaryVideo
          if (duration != null) replicateInput.duration = duration
          if (aspectRatio) replicateInput.aspect_ratio = aspectRatio
          break
        case "kwaivgi/kling-v3-video":
          if (primaryImage) replicateInput.start_image = primaryImage
          if (secondaryImage) replicateInput.end_image = secondaryImage
          if (mode) replicateInput.mode = mode
          if (duration != null) replicateInput.duration = duration
          if (aspectRatio) replicateInput.aspect_ratio = aspectRatio
          if (generateAudio !== undefined) replicateInput.generate_audio = generateAudio
          if (negativePrompt) replicateInput.negative_prompt = negativePrompt
          break
        case "kwaivgi/kling-v3-omni-video":
          if (primaryImage) replicateInput.start_image = primaryImage
          if (secondaryImage) replicateInput.end_image = secondaryImage
          if (additionalImages.length > 0) replicateInput.reference_images = additionalImages
          if (primaryVideo) replicateInput.reference_video = primaryVideo
          if (mode) replicateInput.mode = mode
          if (duration != null) replicateInput.duration = duration
          if (aspectRatio) replicateInput.aspect_ratio = aspectRatio
          if (generateAudio !== undefined) replicateInput.generate_audio = generateAudio
          if (keepOriginalSound !== undefined) replicateInput.keep_original_sound = keepOriginalSound
          if (negativePrompt) replicateInput.negative_prompt = negativePrompt
          break
        case "bytedance/seedance-2.0": {
          const refMode = Boolean(primaryVideo) || additionalImages.length > 0
          if (duration != null) replicateInput.duration = duration
          if (aspectRatio) replicateInput.aspect_ratio = aspectRatio
          if (generateAudio !== undefined) replicateInput.generate_audio = generateAudio
          if (refMode) {
            const refImages = [primaryImage, secondaryImage, ...additionalImages].filter(
              (url): url is string => typeof url === "string" && url.length > 0,
            )
            if (refImages.length > 0) replicateInput.reference_images = refImages
            if (primaryVideo) replicateInput.reference_videos = [primaryVideo]
          } else {
            if (primaryImage) replicateInput.image = primaryImage
            if (secondaryImage) replicateInput.last_frame_image = secondaryImage
          }
          if (referenceAudioUrls.length > 0) replicateInput.reference_audios = referenceAudioUrls
          break
        }
        case "wan-video/wan-2.7": {
          const wan = resolveWan27Replicate(
            {
              prompt: normalizedPrompt,
              image: primaryImage,
              first_frame_image: primaryImage,
              last_frame: secondaryImage,
              negative_prompt: negativePrompt,
              audio: referenceAudioUrls[0],
            },
            {
              duration: duration ?? undefined,
              aspect_ratio: aspectRatio,
              negative_prompt: negativePrompt,
            },
          )
          replicateInput = wan.replicateInput
          replicateApiModel = wan.replicateModel
          break
        }
        default:
          throw new Error(`Unsupported video model: ${resolvedModel}`)
      }

      const replicate = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN,
      })

      const webhookUrl = `${webhookBase}/api/webhooks/replicate`
      const replicateModelMatch = replicateApiModel.match(/^([^/]+\/[^:]+):(.+)$/)
      const prediction = await replicate.predictions.create(
        replicateModelMatch
          ? {
              version: replicateModelMatch[2],
              input: replicateInput,
              webhook: webhookUrl,
              webhook_events_filter: ["completed"],
            }
          : {
              model: replicateApiModel as `${string}/${string}`,
              input: replicateInput,
              webhook: webhookUrl,
              webhook_events_filter: ["completed"],
            },
      )

      const referenceImageStoragePaths = uploadedImages
        .map((item) => item.storagePath)
        .filter((value): value is string => Boolean(value))
      const referenceVideoStoragePaths = uploadedVideos
        .map((item) => item.storagePath)
        .filter((value): value is string => Boolean(value))

      const { data: pendingGeneration, error: saveError } = await supabase
        .from("generations")
        .insert({
          user_id: userId,
          prompt: normalizedPrompt || null,
          supabase_storage_path: null,
          reference_images_supabase_storage_path:
            referenceImageStoragePaths.length > 0 ? referenceImageStoragePaths : null,
          reference_videos_supabase_storage_path:
            referenceVideoStoragePaths.length > 0 ? referenceVideoStoragePaths : null,
          model: resolvedModel,
          type: "video",
          is_public: true,
          tool: "chat-generate-video",
          status: "pending",
          replicate_prediction_id: prediction.id,
          ...(threadId ? { chat_thread_id: threadId } : {}),
        })
        .select("id")
        .single()

      if (saveError || !pendingGeneration) {
        console.error("[chat/generate-video] Failed to save generation row:", saveError)
        throw new Error("Failed to create pending video generation.")
      }

      return {
        generationId: pendingGeneration.id,
        message: `Started a video generation with ${resolvedModel}. If no later tool or automatic follow-up in this workflow needs the finished video, stop here and let the UI update asynchronously.`,
        model: resolvedModel,
        nextStepHint:
          "Only call awaitGeneration for short same-turn dependency chains, or scheduleGenerationFollowUp for long video chains that truly require a later automatic step. Otherwise reply to the user and stop.",
        predictionId: prediction.id,
        status: "pending" as const,
        usedImageReferenceCount: uploadedImages.length,
        usedVideoReferenceCount: uploadedVideos.length,
        usedAudioReferenceCount: uploadedAudios.length,
        ...(referenceWarnings.length > 0 ? { warnings: referenceWarnings } : {}),
      }
    },
  })
}
