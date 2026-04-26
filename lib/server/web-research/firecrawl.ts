import type {
  WebImageSearchResult,
  WebPageImage,
  WebPageLink,
  WebPageReadResult,
  WebScreenshotResult,
  WebSearchResult,
} from "@/lib/server/web-research/types"
import { assertSafeHttpUrl } from "@/lib/server/web-research/url-safety"

const DEFAULT_FIRECRAWL_BASE_URLS = ["https://api.firecrawl.dev/v2", "https://api.firecrawl.dev/v1"] as const

type FirecrawlSearchItem = {
  description?: unknown
  imageHeight?: unknown
  image?: unknown
  imageUrl?: unknown
  imageWidth?: unknown
  images?: unknown
  link?: unknown
  markdown?: unknown
  metadata?: unknown
  source?: unknown
  title?: unknown
  url?: unknown
}

type FirecrawlScrapeData = {
  description?: unknown
  images?: unknown
  links?: unknown
  markdown?: unknown
  metadata?: unknown
  screenshot?: unknown
  sourceURL?: unknown
  text?: unknown
  title?: unknown
  url?: unknown
}

function getFirecrawlApiKey() {
  const key = process.env.FIRECRAWL_API_KEY
  if (!key) {
    throw new Error("FIRECRAWL_API_KEY environment variable is not set.")
  }
  return key
}

async function firecrawlRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const configuredBaseUrl = process.env.FIRECRAWL_API_URL?.replace(/\/$/, "")
  const baseUrls = configuredBaseUrl ? [configuredBaseUrl] : [...DEFAULT_FIRECRAWL_BASE_URLS]
  let lastError: Error | null = null

  for (const baseUrl of baseUrls) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getFirecrawlApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const text = await response.text()
    const payload = text ? JSON.parse(text) as Record<string, unknown> : {}

    if (!response.ok || payload.success === false) {
      const message =
        typeof payload.error === "string"
          ? payload.error
          : typeof payload.message === "string"
            ? payload.message
            : `Firecrawl request failed with HTTP ${response.status}.`

      lastError = new Error(message)
      if (!configuredBaseUrl && (response.status === 404 || response.status === 405)) {
        continue
      }
      throw lastError
    }

    return payload as T
  }

  throw lastError ?? new Error("Firecrawl request failed.")
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function sourceFromUrl(url: string | null) {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

function normalizeSearchItems(payload: Record<string, unknown>): FirecrawlSearchItem[] {
  const candidates = payload.data ?? payload.results

  if (Array.isArray(candidates)) return candidates as FirecrawlSearchItem[]
  if (candidates && typeof candidates === "object" && Array.isArray((candidates as { results?: unknown }).results)) {
    return (candidates as { results: FirecrawlSearchItem[] }).results
  }
  if (candidates && typeof candidates === "object") {
    const record = candidates as Record<string, unknown>
    const groupedResults = ["web", "images", "news"].flatMap((key) =>
      Array.isArray(record[key]) ? record[key] as FirecrawlSearchItem[] : [],
    )
    if (groupedResults.length > 0) return groupedResults
  }
  return []
}

function normalizeImageSearchItems(payload: Record<string, unknown>): FirecrawlSearchItem[] {
  const candidates = payload.data ?? payload.results

  if (Array.isArray(candidates)) return candidates as FirecrawlSearchItem[]
  if (candidates && typeof candidates === "object") {
    const record = candidates as Record<string, unknown>
    const directImages = record.images ?? record.image
    if (Array.isArray(directImages)) return directImages as FirecrawlSearchItem[]
    if (Array.isArray(record.results)) return record.results as FirecrawlSearchItem[]
  }

  return []
}

function normalizeLinks(value: unknown): WebPageLink[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (typeof item === "string") {
      return [{ text: null, url: item }]
    }
    if (!item || typeof item !== "object") return []
    const record = item as Record<string, unknown>
    const url = asString(record.url ?? record.href)
    if (!url) return []
    return [{ text: asString(record.text ?? record.title), url }]
  }).slice(0, 30)
}

function normalizeImages(value: unknown): WebPageImage[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (typeof item === "string") {
      return [{ alt: null, url: item }]
    }
    if (!item || typeof item !== "object") return []
    const record = item as Record<string, unknown>
    const url = asString(record.url ?? record.src ?? record.imageUrl)
    if (!url) return []
    return [{ alt: asString(record.alt ?? record.title), url }]
  }).slice(0, 30)
}

function getScrapeData(payload: Record<string, unknown>) {
  return (payload.data && typeof payload.data === "object"
    ? payload.data
    : payload) as FirecrawlScrapeData
}

