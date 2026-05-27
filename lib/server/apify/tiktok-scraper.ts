import type {
  NormalizedTikTokVideoCard,
  TikTokVideoSearchDateFilter,
  TikTokVideoSearchSorting,
} from "@/lib/server/apify/tiktok-scraper-types"

/** Official Actor id for `clockworks/tiktok-scraper` (`https://apify.com/clockworks/tiktok-scraper`). */
const ACTOR_ID = "GdWCkxBtKWOsKjdch" as const
const APIFY_BASE = "https://api.apify.com/v2"

function requireApifyToken() {
  const token = process.env.APIFY_API_TOKEN?.trim()
  if (!token) {
    throw new Error("TikTok search isn't available right now. Please try again later.")
  }
  return token
}

type ApifyRunResponse = {
  data?: {
    id?: string
    status?: string
    defaultDatasetId?: string
    statusMessage?: string
  }
  error?: { type?: string; message?: string }
}

async function parseJson(response: Response) {
  return (await response.json()) as unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const v = record[key]
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null
}

function readNumber(record: Record<string, unknown>, key: string): number | null {
  const v = record[key]
  if (typeof v === "number" && Number.isFinite(v)) return v
  return null
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
}

/** Apify Key–Value store record URL emitted when `shouldDownloadVideos` is true. */
function isApifyKeyValueMp4DownloadUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== "api.apify.com") return false
    const path = parsed.pathname
    return (
      path.includes("/v2/key-value-stores/") &&
      path.includes("/records/") &&
      path.toLowerCase().endsWith(".mp4")
    )
  } catch {
    return false
  }
}

function isApifyKeyValueImageDownloadUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== "api.apify.com") return false
    const path = parsed.pathname.toLowerCase()
    return (
      path.includes("/v2/key-value-stores/") &&
      path.includes("/records/") &&
      (path.endsWith(".jpg") || path.endsWith(".jpeg") || path.endsWith(".png") || path.endsWith(".webp"))
    )
  } catch {
    return false
  }
}

