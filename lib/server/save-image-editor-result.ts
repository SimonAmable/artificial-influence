import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getAutoStripImageMetadata } from "@/lib/server/auto-strip-image-metadata"
import { uploadPreparedGeneratedImage } from "@/lib/server/store-generated-image"
import { inferStoragePathFromUrl } from "@/lib/uploads/storage-ref"

export const IMAGE_EDITOR_TOOL = "image_editing"
export const IMAGE_EDITOR_EXPORT_MODEL = "image-editor"

export type SaveImageEditorResultInput = {
  supabase: SupabaseClient
  userId: string
  imageBuffer: Buffer
  mimeType?: string
  sourceImageUrl?: string | null
  prompt?: string | null
}

export type SaveImageEditorResultOutput = {
  url: string
  generationId: string
  storagePath: string
}

export async function saveImageEditorResult(
  input: SaveImageEditorResultInput
): Promise<SaveImageEditorResultOutput> {
  const autoStrip = await getAutoStripImageMetadata(input.supabase, input.userId)

  const stored = await uploadPreparedGeneratedImage({
    autoStrip,
    buffer: input.imageBuffer,
    index: 0,
    mimeType: input.mimeType ?? "image/png",
    modelIdentifier: IMAGE_EDITOR_EXPORT_MODEL,
    supabase: input.supabase,
    userId: input.userId,
  })

  let referenceImageStoragePaths: string[] | null = null
  const trimmedSource = input.sourceImageUrl?.trim()
  if (trimmedSource) {
    const inferred = inferStoragePathFromUrl(trimmedSource)
    if (inferred) {
      referenceImageStoragePaths = [inferred]
    }
  }

  const { data: generationRow, error: genError } = await input.supabase
    .from("generations")
    .insert({
      user_id: input.userId,
      prompt: input.prompt?.trim() || "Image editor export",
      supabase_storage_path: stored.storagePath,
      reference_images_supabase_storage_path: referenceImageStoragePaths,
      model: IMAGE_EDITOR_EXPORT_MODEL,
      type: "image",
      is_public: true,
      tool: IMAGE_EDITOR_TOOL,
      status: "completed",
      error_message: null,
    })
    .select("id")
    .single()

  if (genError || !generationRow?.id) {
    throw new Error(genError?.message ?? "Failed to save image editor result")
  }

  return {
    url: stored.url,
    generationId: generationRow.id,
    storagePath: stored.storagePath,
  }
}
