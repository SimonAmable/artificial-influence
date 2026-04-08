import { load } from "cheerio"

import { fetchCssTextSafe } from "@/lib/brand-kit/url-safety"

const MAX_STYLESHEETS = 10

/**
 * Load linked stylesheet bodies from the same origin as `pageUrl` (SSRF-safe per fetch).
 */
export async function fetchSameOriginStylesheetTexts(html: string, pageUrl: string): Promise<string[]> {
  let pageOrigin: string
  try {
    pageOrigin = new URL(pageUrl).origin
  } catch {
    return []
  }

  const $ = load(html)
  const hrefs: string[] = []

  $('link[rel="stylesheet"][href]').each((_, el) => {
    const href = $(el).attr("href")
    if (!href?.trim()) return
    try {
      const abs = new URL(href.trim(), pageUrl).href
      if (new URL(abs).origin !== pageOrigin) return
      if (abs.startsWith("data:") || abs.startsWith("blob:")) return
      hrefs.push(abs)
    } catch {
      /* skip */
    }
  })

  $('link[rel="preload"][as="style"][href]').each((_, el) => {
    const href = $(el).attr("href")
    if (!href?.trim()) return
    try {
      const abs = new URL(href.trim(), pageUrl).href
      if (new URL(abs).origin !== pageOrigin) return
      if (abs.startsWith("data:") || abs.startsWith("blob:")) return
      if (!hrefs.includes(abs)) hrefs.push(abs)
    } catch {
      /* skip */
    }
  })

  const texts: string[] = []
  for (const href of hrefs.slice(0, MAX_STYLESHEETS)) {
    const css = await fetchCssTextSafe(href)
    if (css?.trim()) texts.push(css)
  }

  return texts
}
