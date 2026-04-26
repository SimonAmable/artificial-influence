import { load } from "cheerio"
import type { CheerioAPI } from "cheerio"
import type { WebPageImage, WebPageLink, WebPageReadResult } from "@/lib/server/web-research/types"
import { assertSafeHttpUrl } from "@/lib/server/web-research/url-safety"

const SIMPLE_SCRAPE_TIMEOUT_MS = 8_000
const MIN_USEFUL_TEXT_LENGTH = 500

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function truncate(value: string, maxChars: number) {
  return value.length > maxChars ? `${value.slice(0, maxChars).trimEnd()}\n\n[truncated]` : value
}

function absoluteUrl(value: string | undefined, baseUrl: string) {
  if (!value) return null
  try {
    const parsed = new URL(value, baseUrl)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
    parsed.hash = ""
    return parsed.toString()
  } catch {
    return null
  }
}

function extractLinks($: CheerioAPI, baseUrl: string): WebPageLink[] {
  const seen = new Set<string>()
  const links: WebPageLink[] = []

  $("a[href]").each((_, element) => {
    const url = absoluteUrl($(element).attr("href"), baseUrl)
    if (!url || seen.has(url)) return
    seen.add(url)
    links.push({
      text: cleanText($(element).text()) || null,
      url,
    })
  })

  return links.slice(0, 30)
}

function extractImages($: CheerioAPI, baseUrl: string): WebPageImage[] {
  const seen = new Set<string>()
  const images: WebPageImage[] = []

  $("img[src], img[data-src], meta[property='og:image'], meta[name='twitter:image']").each((_, element) => {
    const el = $(element)
    const url = absoluteUrl(el.attr("content") ?? el.attr("src") ?? el.attr("data-src"), baseUrl)
    if (!url || seen.has(url)) return
    seen.add(url)
    images.push({
      alt: cleanText(el.attr("alt") ?? "") || null,
      url,
    })
  })

  return images.slice(0, 30)
}

function extractMainText($: CheerioAPI) {
  $("script, style, noscript, svg, iframe, nav, footer, form").remove()
  const mainText =
    cleanText($("main").text()) ||
    cleanText($("article").text()) ||
    cleanText($("[role='main']").text()) ||
    cleanText($("body").text())

  return mainText
}

function buildMarkdown({
  description,
  text,
  title,
}: {
  description: string | null
  text: string
  title: string | null
}) {
  const parts = []
  if (title) parts.push(`# ${title}`)
  if (description) parts.push(description)
  if (text) parts.push(text)
  return parts.join("\n\n")
}

export function pageLooksLowQuality(text: string, html?: string) {
  const lowerText = text.toLowerCase()
  const lowerHtml = (html ?? "").toLowerCase()

  return (
    text.length < MIN_USEFUL_TEXT_LENGTH ||
    lowerText.includes("enable javascript") ||
    lowerText.includes("checking your browser") ||
    lowerText.includes("access denied") ||
    lowerText.includes("captcha") ||
    lowerHtml.includes("__next") && text.length < 900 ||
    lowerHtml.includes("cf-chl") ||
    lowerHtml.includes("cloudflare")
  )
}

export async function simpleScrapeUrl(rawUrl: string, options?: { maxChars?: number }): Promise<WebPageReadResult> {
  const url = await assertSafeHttpUrl(rawUrl)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SIMPLE_SCRAPE_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "UniCanBot/1.0 (+https://unican.ai)",
      },
      signal: controller.signal,
    })

    if (response.status === 403 || response.status === 429 || response.status >= 500) {
      throw new Error(`Simple scrape received HTTP ${response.status}.`)
    }

    if (!response.ok) {
      throw new Error(`Simple scrape received HTTP ${response.status}.`)
    }

    const contentType = response.headers.get("content-type") ?? ""
    if (!contentType.toLowerCase().includes("text/html")) {
      throw new Error(`Simple scrape expected HTML but received ${contentType || "unknown content"}.`)
    }

    const html = await response.text()
    const $ = load(html)
    const finalUrl = response.url || url
    const title = cleanText($("title").first().text()) || cleanText($("h1").first().text()) || null
    const description =
      cleanText($("meta[name='description']").attr("content") ?? "") ||
      cleanText($("meta[property='og:description']").attr("content") ?? "") ||
      null
    const text = extractMainText($)

    if (pageLooksLowQuality(text, html)) {
      throw new Error("Simple scrape returned weak or blocked-looking content.")
    }

    const maxChars = options?.maxChars ?? 20_000
    const truncatedText = truncate(text, maxChars)

    return {
      description,
      finalUrl,
      images: extractImages($, finalUrl),
      links: extractLinks($, finalUrl),
      markdown: truncate(buildMarkdown({ description, text, title }), maxChars),
      provider: "simple",
      text: truncatedText,
      title,
      url,
    }
  } finally {
    clearTimeout(timeout)
  }
}
