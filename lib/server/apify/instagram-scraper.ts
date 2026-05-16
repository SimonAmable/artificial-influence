import type { NormalizedInstagramPost } from "@/lib/server/apify/instagram-scraper-types"
import { assertLooksLikeTikTokVideoUrl } from "@/lib/server/apify/tiktok-scraper"

/** Actor REST id for `apify/instagram-scraper` (`https://apify.com/apify/instagram-scraper`). */
const INSTAGRAM_ACTOR_ID = "apify~instagram-scraper" as const
const APIFY_BASE = "https://api.apify.com/v2"

const TIKTOK_HOST_RE =
  /^https:\/\/(www\.|vm\.|vt\.)?tiktok\.com\/.+/i

/** Post or reel URLs only (profiles / hashtags use different flows). */
const INSTAGRAM_POST_PATH_RE =
  /\/(p|reel|reels|tv)\/[^/?#]+\/?/i

export type SocialDownloadPlatform = "tiktok" | "instagram"

function requireApifyToken() {
  const token = process.env.APIFY_API_TOKEN?.trim()
  if (!token) {
    throw new Error("Apify is not configured. Set APIFY_API_TOKEN.")
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

async function fetchDatasetItems(datasetId: string, token: string): Promise<unknown[]> {
  const url = new URL(`${APIFY_BASE}/datasets/${datasetId}/items`)
  url.searchParams.set("format", "json")

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })

  const payload = await parseJson(response)

  if (!response.ok) {
    let msg: string | null = null
    if (isRecord(payload) && isRecord(payload.error)) {
      msg = readString(payload.error as Record<string, unknown>, "message")
    }
    throw new Error(msg || `Could not load Apify dataset (${response.status}).`)
  }

  if (Array.isArray(payload)) {
    return payload
  }

  if (isRecord(payload) && Array.isArray(payload.items)) {
    return payload.items
  }

  if (isRecord(payload) && isRecord(payload.data) && Array.isArray(payload.data.items)) {
    return payload.data.items as unknown[]
  }

  return []
}

export function assertLooksLikeInstagramPostUrl(url: string) {
  const trimmed = url.trim()
  if (!trimmed) {
    throw new Error("Paste an Instagram post or reel URL.")
  }
  try {
    const parsed = new URL(trimmed)
    const host = parsed.hostname.replace(/^www\./i, "")
    const isInstagram = host === "instagram.com" || host === "m.instagram.com"
    if (!isInstagram || !INSTAGRAM_POST_PATH_RE.test(parsed.pathname)) {
      throw new Error("Paste an Instagram post or reel URL (instagram.com/p/… or instagram.com/reel/…).")
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Paste an Instagram")) throw error
    throw new Error("That URL doesn't look like a valid Instagram post or reel.")
  }
}

/**
 * TikTok-first, then Instagram post/reel. Throws with a concise user-facing message when invalid.
 */
export function detectSocialPlatform(url: string): SocialDownloadPlatform {
  const trimmed = url.trim()
  if (!trimmed) {
    throw new Error("Paste a TikTok video URL or an Instagram post/reel link.")
  }
  try {
    const parsed = new URL(trimmed)
    const href = parsed.href
    if (TIKTOK_HOST_RE.test(href)) {
      assertLooksLikeTikTokVideoUrl(trimmed)
      return "tiktok"
    }

    assertLooksLikeInstagramPostUrl(trimmed)
    return "instagram"
  } catch (error) {
    if (error instanceof Error && error.message.length > 0) {
      throw error
    }
    throw new Error("Paste a valid TikTok video URL or Instagram post/reel link.")
  }
}

export function buildInstagramPostActorInput(postUrl: string) {
  return {
    resultsType: "posts",
    directUrls: [postUrl.trim()],
    resultsLimit: 1,
    addParentData: false,
  } satisfies Record<string, unknown>
}

function collectCarouselImageUrls(record: Record<string, unknown>): string[] {
  const urls: string[] = []
  const resources = record.displayResourceUrls
  if (Array.isArray(resources)) {
    for (const entry of resources) {
      if (typeof entry === "string") urls.push(entry)
    }
  }

  const childPosts = record.childPosts
  if (Array.isArray(childPosts)) {
    for (const raw of childPosts) {
      if (!isRecord(raw)) continue
      const display = readString(raw, "displayUrl")
      if (display) urls.push(display)
    }
  }

  const images = record.images
  if (Array.isArray(images)) {
    for (const raw of images) {
      if (typeof raw === "string") {
        urls.push(raw)
      } else if (isRecord(raw)) {
        const u = readString(raw, "url") ?? readString(raw, "displayUrl")
        if (u) urls.push(u)
      }
    }
  }

  return dedupePreserveOrder(urls)
}

/** Best-effort map of one dataset row to our normalized Instagram post shape. */
export function normalizeInstagramDatasetItem(raw: unknown): NormalizedInstagramPost | null {
  if (!isRecord(raw)) return null

  const rawType = readString(raw, "type")
  const caption = readString(raw, "caption")
  const displayUrl = readString(raw, "displayUrl")
  const videoUrl = readString(raw, "videoUrl")
  const shortCode = readString(raw, "shortCode") ?? readString(raw, "code")
  const url = readString(raw, "url") ?? readString(raw, "inputUrl")
  const timestamp = readString(raw, "timestamp")
  const likesCount = readNumber(raw, "likesCount") ?? readNumber(raw, "likeCount")

  const ownerUsername = readString(raw, "ownerUsername")
  const ownerFullName =
    readString(raw, "ownerFullName") ??
    readString(raw, "ownerFullname") ??
    readString(raw, "fullname")

  const carouselUrls = collectCarouselImageUrls(raw)
  let mediaUrls: string[] = []
  let resolvedType = rawType

  switch (resolvedType?.toLowerCase()) {
    case "video": {
      resolvedType = "Video"
      /** Image-only carousel frames; downloadable video stays in `videoUrl`. */
      mediaUrls = carouselUrls.length > 0 ? carouselUrls : []
      break
    }
    case "sidecar": {
      mediaUrls = carouselUrls.length > 0 ? carouselUrls : displayUrl ? [displayUrl] : []
      resolvedType = "Sidecar"
      break
    }
    case "image":
      mediaUrls = displayUrl ? [displayUrl] : carouselUrls
      resolvedType = "Image"
      break
    default: {
      if (videoUrl) {
        resolvedType = "Video"
        mediaUrls =
          carouselUrls.length > 0
            ? carouselUrls
            : displayUrl
              ? [displayUrl]
              : []
      } else if (carouselUrls.length > 0) {
        resolvedType = resolvedType ?? "Sidecar"
        mediaUrls = carouselUrls
      } else if (displayUrl) {
        resolvedType = resolvedType ?? "Image"
        mediaUrls = [displayUrl]
      } else {
        return null
      }
    }
  }

  mediaUrls = dedupePreserveOrder(mediaUrls)

  const hasIdentity =
    shortCode ?? url ?? displayUrl ?? videoUrl ?? (mediaUrls.length > 0 ? mediaUrls[0] : null)
  if (!hasIdentity) return null

  return {
    shortCode,
    url,
    type: resolvedType,
    caption,
    displayUrl,
    videoUrl: videoUrl ?? null,
    mediaUrls,
    likesCount,
    timestamp,
    ownerUsername,
    ownerFullName,
  }
}

/**
 * Starts the Instagram scraper run and waits up to waitSeconds before reading dataset items.
 */
export async function runInstagramScraperActor(input: Record<string, unknown>, waitSeconds = 300) {
  const token = requireApifyToken()

  const url = new URL(`${APIFY_BASE}/acts/${INSTAGRAM_ACTOR_ID}/runs`)
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
    throw new Error(
      body.error?.message || `Apify Instagram scrape failed (${response.status}).`,
    )
  }

  const data = body.data
  if (!data) {
    throw new Error(body.error?.message || "Apify returned an unexpected run payload.")
  }
  const status = data.status
  const runId = data.id ?? null

  if (status !== "SUCCEEDED") {
    throw new Error(
      data.statusMessage
        ? `Apify run did not succeed: ${status} — ${data.statusMessage}`
        : `Apify run did not succeed (status: ${status || "unknown"}).`,
    )
  }

  const datasetId = data.defaultDatasetId
  if (!datasetId) {
    throw new Error("Apify run finished but no dataset id was returned.")
  }

  const items = await fetchDatasetItems(datasetId, token)

  return { runId, datasetId, items }
}