/** Prefer real MP4 / stream URLs — reject TikTok cover images and audio-only streams. */
function isLikelyTikTokMp4StreamUrl(url: string): boolean {
  const lower = url.toLowerCase()
  if (!/^https:\/\//i.test(lower)) return false
  if (isApifyKeyValueMp4DownloadUrl(url)) return true
  if (lower.includes("mime_type=audio_mpeg")) return false
  if (lower.includes("mime_type=audio")) return false
  if (
    lower.includes("mime_type=video_mp4") ||
    lower.includes("mime_type=video%2fmp4") ||
    lower.includes("mime_type=video/mp4")
  ) {
    return true
  }

  const imageHints = ["tplv-tiktokx-origin.image", "tplv-photomode", "-photomode-", ".jpeg?", ".jpg?"]
  for (const hint of imageHints) {
    if (lower.includes(hint)) return false
  }

  if (lower.includes("/video/tos") || lower.includes("/video/tos/")) return true

  try {
    const parsed = new URL(url)
    if (parsed.pathname.includes("/video/") && parsed.hostname.includes("tiktokcdn")) {
      return true
    }
  } catch {
    return false
  }

  return false
}

function isLikelyTikTokImageUrl(url: string): boolean {
  const lower = url.toLowerCase()
  if (!/^https:\/\//i.test(lower)) return false
  if (isLikelyTikTokMp4StreamUrl(url)) return false
  if (isApifyKeyValueImageDownloadUrl(url)) return true
  if (lower.includes("mime_type=image")) return true
  if (lower.includes("tiktokx-origin.image")) return true
  if (lower.includes("photomode")) return true
  if (/\.(jpg|jpeg|png|webp)(\?|$)/.test(lower)) return true
  return false
}

function dedupeUrls(urls: string[]) {
  return [...new Set(urls)]
}

function pickBestImageCandidate(candidates: string[]): string | null {
  const valid = dedupeUrls(candidates.filter((candidate) => isLikelyTikTokImageUrl(candidate)))
  if (valid.length === 0) return null
  const apifyRecord = valid.find((candidate) => isApifyKeyValueImageDownloadUrl(candidate))
  if (apifyRecord) return apifyRecord
  const photomode = valid.find((candidate) => candidate.toLowerCase().includes("photomode"))
  if (photomode) return photomode
  return valid[0] ?? null
}

function collectScopedImageUrls(
  value: unknown,
  path: string[] = [],
  depth = 0,
  out: string[] = [],
): string[] {
  if (depth > 10 || value === null || value === undefined) return out

  const currentPath = path.join(".").toLowerCase()
  const looksSlideContext =
    currentPath.includes("imagepost") ||
    currentPath.includes("slideshow") ||
    currentPath.includes("photomode") ||
    currentPath.includes("mediaurls") ||
    currentPath.includes(".images") ||
    currentPath.endsWith("images")

  const blockedContext =
    currentPath.includes("avatar") ||
    currentPath.includes("cover") ||
    currentPath.includes("music") ||
    currentPath.includes("author") ||
    currentPath.includes("sticker") ||
    currentPath.includes("thumbnail")

  if (typeof value === "string") {
    if (looksSlideContext && !blockedContext && isLikelyTikTokImageUrl(value)) {
      out.push(value)
    }
    return out
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      collectScopedImageUrls(value[index], [...path, String(index)], depth + 1, out)
    }
    return out
  }

  if (isRecord(value)) {
    for (const [key, entry] of Object.entries(value)) {
      collectScopedImageUrls(entry, [...path, key], depth + 1, out)
    }
  }

  return out
}

function extractSlideshowUrls(raw: Record<string, unknown>): string[] {
  const collectedOrdered: string[] = []
  const slideshowImageLinks = raw.slideshowImageLinks

  if (Array.isArray(slideshowImageLinks)) {
    for (const slideEntry of slideshowImageLinks) {
      if (!isRecord(slideEntry)) continue
      const best = pickBestImageCandidate(
        [
          readString(slideEntry, "downloadLink"),
          readString(slideEntry, "tiktokLink"),
          readString(slideEntry, "url"),
          readString(slideEntry, "downloadUrl"),
        ].filter((value): value is string => value !== null),
      )
      if (best) {
        collectedOrdered.push(best)
      }
    }
  }

  if (collectedOrdered.length > 0) {
    return dedupeUrls(collectedOrdered)
  }

  const mediaUrls = raw.mediaUrls
  if (Array.isArray(mediaUrls)) {
    for (const entry of mediaUrls) {
      if (typeof entry === "string") {
        if (isLikelyTikTokImageUrl(entry)) collectedOrdered.push(entry)
        continue
      }
      if (!isRecord(entry)) continue
      const candidate = pickBestImageCandidate(
        [
          readString(entry, "url"),
          readString(entry, "downloadLink"),
          readString(entry, "downloadUrl"),
        ].filter((value): value is string => value !== null),
      )
      if (candidate) {
        collectedOrdered.push(candidate)
      }
    }
  }

  const imagePost = isRecord(raw.imagePost) ? raw.imagePost : null
  const imagePostImages = imagePost?.images
  if (Array.isArray(imagePostImages)) {
    for (const imageEntry of imagePostImages) {
      if (!isRecord(imageEntry)) continue
      const imageUrlRecord =
        (isRecord(imageEntry.imageURL) ? imageEntry.imageURL : null) ??
        (isRecord(imageEntry.imageUrl) ? imageEntry.imageUrl : null)

      const candidates: string[] = []
      if (imageUrlRecord) {
        const direct =
          readString(imageUrlRecord, "url") ??
          readString(imageUrlRecord, "uri") ??
          readString(imageUrlRecord, "downloadUrl")
        if (direct) {
          candidates.push(direct)
        }
        candidates.push(...readStringList(imageUrlRecord.urlList ?? imageUrlRecord.URLList))
      }

      const directImage =
        readString(imageEntry, "imageUrl") ??
        readString(imageEntry, "url") ??
        readString(imageEntry, "downloadUrl")
      if (directImage) {
        candidates.push(directImage)
      }

      const best = pickBestImageCandidate(candidates)
      if (best) {
        collectedOrdered.push(best)
      }
    }
  }

  const topImages = raw.images
  if (Array.isArray(topImages)) {
    for (const imageEntry of topImages) {
      if (typeof imageEntry === "string") {
        if (isLikelyTikTokImageUrl(imageEntry)) collectedOrdered.push(imageEntry)
        continue
      }
      if (!isRecord(imageEntry)) continue
      const best = pickBestImageCandidate([
        readString(imageEntry, "url"),
        readString(imageEntry, "downloadUrl"),
        ...readStringList(imageEntry.urlList ?? imageEntry.URLList),
      ].filter((value): value is string => value !== null))
      if (best) {
        collectedOrdered.push(best)
      }
    }
  }

  if (collectedOrdered.length === 0) {
    // Defensive fallback limited to slideshow-like paths only.
    collectScopedImageUrls(raw, [], 0, collectedOrdered)
  }

  return dedupeUrls(collectedOrdered)
}

function firstPlayableSubtitleUrl(videoMeta: Record<string, unknown>): string | null {
  const subtitleLinks = videoMeta.subtitleLinks
  if (!Array.isArray(subtitleLinks)) return null

  for (const rawEntry of subtitleLinks) {
    if (!isRecord(rawEntry)) continue
    // Apify often sets downloadLink to a .vtt subtitle file and tiktokLink to the MP4 stream.
    // Do not coalesce with ?? or the VTT wins and we never read tiktokLink.
    const downloadLink = readString(rawEntry, "downloadLink")
    if (downloadLink && isLikelyTikTokMp4StreamUrl(downloadLink)) {
      return downloadLink
    }
    const tiktokLink = readString(rawEntry, "tiktokLink")
    if (tiktokLink && isLikelyTikTokMp4StreamUrl(tiktokLink)) {
      return tiktokLink
    }
  }

  return null
}

function firstPlayableFromVideoMeta(videoMeta: Record<string, unknown>): string | null {
  const downloadAddr =
    readString(videoMeta, "downloadAddr") ?? readString(videoMeta, "download_url") ?? null
  if (downloadAddr) {
    if (isApifyKeyValueMp4DownloadUrl(downloadAddr)) return downloadAddr
    if (isLikelyTikTokMp4StreamUrl(downloadAddr)) return downloadAddr
  }

  const fromSubs = firstPlayableSubtitleUrl(videoMeta)
  if (fromSubs) return fromSubs

  const direct =
    readString(videoMeta, "downloadLink") ?? readString(videoMeta, "downloadUrl") ?? null
  if (direct && isLikelyTikTokMp4StreamUrl(direct)) return direct

  return null
}

function firstPlayableFromMediaUrls(raw: Record<string, unknown>): string | null {
  const mediaUrls = raw.mediaUrls
  if (!Array.isArray(mediaUrls)) return null

  for (const entry of mediaUrls) {
    if (typeof entry === "string") {
      if (isApifyKeyValueMp4DownloadUrl(entry)) return entry
      if (isLikelyTikTokMp4StreamUrl(entry)) return entry
      continue
    }
    if (isRecord(entry)) {
      const candidate =
        readString(entry, "url") ??
        readString(entry, "downloadLink") ??
        readString(entry, "downloadUrl") ??
        null
      if (candidate && isLikelyTikTokMp4StreamUrl(candidate)) return candidate
    }
  }

  return null
}

/** TikTok payloads sometimes expose `bitrateInfo[].PlayAddr.UrlList`. */
function firstPlayableUrlFromBitrateInfoLike(value: unknown): string | null {
  if (!Array.isArray(value)) return null

  for (const entry of value) {
    if (!isRecord(entry)) continue
    const playAddr =
      (isRecord(entry.playAddr) ? entry.playAddr : null) ??
      (isRecord(entry.PlayAddr) ? entry.PlayAddr : null)
    const urlListField =
      playAddr !== null ? (playAddr.UrlList ?? playAddr.urlList) : null

    const candidates: unknown[] =
      typeof urlListField === "string"
        ? [urlListField]
        : Array.isArray(urlListField)
          ? [...urlListField]
          : []

    for (const u of candidates) {
      if (typeof u !== "string") continue
      if (isLikelyTikTokMp4StreamUrl(u)) return u
    }

    const directUrl =
      playAddr !== null
        ? readString(playAddr, "Url")
        : typeof entry.Url === "string"
          ? entry.Url
          : typeof entry.UrlList === "string"
            ? entry.UrlList
            : null

    if (directUrl && isLikelyTikTokMp4StreamUrl(directUrl)) return directUrl
  }

  return null
}

export function normalizeTikTokVideoRecord(raw: unknown): NormalizedTikTokVideoCard | null {
  if (!isRecord(raw)) return null

  const id = readString(raw, "id")
  const webVideoUrl = readString(raw, "webVideoUrl")

  const authorMeta = isRecord(raw.authorMeta) ? raw.authorMeta : null
  const authorUsername =
    (authorMeta && readString(authorMeta, "name")) ??
    readString(raw, "authorMeta.name") ??
    null
  const authorDisplayName =
    (authorMeta && readString(authorMeta, "nickName")) ??
    readString(raw, "authorMeta.nickName") ??
    authorUsername
  const authorProfileUrl =
    (authorMeta && readString(authorMeta, "profileUrl")) ??
    readString(raw, "authorMeta.profileUrl") ??
    (authorUsername ? `https://www.tiktok.com/@${authorUsername}` : null)

  const videoMetaNested = isRecord(raw.videoMeta) ? raw.videoMeta : null

  /** Apify CSV / console export often flattens to `videoMeta.downloadAddr`-style keys. */
  let videoMeta: Record<string, unknown> | null = videoMetaNested
  const flatDd = readString(raw, "videoMeta.downloadAddr")
  const flatCover = readString(raw, "videoMeta.coverUrl") ?? readString(raw, "videoMeta.originalCoverUrl")

  if (!videoMetaNested && flatDd) {
    videoMeta = { downloadAddr: flatDd }
  } else if (videoMetaNested && flatDd && !readString(videoMetaNested, "downloadAddr")) {
    videoMeta = { ...videoMetaNested, downloadAddr: flatDd }
  } else if (videoMetaNested) {
    videoMeta = videoMetaNested
  } else if (flatCover) {
    videoMeta = { coverUrl: flatCover }
  }

  let playableVideoUrl = videoMeta ? firstPlayableFromVideoMeta(videoMeta) : null

  if (!playableVideoUrl && flatDd) {
    if (isApifyKeyValueMp4DownloadUrl(flatDd) || isLikelyTikTokMp4StreamUrl(flatDd)) {
      playableVideoUrl = flatDd
    }
  }

  if (!playableVideoUrl) {
    playableVideoUrl = firstPlayableFromMediaUrls(raw)
  }

  const bitrateBundles = videoMeta?.bitrateInfo ?? raw.bitrateInfo
  if (!playableVideoUrl) {
    playableVideoUrl = firstPlayableUrlFromBitrateInfoLike(bitrateBundles)
  }
  const playUrlTop = readString(raw, "playUrl")
  if (!playableVideoUrl && playUrlTop && isLikelyTikTokMp4StreamUrl(playUrlTop)) {
    playableVideoUrl = playUrlTop
  }

  const coverUrl =
    (videoMeta &&
      (readString(videoMeta, "coverUrl") ?? readString(videoMeta, "originalCoverUrl"))) ??
    flatCover ??
    null
  const slideshowImageUrls = extractSlideshowUrls(raw)

  const caption = readString(raw, "text")
  const createTimeISO =
    readString(raw, "createTimeISO") ??
    (typeof raw.createTime === "number"
      ? new Date(raw.createTime * 1000).toISOString()
      : null)

  const views = readNumber(raw, "playCount")
  const likes = readNumber(raw, "diggCount")
  const comments = readNumber(raw, "commentCount")
  const shares = readNumber(raw, "shareCount")
  const saves = readNumber(raw, "collectCount")

  if (!id && !webVideoUrl && !playableVideoUrl) {
    return null
  }

  return {
    id,
    webVideoUrl,
    playableVideoUrl,
    slideshowImageUrls,
    caption,
    createTimeISO,
    authorUsername,
    authorDisplayName,
    authorProfileUrl,
    coverUrl,
    stats: {
      views,
      likes,
      comments,
      shares,
      saves,
    },
  }
}

function mapDatasetItemsToVideos(items: unknown[]): NormalizedTikTokVideoCard[] {
  const out: NormalizedTikTokVideoCard[] = []
  for (const item of items) {
    const normalized = normalizeTikTokVideoRecord(item)
    if (normalized) {
      out.push(normalized)
    }
  }
  return out
}

export function pickFirstPlayableDownloadUrl(normalized: NormalizedTikTokVideoCard): string | null {
  const url = normalized.playableVideoUrl
  if (!url) return null
  return isLikelyTikTokMp4StreamUrl(url) ? url : null
}

async function fetchDatasetItems(datasetId: string, token: string): Promise<unknown[]> {
  const url = new URL(`${APIFY_BASE}/datasets/${datasetId}/items`)
  url.searchParams.set("format", "json")

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })

  const payload = await parseJson(response)

  if (!response.ok) {
    throw new Error("Couldn't load TikTok results. Please try your search again.")
  }

  if (Array.isArray(payload)) {
    return payload
  }

  if (isRecord(payload) && Array.isArray(payload.items)) {
    return payload.items
  }

  if (
    isRecord(payload) &&
    isRecord(payload.data) &&
    Array.isArray(payload.data.items)
  ) {
    return payload.data.items as unknown[]
  }

  return []
}

