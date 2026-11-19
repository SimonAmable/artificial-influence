import type { SocialMediaItem, SocialMediaKind } from "../types"
import { buildManifestExpiryIso } from "../types"
import type { SocialImportManifest, SocialPlatform } from "../types"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const v = record[key]
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null
}

function dedupePreserveOrder(urls: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const url of urls) {
    if (!seen.has(url)) {
      seen.add(url)
      out.push(url)
    }
  }
  return out
}

function classifyMediaUrl(url: string): SocialMediaKind | null {
  const lower = url.toLowerCase()
  if (!/^https:\/\//i.test(url)) return null
  if (lower.includes(".gif") || lower.includes("image/gif")) return "animated"
  if (
    lower.includes(".mp4") ||
    lower.includes(".webm") ||
    lower.includes(".mov") ||
    lower.includes("mime_type=video") ||
    lower.includes("video.twimg.com") ||
    lower.includes("v.redd.it") ||
    lower.includes("/records/") && lower.endsWith(".mp4")
  ) {
    return "video"
  }
  if (lower.includes("media.redgifs.com") && lower.includes(".mp4")) {
    return "video"
  }
  if (
    lower.includes(".jpg") ||
    lower.includes(".jpeg") ||
    lower.includes(".png") ||
    lower.includes(".webp") ||
    lower.includes("pbs.twimg.com/media/") ||
    lower.includes("pinimg.com") ||
    lower.includes("fbcdn.net") ||
    lower.includes("redd.it") ||
    (lower.includes("media.redgifs.com") && lower.includes("-mobile"))
  ) {
    return "image"
  }
  return null
}

const MEDIA_URL_KEY_HINTS = [
  "remoteurl",
  "downloadurl",
  "directurl",
  "directurls",
  "downloadurls",
  "videourl",
  "videourls",
  "imageurl",
  "imageurls",
  "image_url",
  "video_url",
  "mediaurl",
  "directmediaurl",
  "storedfileurl",
  "previewurl",
  "thumbnailurl",
  "posterurl",
  "displayurl",
  "playableurl",
  "uri",
] as const

function collectUrlsFromValue(value: unknown, out: string[], depth: number) {
  if (depth > 8) return
  if (typeof value === "string") {
    if (value.startsWith("https://")) out.push(value.trim())
    return
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectUrlsFromValue(entry, out, depth + 1)
    }
    return
  }
  if (!isRecord(value)) return

  for (const [key, nested] of Object.entries(value)) {
    const keyLower = key.toLowerCase()
    if (MEDIA_URL_KEY_HINTS.some((hint) => keyLower.includes(hint))) {
      collectUrlsFromValue(nested, out, depth + 1)
    }
    if (keyLower === "media" || keyLower === "images" || keyLower === "variants") {
      collectUrlsFromValue(nested, out, depth + 1)
    }
  }
}

export function harvestHttpsUrlsFromRecords(records: unknown[]): string[] {
  const urls: string[] = []
  for (const raw of records) {
    if (!isRecord(raw)) continue
    collectUrlsFromValue(raw, urls, 0)
  }
  return dedupePreserveOrder(urls)
}

function upgradeTwitterImageUrl(url: string) {
  if (!url.includes("pbs.twimg.com/media/")) return url
  const parsed = new URL(url)
  parsed.searchParams.set("format", "jpg")
  parsed.searchParams.set("name", "orig")
  return parsed.href
}

export function urlsToMediaItems(urls: string[]): SocialMediaItem[] {
  const media: SocialMediaItem[] = []
  const videos: string[] = []
  const images: string[] = []
  const animated: string[] = []

  for (const raw of urls) {
    const url = upgradeTwitterImageUrl(raw)
    const kind = classifyMediaUrl(url)
    if (!kind) continue
    if (kind === "video") videos.push(url)
    else if (kind === "animated") animated.push(url)
    else images.push(url)
  }

  let index = 0
  const push = (kind: SocialMediaKind, remoteUrl: string, previewUrl: string | null) => {
    media.push({
      index,
      kind,
      remoteUrl,
      previewUrl,
      width: null,
      height: null,
      durationSeconds: null,
    })
    index += 1
  }

  for (const url of videos) push("video", url, null)
  for (const url of animated) push("animated", url, null)
  for (const url of images) push("image", url, url)

  return media
}

export function buildManifestFromItems(
  platform: SocialPlatform,
  canonicalUrl: string,
  sourceTitle: string | null,
  media: SocialMediaItem[],
): SocialImportManifest {
  if (media.length === 0) {
    throw new Error("No downloadable media was found for that link.")
  }
  return {
    platform,
    canonicalUrl,
    sourceTitle,
    media,
    expiresAt: buildManifestExpiryIso(),
  }
}

export function firstRecordTitle(items: unknown[]): string | null {
  const first = items[0]
  if (!isRecord(first)) return null
  return (
    readString(first, "text") ??
    readString(first, "caption") ??
    readString(first, "title") ??
    readString(first, "description") ??
    readString(first, "body") ??
    null
  )
}