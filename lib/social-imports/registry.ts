import { directSocialImportAdapter } from "./adapters/direct"
import {
  facebookSocialImportAdapter,
  pinterestSocialImportAdapter,
  redditSocialImportAdapter,
  redgifsSocialImportAdapter,
  threadsSocialImportAdapter,
  xSocialImportAdapter,
  youtubeShortsSocialImportAdapter,
} from "./adapters/apify-platform-adapters"
import { instagramSocialImportAdapter } from "./adapters/instagram"
import { tiktokSocialImportAdapter } from "./adapters/tiktok"
import { assertHttpsPublicUrl } from "./security"
import type { SocialImportAdapter, SocialPlatform } from "./types"

const ADAPTERS: SocialImportAdapter[] = [
  tiktokSocialImportAdapter,
  instagramSocialImportAdapter,
  threadsSocialImportAdapter,
  youtubeShortsSocialImportAdapter,
  xSocialImportAdapter,
  redditSocialImportAdapter,
  facebookSocialImportAdapter,
  pinterestSocialImportAdapter,
  redgifsSocialImportAdapter,
  directSocialImportAdapter,
]

export function resolveSocialImportAdapter(rawUrl: string): {
  adapter: SocialImportAdapter
  url: URL
} {
  const url = assertHttpsPublicUrl(rawUrl)
  const matches = ADAPTERS.filter((adapter) => adapter.matches(url))
  if (matches.length === 0) {
    throw new Error(
      "That URL isn't from a supported platform. Paste a public post link or a direct media file URL.",
    )
  }
  const directFile = /\.(gif|mp4|webm|mov|jpe?g|png|webp)$/i.test(url.pathname)
  if (directFile) {
    const direct = matches.find((adapter) => adapter.platform === "direct")
    if (direct) return { adapter: direct, url }
  }
  if (matches.length > 1) {
    const nonDirect = matches.find((m) => m.platform !== "direct")
    if (nonDirect) {
      return { adapter: nonDirect, url }
    }
  }
  return { adapter: matches[0], url }
}

export function detectSocialPlatformFromUrl(rawUrl: string): SocialPlatform {
  return resolveSocialImportAdapter(rawUrl).adapter.platform
}

/** TikTok + Instagram compatibility for legacy callers. */
export function detectLegacyDownloadPlatform(url: string): "tiktok" | "instagram" {
  const platform = detectSocialPlatformFromUrl(url)
  if (platform === "instagram") return "instagram"
  if (platform === "tiktok") return "tiktok"
  throw new Error("Paste a TikTok video URL or an Instagram post/reel link.")
}

export async function inspectSocialUrl(rawUrl: string) {
  const { adapter, url } = resolveSocialImportAdapter(rawUrl)
  const manifest = await adapter.inspect(url)
  return manifest
}