/**
 * Starts actor run and blocks up to waitSeconds for finish, then reads dataset items.
 */
export async function runTikTokScraperActor(input: Record<string, unknown>, waitSeconds = 300) {
  const token = requireApifyToken()

  const url = new URL(`${APIFY_BASE}/acts/${ACTOR_ID}/runs`)
  url.searchParams.set("waitForFinish", String(waitSeconds))

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    cache: "no-store",
  })

  const body = (await parseJson(response)) as ApifyRunResponse

  if (!response.ok) {
    throw new Error("Couldn't fetch TikTok content. Please try again.")
  }

  const data = body.data
  if (!data) {
    throw new Error("Couldn't fetch TikTok content. Please try again.")
  }
  const status = data?.status
  const runId = data?.id ?? null

  if (status !== "SUCCEEDED") {
    throw new Error("TikTok fetch didn't complete. Please try again.")
  }

  const datasetId = data?.defaultDatasetId
  if (!datasetId) {
    throw new Error("TikTok fetch didn't return results. Please try again.")
  }

  const items = await fetchDatasetItems(datasetId, token)

  return { runId, datasetId, items }
}

export function buildTikTokUrlDownloadActorInput(videoUrl: string) {
  return {
    postURLs: [videoUrl.trim()],
    resultsPerPage: 1,
    scrapeRelatedVideos: false,
    shouldDownloadVideos: true,
    shouldDownloadCovers: false,
    shouldDownloadSlideshowImages: true,
    shouldDownloadAvatars: false,
    shouldDownloadMusicCovers: false,
    /** Per Apify input schema (`downloadSubtitlesOptions`). `NEVER_*` suppresses TikTok-provided subtitle metadata; TikTok exposes MP4 stream URLs alongside those entries. See https://apify.com/clockworks/tiktok-scraper */
    downloadSubtitlesOptions: "DOWNLOAD_SUBTITLES",
    commentsPerPost: 0,
    topLevelCommentsPerPost: 0,
    maxRepliesPerComment: 0,
    maxFollowersPerProfile: 0,
    maxFollowingPerProfile: 0,
    proxyCountryCode: "None",
  } satisfies Record<string, unknown>
}

