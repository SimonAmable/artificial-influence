import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { prepareGeneratedImageForStorage } from "@/lib/server/prepare-generated-image-for-storage"

export function getGeneratedImageFileExtension(mimeType: string, fallback = "png") {
  const normalized = mimeType.toLowerCase()

  if (normalized === "image/jpeg") return "jpg"
  if (normalized === "image/png") return "png"
  if (normalized === "image/webp") return "webp"
  if (normalized === "image/gif") return "gif"
  if (normalized === "image/avif") return "avif"
  if (normalized === "image/svg+xml") return "svg"

  return fallback
}

export interface StoredGeneratedImage {
  mimeType: string
  storagePath: string
  url: string
}

export async function uploadPreparedGeneratedImage({
  autoStrip,
  base64,
  buffer,
  index,
  mimeType = "image/png",
  modelIdentifier,
  remoteUrl,
  supabase,
  userId,
}: {
  autoStrip: boolean
  base64?: string
  buffer?: Buffer
  index: number
  mimeType?: string
  modelIdentifier: string
  remoteUrl?: string
  supabase: SupabaseClient
  userId: string
}): Promise<StoredGeneratedImage> {
  const prepared = await prepareGeneratedImageForStorage({
    autoStrip,
    buffer: buffer ?? (base64 ? Buffer.from(base64, "base64") : undefined),
    mimeType,
    modelIdentifier,
    remoteUrl,
  })

  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).slice(2, 10)
  const extension = getGeneratedImageFileExtension(prepared.mimeType)
  const storagePath = `${userId}/image-generations/${timestamp}-${randomStr}-${index + 1}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from("public-bucket")
    .upload(storagePath, prepared.buffer, {
      contentType: prepared.mimeType,
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Failed to upload generated image: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage.from("public-bucket").getPublicUrl(storagePath)

  return {
    mimeType: prepared.mimeType,
    storagePath,
    url: urlData.publicUrl,
  }
}
