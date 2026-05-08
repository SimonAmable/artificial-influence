import { load } from "cheerio"

import {
  extractColorLiteralsFromHtml,
  extractColorsFromCssText,
  mergeColorCandidateLists,
  parseThemeColorMeta,
} from "@/lib/brand-kit/extract-colors-from-html"
import { extractMedia } from "@/lib/brand-kit/extract-media"
import { fetchSameOriginStylesheets } from "@/lib/brand-kit/fetch-same-origin-stylesheets"

export type PageExtraction = {
  title: string | null
  description: string | null
  visibleText: string
  logoCandidates: string[]
  /** Reference image URLs scraped from JSON-LD, OG tags, and `<img>`/`<picture>` markup. */
  referenceImages: string[]
  /** Reference video URLs scraped from JSON-LD, OG tags, `<video>`, and known embed iframes. */
  referenceVideos: string[]
  /** From meta theme-color when parseable */
  themeColorHint: string | null
  /** #RRGGBB from theme meta, semantic CSS variables on same-origin CSS, and inline `<style>` / `style=""` */
  extractedColorCandidates: string[]
}

function absUrl(base: string, href: string | undefined): string | null {
  if (!href?.trim()) return null
  try {
    return new URL(href.trim(), base).href
  } catch {
    return null
  }
}

function pushUnique(list: string[], u: string | null) {
  if (!u) return
  if (!list.includes(u)) list.push(u)
}

/**
 * Extract meta, icon candidates, truncated visible text, and colors from HTML + same-origin CSS.
 */
export async function extractPageForBrand(html: string, finalUrl: string): Promise<PageExtraction> {
  const fromHtml = extractColorLiteralsFromHtml(html)

  const $ = load(html)
  const base = finalUrl

  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() ?? null
  const ogSite = $('meta[property="og:site_name"]').attr("content")?.trim() ?? null
  const twTitle = $('meta[name="twitter:title"]').attr("content")?.trim() ?? null
  const docTitle = $("title").first().text().trim() || null
  const h1 = $("h1").first().text().trim() || null

  const title = ogTitle ?? twTitle ?? ogSite ?? docTitle ?? h1

  const ogDesc = $('meta[property="og:description"]').attr("content")?.trim() ?? null
  const twDesc = $('meta[name="twitter:description"]').attr("content")?.trim() ?? null
  const metaDesc = $('meta[name="description"]').attr("content")?.trim() ?? null
  const description = ogDesc ?? twDesc ?? metaDesc

  const themeMeta =
    $('meta[name="theme-color"]').attr("content")?.trim() ??
    $('meta[name="msapplication-TileColor"]').attr("content")?.trim() ??
    null
  const themeColorHint = parseThemeColorMeta(themeMeta)

  const fromStylesheets: string[] = []
  const cssSheets = await fetchSameOriginStylesheets(html, finalUrl)
  try {
    for (const { text } of cssSheets) {
      fromStylesheets.push(...extractColorsFromCssText(text))
    }
  } catch (e) {
    console.error("[extractPageForBrand] stylesheet colors:", e)
  }

  const extractedColorCandidates = mergeColorCandidateLists(themeColorHint, fromStylesheets, fromHtml)

  const logoCandidates: string[] = []

  const ogImage = $('meta[property="og:image"]').attr("content")
  pushUnique(logoCandidates, absUrl(base, ogImage))
  const twImage = $('meta[name="twitter:image"]').attr("content")
  pushUnique(logoCandidates, absUrl(base, twImage))
  const twImageSrc = $('meta[name="twitter:image:src"]').attr("content")
  pushUnique(logoCandidates, absUrl(base, twImageSrc))

  $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').each((_, el) => {
    const href = $(el).attr("href")
    pushUnique(logoCandidates, absUrl(base, href))
  })

  // Extract reference media before stripping `<script>` (JSON-LD lives there).
  const media = extractMedia(html, finalUrl, cssSheets)
  const logoSet = new Set(logoCandidates)
  const referenceImages = media.images.filter((u) => !logoSet.has(u))
  const referenceVideos = media.videos

  $("script, style, noscript").remove()
  const main = $("main").length ? $("main") : $("body")
  let text = main.text().replace(/\s+/g, " ").trim()
  const max = 14_000
  if (text.length > max) {
    text = `${text.slice(0, max)}…`
  }

  return {
    title,
    description,
    visibleText: text,
    logoCandidates: logoCandidates.filter(Boolean),
    referenceImages,
    referenceVideos,
    themeColorHint,
    extractedColorCandidates,
  }
}
