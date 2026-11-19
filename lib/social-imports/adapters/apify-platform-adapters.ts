import { runApifyActorSync } from "@/lib/server/apify/actor-run"
import {
  resolveSocialImportApifyActor,
  type ApifyBackedSocialPlatform,
} from "@/lib/server/apify/social-import-actor-config"
import type { SocialImportAdapter } from "../types"
import {
  buildManifestFromItems,
  firstRecordTitle,
  harvestHttpsUrlsFromRecords,
  urlsToMediaItems,
} from "./apify-media"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const v = record[key]
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string" && entry.startsWith("https://"))
}

async function inspectWithApify(
  platform: ApifyBackedSocialPlatform,
  canonicalUrl: string,
  buildInput: (url: string) => Record<string, unknown>,
  mapItems?: (items: unknown[]) => string[],
) {
  const actor = resolveSocialImportApifyActor(platform)
  const { items } = await runApifyActorSync(actor, buildInput(canonicalUrl))
  const okItems = items.filter((row) => {
    if (!isRecord(row)) return true
    if (row.ok === false) return false
    if (row.status === "failed") return false
    const err = readString(row, "error")
    if (err && !harvestHttpsUrlsFromRecords([row]).length) return false
    return true
  })
  if (okItems.length === 0) {
    throw new Error("No downloadable media was found for that link.")
  }
  const urls = mapItems ? mapItems(okItems) : harvestHttpsUrlsFromRecords(okItems)
  const media = urlsToMediaItems(urls)
  return buildManifestFromItems(platform, canonicalUrl, firstRecordTitle(okItems), media)
}

function threadsItemsToUrls(items: unknown[]): string[] {
  const urls: string[] = []
  for (const raw of items) {
    if (!isRecord(raw)) continue
    urls.push(...readStringList(raw.directUrls))
    urls.push(...readStringList(raw.downloadUrls))
    const thumb = readString(raw, "thumbnailUrl")
    if (thumb) urls.push(thumb)
  }
  const fallback = harvestHttpsUrlsFromRecords(items)
  return [...urls, ...fallback]
}

function youtubeItemsToUrls(items: unknown[]): string[] {
  const urls: string[] = []
  for (const raw of items) {
    if (!isRecord(raw)) continue
    const mediaUrl = readString(raw, "mediaUrl") ?? readString(raw, "downloadUrl") ?? readString(raw, "url")
    if (mediaUrl?.includes("api.apify.com") && mediaUrl.toLowerCase().includes(".mp4")) {
      urls.push(mediaUrl)
    }
    const thumb = readString(raw, "thumbnailUrl")
    if (thumb && urls.length === 0) urls.push(thumb)
  }
  return [...urls, ...harvestHttpsUrlsFromRecords(items)]
}

function redditItemsToUrls(items: unknown[]): string[] {
  const urls: string[] = []
  for (const raw of items) {
    if (!isRecord(raw)) continue
    urls.push(...readStringList(raw.videoUrls))
    urls.push(...readStringList(raw.imageUrls))
    if (raw.isVideo === true) {
      const preview = readString(raw, "url")
      if (preview) urls.push(preview)
    }
  }
  return [...urls, ...harvestHttpsUrlsFromRecords(items)]
}

function facebookItemsToUrls(items: unknown[]): string[] {
  const urls: string[] = []
  for (const raw of items) {
    if (!isRecord(raw)) continue
    const media = raw.media
    if (Array.isArray(media)) {
      for (const entry of media) {
        if (!isRecord(entry)) continue
        const photoUri = isRecord(entry.photo_image) ? readString(entry.photo_image, "uri") : null
        if (photoUri) urls.push(photoUri)
        const thumb = readString(entry, "thumbnail")
        if (thumb) urls.push(thumb)
        const playable =
          readString(entry, "browser_native_hd_url") ??
          readString(entry, "browser_native_sd_url") ??
          readString(entry, "playable_url")
        if (playable) urls.push(playable)
      }
    }
  }
  return [...urls, ...harvestHttpsUrlsFromRecords(items)]
}

function pinterestItemsToUrls(items: unknown[]): string[] {
  const urls: string[] = []
  for (const raw of items) {
    if (!isRecord(raw)) continue
    const image = readString(raw, "image_url")
    if (image) urls.push(image)
    const video =
      readString(raw, "video_url") ??
      readString(raw, "videoUrl") ??
      readString(raw, "video_link")
    if (video) urls.push(video)
  }
  return [...urls, ...harvestHttpsUrlsFromRecords(items)]
}

function redgifsItemsToUrls(items: unknown[]): string[] {
  const urls: string[] = []
  for (const raw of items) {
    if (!isRecord(raw)) continue
    const primary =
      readString(raw, "downloadUrl") ??
      readString(raw, "directMediaUrl") ??
      readString(raw, "directVideoUrl") ??
      readString(raw, "storedFileUrl")
    if (primary) urls.push(primary)
    if (Array.isArray(raw.availableFormats)) {
      for (const fmt of raw.availableFormats) {
        if (isRecord(fmt) && typeof fmt.url === "string") urls.push(fmt.url)
      }
    }
  }
  return [...urls, ...harvestHttpsUrlsFromRecords(items)]
}

