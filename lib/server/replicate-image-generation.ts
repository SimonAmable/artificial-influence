import Replicate from "replicate"
import type { SupabaseClient } from "@supabase/supabase-js"
import { checkUserHasCredits, deductUserCredits } from "@/lib/credits"

export class InsufficientCreditsError extends Error {
  requiredCredits: number

  constructor(requiredCredits: number, message?: string) {
    super(message ?? `Insufficient credits. This generation requires ${requiredCredits} credits.`)
    this.name = "InsufficientCreditsError"
    this.requiredCredits = requiredCredits
  }
}

export interface StoredGeneratedImage {
  mimeType: string
  storagePath: string
  url: string
}

interface FinalizeGeneratedImagesOptions {
  aspectRatio?: string | null
  images: StoredGeneratedImage[]
  modelIdentifier: string
  prompt: string
  referenceImageStoragePaths?: string[]
  requiredCredits: number
  supabase: SupabaseClient
  tool?: string | null
  userId: string
}

interface RunReplicatePollingImageGenerationOptions {
  aspectRatio?: string | null
  modelIdentifier: string
  prompt: string
  referenceImageStoragePaths?: string[]
  replicateInput: Record<string, unknown>
  requiredCredits: number
  skipCreditCheck?: boolean
  supabase: SupabaseClient
  tool?: string | null
  userId: string
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

function extractOutputUrls(output: unknown): string[] {
  const readUrl = (value: unknown): string | null => {
    if (typeof value === "string") return value

    if (value && typeof value === "object") {
      const candidate = value as { url?: string | (() => string) }

      if (typeof candidate.url === "function") {
        return candidate.url()
      }

      if (typeof candidate.url === "string") {
        return candidate.url
      }
    }

    return null
  }

  if (Array.isArray(output)) {
    return output.map(readUrl).filter((value): value is string => Boolean(value))
  }

  const singleUrl = readUrl(output)
  return singleUrl ? [singleUrl] : []
}

async function storeGeneratedImageFromUrl({
  index,
  remoteUrl,
  supabase,
  userId,
}: {
  index: number
  remoteUrl: string
  supabase: SupabaseClient
  userId: string
}): Promise<StoredGeneratedImage> {
  const response = await fetch(remoteUrl)

  if (!response.ok) {
    throw new Error(`Failed to download generated image (${response.status}).`)
  }

  const mimeType = response.headers.get("content-type") || "image/png"
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).slice(2, 10)
  const extension = getFileExtension(mimeType)
  const storagePath = `${userId}/image-generations/${timestamp}-${randomStr}-${index + 1}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from("public-bucket")
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Failed to upload generated image: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage.from("public-bucket").getPublicUrl(storagePath)

  return {
    mimeType,
    storagePath,
    url: urlData.publicUrl,
  }
}

async function storeGeneratedImageFromBase64({
  base64,
  index,
  mimeType = "image/png",
  supabase,
  userId,
}: {
  base64: string
  index: number
  mimeType?: string
  supabase: SupabaseClient
  userId: string
}): Promise<StoredGeneratedImage> {
  const buffer = Buffer.from(base64, "base64")
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).slice(2, 10)
  const extension = getFileExtension(mimeType)
  const storagePath = `${userId}/image-generations/${timestamp}-${randomStr}-${index + 1}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from("public-bucket")
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Failed to upload generated image: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage.from("public-bucket").getPublicUrl(storagePath)

  return {
    mimeType,
    storagePath,
    url: urlData.publicUrl,
  }
}

