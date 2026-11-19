import "server-only"

import { getVideoDurationSeconds } from "@/lib/video-editor/media-parser"
import type { SocialImportManifest, SocialMediaItem } from "./types"

async function probeItemDuration(item: SocialMediaItem): Promise<number | null> {
  if (item.kind === "image") return null
  try {
    const seconds = await getVideoDurationSeconds(item.remoteUrl)
    if (!Number.isFinite(seconds) || seconds <= 0) return null
    return Math.round(seconds * 10) / 10
  } catch {
    return null
  }
}

export async function enrichManifestWithDurations(
  manifest: SocialImportManifest,
): Promise<SocialImportManifest> {
  const media: SocialMediaItem[] = []
  for (const item of manifest.media) {
    const durationSeconds =
      item.durationSeconds ?? (item.kind !== "image" ? await probeItemDuration(item) : null)
    media.push({ ...item, durationSeconds })
  }
  return { ...manifest, media }
}