export function buildTikTokVideoSearchActorInput(options: {
  query: string
  resultsPerPage: number
  videoSearchSorting: TikTokVideoSearchSorting
  videoSearchDateFilter: TikTokVideoSearchDateFilter
}) {
  const q = options.query.trim()
  return {
    searchQueries: [q],
    searchSection: "/video",
    resultsPerPage: options.resultsPerPage,
    profileScrapeSections: ["videos"],
    profileSorting: "latest",
    excludePinnedPosts: false,
    maxProfilesPerQuery: 10,
    videoSearchSorting: options.videoSearchSorting,
    videoSearchDateFilter: options.videoSearchDateFilter,
    scrapeRelatedVideos: false,
  /** Host MP4s on Apify KV so browsers can play via our stream proxy (TikTok CDN blocks hotlinking). */
    shouldDownloadVideos: true,
    shouldDownloadCovers: false,
    shouldDownloadSlideshowImages: true,
    shouldDownloadAvatars: false,
    shouldDownloadMusicCovers: false,
    /** Match downloader: keep TikTok subtitle / stream attachment metadata when available. */
    downloadSubtitlesOptions: "DOWNLOAD_SUBTITLES",
    commentsPerPost: 0,
    topLevelCommentsPerPost: 0,
    maxRepliesPerComment: 0,
    maxFollowersPerProfile: 0,
    maxFollowingPerProfile: 0,
    proxyCountryCode: "None",
  } satisfies Record<string, unknown>
}

