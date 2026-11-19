import {
  buildTikTokUrlDownloadActorInput,
  normalizeTikTokDatasetItems,
  pickFirstPlayableDownloadUrl,
  runTikTokScraperActor,
} from "@/lib/server/apify/tiktok-scraper"
import type { SocialImportAdapter, SocialImportManifest, SocialMediaItem } from "../types"
import { buildManifestExpiryIso } from "../types"

function mapTikTokToManifest(canonicalUrl: string, items: ReturnType<typeof normalizeTikTokDatasetItems>): SocialImportManifest {
  const first = items[0]
  if (!first) {
    throw new Error("We couldn't find media for that TikTok link.")
  }

  const media: SocialMediaItem[] = []
  const playable = pickFirstPlayableDownloadUrl(first)
  if (playable) {
    media.push({
      index: 0,
      kind: "video",
      remoteUrl: playable,
      previewUrl: first.coverUrl,
      width: null,
      height: null,
      durationSeconds: null,
    })
  }
  if (first.slideshowImageUrls.length > 0) {
    const baseIndex = media.length
    first.slideshowImageUrls.forEach((url, offset) => {
      media.push({
        index: baseIndex + offset,
        kind: "image",
        remoteUrl: url,
        previewUrl: url,
        width: null,
        height: null,
        durationSeconds: null,
      })
    })
  }

  if (media.length === 0) {
    throw new Error(
      "TikTok did not return downloadable video or images for this post (restricted or unavailable).",
    )
  }

  return {
    platform: "tiktok",
    canonicalUrl,
    sourceTitle: first.caption,
    media,
    expiresAt: buildManifestExpiryIso(),
  }
}

export const tiktokSocialImportAdapter: SocialImportAdapter = {
  platform: "tiktok",
  matches(url) {
    const host = url.hostname.replace(/^www\./i, "").toLowerCase()
    return host === "tiktok.com" || host === "vm.tiktok.com" || host === "vt.tiktok.com"
  },
  async inspect(url) {
    const canonicalUrl = url.href
    const { items } = await runTikTokScraperActor(buildTikTokUrlDownloadActorInput(canonicalUrl), 300)
    const normalized = normalizeTikTokDatasetItems(items)
    return mapTikTokToManifest(canonicalUrl, normalized)
  },
}