function hostMatches(url: URL, patterns: RegExp[]) {
  const host = url.hostname.replace(/^www\./i, "").toLowerCase()
  return patterns.some((re) => re.test(host))
}

export const threadsSocialImportAdapter: SocialImportAdapter = {
  platform: "threads",
  matches(url) {
    if (!hostMatches(url, [/^threads\.net$/i, /^threads\.com$/i])) return false
    return /\/@[^/]+\/post\//i.test(url.pathname) || /^\/t\/[^/]+/i.test(url.pathname)
  },
  async inspect(url) {
    return inspectWithApify(
      "threads",
      url.href,
      (postUrl) => ({ postUrls: [postUrl], maxItems: 1 }),
      threadsItemsToUrls,
    )
  },
}

export const youtubeShortsSocialImportAdapter: SocialImportAdapter = {
  platform: "youtube_shorts",
  matches(url) {
    if (!hostMatches(url, [/^youtube\.com$/i, /^youtu\.be$/i, /^m\.youtube\.com$/i])) return false
    if (url.hostname.replace(/^www\./i, "") === "youtu.be") return true
    return (
      url.pathname.startsWith("/watch") ||
      url.pathname.startsWith("/shorts/") ||
      url.pathname.startsWith("/live/")
    )
  },
  async inspect(url) {
    return inspectWithApify(
      "youtube_shorts",
      url.href,
      (videoUrl) => ({
        urls: [videoUrl],
        videoQuality: "720",
        maxMegabytes: 250,
        includeMetadata: true,
      }),
      youtubeItemsToUrls,
    )
  },
}

export const xSocialImportAdapter: SocialImportAdapter = {
  platform: "x",
  matches(url) {
    if (!hostMatches(url, [/^x\.com$/i, /^twitter\.com$/i, /^mobile\.twitter\.com$/i])) return false
    return /\/status\/\d+/i.test(url.pathname)
  },
  async inspect(url) {
    return inspectWithApify("x", url.href, (tweetUrl) => ({
      startUrls: [tweetUrl],
      maxItems: 1,
    }))
  },
}

export const redditSocialImportAdapter: SocialImportAdapter = {
  platform: "reddit",
  matches(url) {
    if (!hostMatches(url, [/^reddit\.com$/i, /^old\.reddit\.com$/i])) return false
    return /\/r\/[^/]+\/comments\//i.test(url.pathname) || /\/comments\//i.test(url.pathname)
  },
  async inspect(url) {
    return inspectWithApify(
      "reddit",
      url.href,
      (postUrl) => ({
        startUrls: [{ url: postUrl }],
        maxItems: 1,
        maxPostCount: 1,
        includeMediaLinks: true,
      }),
      redditItemsToUrls,
    )
  },
}

export const facebookSocialImportAdapter: SocialImportAdapter = {
  platform: "facebook",
  matches(url) {
    if (!hostMatches(url, [/^facebook\.com$/i, /^m\.facebook\.com$/i, /^fb\.watch$/i])) return false
    if (url.hostname.replace(/^www\./i, "") === "fb.watch") return true
    return (
      /\/posts\//i.test(url.pathname) ||
      /\/reel\//i.test(url.pathname) ||
      /\/watch\/?/i.test(url.pathname) ||
      /story\.php/i.test(url.pathname) ||
      /\/videos\//i.test(url.pathname) ||
      /\/photo\/?/i.test(url.pathname)
    )
  },
  async inspect(url) {
    return inspectWithApify(
      "facebook",
      url.href,
      (postUrl) => ({
        startUrls: [{ url: postUrl }],
        resultsLimit: 1,
      }),
      facebookItemsToUrls,
    )
  },
}

export const pinterestSocialImportAdapter: SocialImportAdapter = {
  platform: "pinterest",
  matches(url) {
    const host = url.hostname.replace(/^www\./i, "").toLowerCase()
    if (host === "pin.it") return true
    if (host === "pinterest.com" || host.endsWith(".pinterest.com")) {
      return /\/pin\//i.test(url.pathname)
    }
    return false
  },
  async inspect(url) {
    return inspectWithApify(
      "pinterest",
      url.href,
      (pinUrl) => ({
        pinUrls: [pinUrl],
        includeDetails: true,
        maxResults: 1,
      }),
      pinterestItemsToUrls,
    )
  },
}

export const redgifsSocialImportAdapter: SocialImportAdapter = {
  platform: "redgifs",
  matches(url) {
    return hostMatches(url, [/^redgifs\.com$/i, /^i\.redgifs\.com$/i])
  },
  async inspect(url) {
    return inspectWithApify(
      "redgifs",
      url.href,
      (watchUrl) => ({
        targets: [watchUrl],
        preferredQuality: "hd",
        maxVideos: 1,
      }),
      redgifsItemsToUrls,
    )
  },
}