function truncate(value: string, maxChars: number) {
  return value.length > maxChars ? `${value.slice(0, maxChars).trimEnd()}\n\n[truncated]` : value
}

export async function firecrawlSearchWeb(query: string, limit: number): Promise<WebSearchResult[]> {
  const payload = await firecrawlRequest<Record<string, unknown>>("/search", {
    query,
    limit,
  })

  return normalizeSearchItems(payload)
    .map((item) => {
      const url = asString(item.url ?? item.link)
      return {
        source: asString(item.source) ?? sourceFromUrl(url),
        snippet: asString(item.description ?? item.markdown),
        title: asString(item.title) ?? url ?? "Untitled result",
        url: url ?? "",
      }
    })
    .filter((item) => item.url.length > 0)
    .slice(0, limit)
}

export async function firecrawlReadPage(rawUrl: string, options?: { maxChars?: number }): Promise<WebPageReadResult> {
  const url = await assertSafeHttpUrl(rawUrl)
  const payload = await firecrawlRequest<Record<string, unknown>>("/scrape", {
    formats: ["markdown", "links", "images"],
    onlyMainContent: true,
    timeout: 30_000,
    url,
  })
  const data = getScrapeData(payload)
  const metadata = data.metadata && typeof data.metadata === "object" ? data.metadata as Record<string, unknown> : {}
  const markdown = asString(data.markdown) ?? ""
  const text = asString(data.text) ?? markdown.replace(/[#*_`>\-[\]()]/g, " ")
  const maxChars = options?.maxChars ?? 20_000

  return {
    description: asString(data.description ?? metadata.description ?? metadata.ogDescription),
    finalUrl: asString(data.sourceURL ?? data.url ?? metadata.sourceURL ?? metadata.ogUrl) ?? url,
    images: normalizeImages(data.images),
    links: normalizeLinks(data.links),
    markdown: truncate(markdown, maxChars),
    provider: "firecrawl",
    text: truncate(text, maxChars),
    title: asString(data.title ?? metadata.title ?? metadata.ogTitle),
    url,
  }
}

export async function firecrawlSearchWebImages(query: string, limit: number): Promise<WebImageSearchResult[]> {
  const payload = await firecrawlRequest<Record<string, unknown>>("/search", {
    query,
    limit,
    sources: ["images"],
  })
  const seen = new Set<string>()

  const images: WebImageSearchResult[] = []

  for (const item of normalizeImageSearchItems(payload)) {
      const imageUrl = asString(item.imageUrl ?? item.image ?? item.url)
      const sourcePageUrl = asString(item.url ?? item.link)

      if (!imageUrl || !sourcePageUrl || seen.has(imageUrl)) {
        continue
      }

      seen.add(imageUrl)

      images.push({
        height: typeof item.imageHeight === "number" ? item.imageHeight : null,
        imageUrl,
        sourceDomain: sourceFromUrl(sourcePageUrl),
        sourcePageUrl,
        title: asString(item.title) ?? "Web image reference",
        width: typeof item.imageWidth === "number" ? item.imageWidth : null,
      })
    }

  return images.slice(0, limit)
}

export async function firecrawlCaptureScreenshot({
  fullPage,
  url: rawUrl,
  viewportHeight,
  viewportWidth,
}: {
  fullPage: boolean
  url: string
  viewportHeight: number
  viewportWidth: number
}): Promise<WebScreenshotResult> {
  const url = await assertSafeHttpUrl(rawUrl)
  const buildBody = (captureFullPage: boolean) => ({
    formats: [
      {
        type: "screenshot",
        fullPage: captureFullPage,
        quality: 80,
        viewport: {
          height: viewportHeight,
          width: viewportWidth,
        },
      },
    ],
    timeout: 120_000,
    url,
  })

  let actualFullPage = fullPage
  let payload: Record<string, unknown>

  try {
    payload = await firecrawlRequest<Record<string, unknown>>("/scrape", buildBody(fullPage))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const shouldRetryViewport =
      fullPage && (message.includes("SCRAPE_TIMEOUT") || message.toLowerCase().includes("timed out"))

    if (!shouldRetryViewport) {
      throw error
    }

    actualFullPage = false
    payload = await firecrawlRequest<Record<string, unknown>>("/scrape", buildBody(false))
  }

  const data = getScrapeData(payload)
  const screenshotUrl = asString(data.screenshot)

  if (!screenshotUrl) {
    throw new Error("Firecrawl did not return a screenshot URL.")
  }

  return {
    fullPage: actualFullPage,
    provider: "firecrawl",
    screenshotUrl,
    sourceUrl: asString(data.sourceURL ?? data.url) ?? url,
  }
}
