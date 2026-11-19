import {
  buildInstagramPostActorInput,
  normalizeInstagramDatasetItem,
  runInstagramScraperActor,
} from "@/lib/server/apify/instagram-scraper"
import type { SocialImportAdapter, SocialImportManifest, SocialMediaItem } from "../types"
import { buildManifestExpiryIso } from "../types"

function mapInstagramToManifest(
  canonicalUrl: string,
  normalized: NonNullable<ReturnType<typeof normalizeInstagramDatasetItem>>,
): SocialImportManifest {
  const media: SocialMediaItem[] = []
  const fallbackImages =
    normalized.mediaUrls.length > 0
      ? normalized.mediaUrls
      : normalized.displayUrl
        ? [normalized.displayUrl]
        : []

  if (normalized.videoUrl) {
    media.push({
      index: 0,
      kind: "video",
      remoteUrl: normalized.videoUrl,
      previewUrl: normalized.displayUrl,
      width: null,
      height: null,
      durationSeconds: null,
    })
  }

  const imageStart = media.length
  fallbackImages.forEach((url, offset) => {
    if (normalized.videoUrl && offset === 0 && url === normalized.displayUrl) {
      return
    }
    media.push({
      index: imageStart + offset,
      kind: "image",
      remoteUrl: url,
      previewUrl: url,
      width: null,
      height: null,
      durationSeconds: null,
    })
  })

  if (media.length === 0) {
    throw new Error(
      "Instagram did not return downloadable video or images for this post. It may be private or restricted.",
    )
  }

  return {
    platform: "instagram",
    canonicalUrl,
    sourceTitle: normalized.caption,
    media,
    expiresAt: buildManifestExpiryIso(),
  }
}

export const instagramSocialImportAdapter: SocialImportAdapter = {
  platform: "instagram",
  matches(url) {
    const host = url.hostname.replace(/^www\./i, "").toLowerCase()
    if (host !== "instagram.com" && host !== "m.instagram.com") return false
    return /\/(p|reel|reels|tv)\/[^/?#]+/i.test(url.pathname)
  },
  async inspect(url) {
    const canonicalUrl = url.href
    const { items } = await runInstagramScraperActor(buildInstagramPostActorInput(canonicalUrl), 300)
    let normalized: ReturnType<typeof normalizeInstagramDatasetItem> = null
    for (const row of items) {
      normalized = normalizeInstagramDatasetItem(row)
      if (normalized) break
    }
    if (!normalized) {
      throw new Error("We couldn't find downloadable media for that Instagram link.")
    }
    return mapInstagramToManifest(canonicalUrl, normalized)
  },
}