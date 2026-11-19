import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  normalizeTikTokVideoUrlToStorage,
  uploadTikTokReferenceImageRawToStorage,
  uploadTikTokReferenceVideoRawToStorage,
} from "@/lib/tiktok/normalize-video"
import type { SocialMediaItem, SocialMediaKind } from "./types"

export async function persistSocialMediaItem(input: {
  userId: string
  supabase: SupabaseClient
  item: SocialMediaItem
  filePrefix: string
}): Promise<{ publicUrl: string; storagePath: string; durationSeconds: number | null }> {
  const kind = input.item.kind
  if (kind === "image") {
    const uploaded = await uploadTikTokReferenceImageRawToStorage({
      mediaUrl: input.item.remoteUrl,
      userId: input.userId,
      supabase: input.supabase,
      fileName: `${input.filePrefix}-image-${input.item.index + 1}.jpg`,
    })
    return { publicUrl: uploaded.publicUrl, storagePath: uploaded.storagePath, durationSeconds: null }
  }

  const isAnimated = kind === "animated"
  const videoFileName = `${input.filePrefix}-${isAnimated ? "gif" : "video"}-${input.item.index + 1}.mp4`

  try {
    const normalized = await normalizeTikTokVideoUrlToStorage({
      mediaUrl: input.item.remoteUrl,
      userId: input.userId,
      supabase: input.supabase,
      fileName: videoFileName,
    })
    return {
      publicUrl: normalized.publicUrl,
      storagePath: normalized.storagePath,
      durationSeconds: input.item.durationSeconds,
    }
  } catch {
    const uploaded = await uploadTikTokReferenceVideoRawToStorage({
      mediaUrl: input.item.remoteUrl,
      userId: input.userId,
      supabase: input.supabase,
      fileName: videoFileName,
    })
    return {
      publicUrl: uploaded.publicUrl,
      storagePath: uploaded.storagePath,
      durationSeconds: input.item.durationSeconds,
    }
  }
}

export function normalizePersistedKind(kind: SocialMediaKind): "video" | "slideshow" | "image" {
  if (kind === "image") return "image"
  return "video"
}