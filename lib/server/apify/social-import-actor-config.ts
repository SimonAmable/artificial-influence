import type { SocialPlatform } from "@/lib/social-imports/types"

/** Apify Store actors used for Viral Cloner / social import inspect (override via env JSON). */
export const DEFAULT_SOCIAL_IMPORT_APIFY_ACTORS = {
  threads: "hipersoft/threads-downloader",
  youtube_shorts: "dami_studio/youtube-video-downloader",
  x: "apidojo/twitter-scraper-lite",
  reddit: "trudax/reddit-scraper-lite",
  facebook: "apify/facebook-posts-scraper",
  pinterest: "thirdwatch/pinterest-scraper",
  redgifs: "parsebird/redgifs-video-downloader",
} as const satisfies Record<
  Exclude<SocialPlatform, "tiktok" | "instagram" | "direct">,
  string
>

export type ApifyBackedSocialPlatform = keyof typeof DEFAULT_SOCIAL_IMPORT_APIFY_ACTORS

let cachedOverride: Partial<Record<ApifyBackedSocialPlatform, string>> | null | undefined

function parseOverrideMap(): Partial<Record<ApifyBackedSocialPlatform, string>> {
  if (cachedOverride !== undefined) {
    return cachedOverride ?? {}
  }
  const raw = process.env.SOCIAL_IMPORT_APIFY_ACTORS?.trim()
  if (!raw) {
    cachedOverride = null
    return {}
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      cachedOverride = null
      return {}
    }
    const out: Partial<Record<ApifyBackedSocialPlatform, string>> = {}
    for (const key of Object.keys(DEFAULT_SOCIAL_IMPORT_APIFY_ACTORS) as ApifyBackedSocialPlatform[]) {
      const value = (parsed as Record<string, unknown>)[key]
      if (typeof value === "string" && value.trim().length > 0) {
        out[key] = value.trim()
      }
    }
    cachedOverride = out
    return out
  } catch {
    cachedOverride = null
    return {}
  }
}

export function resolveSocialImportApifyActor(platform: ApifyBackedSocialPlatform): string {
  const overrides = parseOverrideMap()
  return overrides[platform] ?? DEFAULT_SOCIAL_IMPORT_APIFY_ACTORS[platform]
}