async function saveCompletedGenerations({
  aspectRatio,
  images,
  modelIdentifier,
  prompt,
  referenceImageStoragePaths,
  supabase,
  tool,
  userId,
}: {
  aspectRatio?: string | null
  images: StoredGeneratedImage[]
  modelIdentifier: string
  prompt: string
  referenceImageStoragePaths?: string[]
  supabase: SupabaseClient
  tool?: string | null
  userId: string
}) {
  if (images.length === 0) {
    return
  }

  const rows = images.map((image) => ({
    user_id: userId,
    prompt,
    supabase_storage_path: image.storagePath,
    reference_images_supabase_storage_path:
      referenceImageStoragePaths && referenceImageStoragePaths.length > 0
        ? referenceImageStoragePaths
        : null,
    aspect_ratio: aspectRatio ?? null,
    model: modelIdentifier,
    type: "image",
    is_public: true,
    tool: tool ?? null,
    status: "completed",
    error_message: null,
  }))

  const { error } = await supabase.from("generations").insert(rows)

  if (error) {
    console.error("[replicate-image-generation] Failed to save generations:", error)
  }
}

export async function finalizeGeneratedImages({
  aspectRatio,
  images,
  modelIdentifier,
  prompt,
  referenceImageStoragePaths,
  requiredCredits,
  supabase,
  tool,
  userId,
}: FinalizeGeneratedImagesOptions): Promise<{
  creditsUsed: number
  images: StoredGeneratedImage[]
}> {
  await saveCompletedGenerations({
    aspectRatio,
    images,
    modelIdentifier,
    prompt,
    referenceImageStoragePaths,
    supabase,
    tool,
    userId,
  })

  const balance = await deductUserCredits(userId, requiredCredits, supabase)
  if (balance < 0) {
    console.error(
      "[replicate-image-generation] Credit deduction returned an invalid balance",
      { requiredCredits, userId },
    )
  }

  return {
    creditsUsed: requiredCredits,
    images,
  }
}

export async function persistGeneratedBase64Images({
  aspectRatio,
  base64Images,
  mimeType,
  modelIdentifier,
  prompt,
  referenceImageStoragePaths = [],
  requiredCredits,
  supabase,
  tool,
  userId,
}: {
  aspectRatio?: string | null
  base64Images: string[]
  mimeType?: string
  modelIdentifier: string
  prompt: string
  referenceImageStoragePaths?: string[]
  requiredCredits: number
  supabase: SupabaseClient
  tool?: string | null
  userId: string
}): Promise<{
  creditsUsed: number
  images: StoredGeneratedImage[]
}> {
  const storedImages = await Promise.all(
    base64Images.map((base64, index) =>
      storeGeneratedImageFromBase64({
        base64,
        index,
        mimeType,
        supabase,
        userId,
      }),
    ),
  )

  return finalizeGeneratedImages({
    aspectRatio,
    images: storedImages,
    modelIdentifier,
    prompt,
    referenceImageStoragePaths,
    requiredCredits,
    supabase,
    tool,
    userId,
  })
}

export async function runReplicatePollingImageGeneration({
  aspectRatio,
  modelIdentifier,
  prompt,
  referenceImageStoragePaths = [],
  replicateInput,
  requiredCredits,
  skipCreditCheck = false,
  supabase,
  tool,
  userId,
}: RunReplicatePollingImageGenerationOptions): Promise<{
  creditsUsed: number
  images: StoredGeneratedImage[]
}> {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN is not configured.")
  }

  if (!skipCreditCheck) {
    const hasCredits = await checkUserHasCredits(userId, requiredCredits, supabase)
    if (!hasCredits) {
      throw new InsufficientCreditsError(requiredCredits)
    }
  }

  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  })

  const output = await replicate.run(modelIdentifier as `${string}/${string}`, {
    input: replicateInput,
    wait: { mode: "poll", interval: 2000 },
  })

  const outputUrls = extractOutputUrls(output)

  if (outputUrls.length === 0) {
    throw new Error("Replicate returned no output URLs")
  }

  const storedImages = await Promise.all(
    outputUrls.map((remoteUrl, index) =>
      storeGeneratedImageFromUrl({
        index,
        remoteUrl,
        supabase,
        userId,
      }),
    ),
  )

  return finalizeGeneratedImages({
    aspectRatio,
    images: storedImages,
    modelIdentifier,
    prompt,
    referenceImageStoragePaths,
    requiredCredits,
    supabase,
    tool,
    userId,
  })
}