export function normalizeTikTokDatasetItems(items: unknown[]) {
  return mapDatasetItemsToVideos(items)
}

function isStoredNormalizedVideoCard(value: Record<string, unknown>): value is NormalizedTikTokVideoCard {
  return isRecord(value.stats)
}

/** Hydrates DB/API payloads: accepts raw Apify rows or already-normalized cards. */
export function parseStoredTikTokVideoResults(value: unknown): NormalizedTikTokVideoCard[] {
  if (!Array.isArray(value)) return []

  const out: NormalizedTikTokVideoCard[] = []
  for (const entry of value) {
    if (!isRecord(entry)) continue
    if (isStoredNormalizedVideoCard(entry)) {
      out.push(entry)
      continue
    }
    const normalized = normalizeTikTokVideoRecord(entry)
    if (normalized) {
      out.push(normalized)
    }
  }
  return out
}

const TIKTOK_HOST_RE =
  /^https:\/\/(www\.|vm\.|vt\.)?tiktok\.com\/.+/i

export function assertLooksLikeTikTokVideoUrl(url: string) {
  const trimmed = url.trim()
  if (!trimmed) {
    throw new Error("Paste a TikTok video URL.")
  }
  try {
    const parsed = new URL(trimmed)
    if (!TIKTOK_HOST_RE.test(parsed.toString())) {
      throw new Error("Only TikTok video URLs are supported.")
    }
  } catch {
    throw new Error("That URL doesn't look valid.")
  }
}
