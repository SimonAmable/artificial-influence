import { load, type CheerioAPI } from "cheerio"

export type ExtractedMedia = {
  images: string[]
  videos: string[]
}

/** Raised cap so product galleries / carousels are not truncated at a dozen. */
const MAX_IMAGES = 32
const MAX_VIDEOS = 6

const TRACKER_HOST_FRAGMENTS = [
  "googletagmanager.com",
  "google-analytics.com",
  "analytics.google.com",
  "doubleclick.net",
  "facebook.com/tr",
  "facebook.com/audiencenetwork",
  "connect.facebook.net",
  "clarity.ms",
  "hotjar.com",
  "segment.io",
  "segment.com",
  "snapchat.com/tr",
  "tiktok.com/i18n/pixel",
  "bing.com/action",
  "bat.bing.com",
  "ads-twitter.com",
  "mixpanel.com",
  "fullstory.com",
  "intercom.io",
  "intercomcdn.com",
  "criteo.com",
  "outbrain.com",
  "taboola.com",
  "px.ads.linkedin.com",
  "linkedin.com/li.lms-analytics",
]

/**
 * URL substrings that almost always indicate UI chrome we don't want as
 * "reference media". Logo extraction is handled separately by `analyze-html`.
 */
const NON_REFERENCE_HINTS = [
  "favicon",
  "apple-touch",
  "android-chrome",
  "mstile",
  "browserconfig",
  "/sprite",
  "_sprite",
  "/icons/",
  "/icon-",
  "_icon.",
  "1x1.gif",
  "1x1.png",
  "pixel.gif",
  "spacer.gif",
  "blank.gif",
  "transparent.png",
  "transparent.gif",
]

const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i

function abs(base: string, raw: string | undefined | null): string | null {
  if (!raw) return null
  const t = raw.trim()
  if (!t) return null
  try {
    const u = new URL(t, base)
    if (u.protocol !== "http:" && u.protocol !== "https:") return null
    return u.href
  } catch {
    return null
  }
}

function isTrackerOrChrome(url: string): boolean {
  const lower = url.toLowerCase()
  for (const h of TRACKER_HOST_FRAGMENTS) {
    if (lower.includes(h)) return true
  }
  for (const h of NON_REFERENCE_HINTS) {
    if (lower.includes(h)) return true
  }
  return false
}

/** True when a URL clearly encodes a tiny rendered size (e.g. `_50x50.jpg`, `_thumb`). */
function smallSizeFromUrl(url: string): boolean {
  const lower = url.toLowerCase()
  if (/_thumb\b/.test(lower)) return true
  if (/_small\b/.test(lower)) return true
  const m = lower.match(/[_-](\d+)x(\d+)\.(?:png|jpe?g|webp|gif|avif|svg)\b/)
  if (m) {
    const w = Number(m[1])
    const h = Number(m[2])
    if (Number.isFinite(w) && Number.isFinite(h) && w < 200 && h < 200) return true
  }
  return false
}

/** Canonical key for dedupe: drops cache-busting + size query params and `_NxN` filename tokens. */
function dedupeKey(url: string): string {
  try {
    const u = new URL(url)
    const drop = new Set([
      "v", "width", "height", "w", "h", "quality", "q", "format", "auto",
      "fit", "crop", "dpr", "pad", "fm", "_", "ts", "size",
    ])
    for (const k of Array.from(u.searchParams.keys())) {
      if (drop.has(k.toLowerCase())) u.searchParams.delete(k)
    }
    u.pathname = u.pathname.replace(/[_-]\d+x\d+(\.[a-z0-9]+)$/i, "$1")
    return `${u.origin}${u.pathname}?${u.searchParams.toString()}`
  } catch {
    return url
  }
}

/** Decode `/_next/image?url=…` wrappers so we also capture the underlying CDN asset. */
function expandImageUrlVariants(base: string, raw: string | undefined | null): string[] {
  const out: string[] = []
  const primary = abs(base, raw)
  if (!primary) return out
  out.push(primary)
  try {
    const u = new URL(primary)
    if (!u.pathname.includes("/_next/image")) return out
    const inner = u.searchParams.get("url")
    if (!inner) return out
    const decoded = abs(base, decodeURIComponent(inner))
    if (decoded && decoded !== primary) out.push(decoded)
  } catch {
    /* ignore */
  }
  return out
}

function pushImageVariants(out: string[], seen: Set<string>, base: string, raw: string | null | undefined): void {
  for (const href of expandImageUrlVariants(base, raw)) {
    pushImage(out, seen, href)
  }
}

/** Pull `url(...)` targets from CSS; `base` should be the stylesheet URL for correct relative resolution. */
function extractImageUrlsFromCss(css: string, base: string): string[] {
  const found: string[] = []
  const re = /url\(\s*(["']?)([^"')]+)\1\s*\)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(css)) !== null) {
    const raw = m[2]?.trim()
    if (!raw || raw.startsWith("data:") || raw.startsWith("#")) continue
    if (/\.(woff2?|ttf|eot|otf)(\?|#|$)/i.test(raw)) continue
    const u = abs(base, raw)
    if (u && /\.(png|jpe?g|webp|gif|avif|svg)(\?|#|$)/i.test(u)) {
      found.push(u)
    }
  }
  return found
}

function urlsFromInlineStyle(styleAttr: string | undefined): string[] {
  if (!styleAttr?.includes("url(")) return []
  const out: string[] = []
  const re = /url\(\s*(["']?)([^"')]+)\1\s*\)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(styleAttr)) !== null) {
    const raw = m[2]?.trim()
    if (raw && !raw.startsWith("data:") && !raw.startsWith("#")) out.push(raw)
  }
  return out
}

/** Pick the highest-resolution candidate from an `srcset` string. */
function largestFromSrcset(base: string, srcset: string | undefined | null): string | null {
  if (!srcset) return null
  let bestW: { url: string; n: number } | null = null
  let bestX: { url: string; n: number } | null = null
  let firstUrl: string | null = null
  for (const part of srcset.split(",")) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const [rawUrl, descriptor] = trimmed.split(/\s+/, 2)
    const u = abs(base, rawUrl)
    if (!u) continue
    if (!firstUrl) firstUrl = u
    if (descriptor?.endsWith("w")) {
      const n = Number(descriptor.slice(0, -1))
      if (Number.isFinite(n) && (!bestW || n > bestW.n)) bestW = { url: u, n }
    } else if (descriptor?.endsWith("x")) {
      const n = Number(descriptor.slice(0, -1))
      if (Number.isFinite(n) && (!bestX || n > bestX.n)) bestX = { url: u, n }
    }
  }
  return bestW?.url ?? bestX?.url ?? firstUrl
}

function pushImage(out: string[], seen: Set<string>, url: string | null): void {
  if (!url) return
  if (isTrackerOrChrome(url)) return
  if (smallSizeFromUrl(url)) return
  if (out.length >= MAX_IMAGES) return
  const key = dedupeKey(url)
  if (seen.has(key)) return
  seen.add(key)
  out.push(url)
}

function pushVideo(out: string[], seen: Set<string>, url: string | null): void {
  if (!url) return
  if (isTrackerOrChrome(url)) return
  if (out.length >= MAX_VIDEOS) return
  const key = dedupeKey(url)
  if (seen.has(key)) return
  seen.add(key)
  out.push(url)
}

// ----- JSON-LD -----

const JSONLD_IMAGE_FIELDS = [
  "image",
  "logo",
  "thumbnailUrl",
  "primaryImageOfPage",
  "photo",
  "screenshot",
  "associatedMedia",
]
const JSONLD_VIDEO_FIELDS = ["video", "trailer", "videoObject"]

function collectImageLike(v: unknown, out: Set<string>): void {
  if (!v) return
  if (typeof v === "string") {
    out.add(v.trim())
    return
  }
  if (Array.isArray(v)) {
    for (const x of v) collectImageLike(x, out)
    return
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>
    const url = (typeof o.url === "string" && o.url) || (typeof o.contentUrl === "string" && o.contentUrl)
    if (url) out.add(url.trim())
  }
}

function collectVideoLike(v: unknown, out: Set<string>): void {
  if (!v) return
  if (typeof v === "string") {
    out.add(v.trim())
    return
  }
  if (Array.isArray(v)) {
    for (const x of v) collectVideoLike(x, out)
    return
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>
    const url =
      (typeof o.contentUrl === "string" && o.contentUrl) ||
      (typeof o.embedUrl === "string" && o.embedUrl) ||
      (typeof o.url === "string" && o.url)
    if (url) out.add(url.trim())
  }
}

function walkJsonLd(node: unknown, images: Set<string>, videos: Set<string>): void {
  if (!node) return
  if (Array.isArray(node)) {
    for (const n of node) walkJsonLd(n, images, videos)
    return
  }
  if (typeof node !== "object") return
  const obj = node as Record<string, unknown>

  const tRaw = obj["@type"]
  const typeStr = (Array.isArray(tRaw) ? tRaw.join(",") : String(tRaw ?? "")).toLowerCase()

  for (const k of JSONLD_IMAGE_FIELDS) collectImageLike(obj[k], images)
  for (const k of JSONLD_VIDEO_FIELDS) collectVideoLike(obj[k], videos)

  if (typeStr.includes("imageobject")) {
    const u = (typeof obj.contentUrl === "string" && obj.contentUrl) || (typeof obj.url === "string" && obj.url)
    if (u) images.add(u.trim())
  }
  if (typeStr.includes("videoobject")) {
    const u = (typeof obj.contentUrl === "string" && obj.contentUrl) || (typeof obj.embedUrl === "string" && obj.embedUrl)
    if (u) videos.add(u.trim())
    collectImageLike(obj.thumbnailUrl, images)
  }

  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") walkJsonLd(v, images, videos)
  }
}

function extractFromJsonLd($: CheerioAPI): { images: string[]; videos: string[] } {
  const imgs = new Set<string>()
  const vids = new Set<string>()
  $('script[type="application/ld+json"]').each((_, el) => {
    const txt = $(el).text()
    if (!txt.trim()) return
    try {
      walkJsonLd(JSON.parse(txt), imgs, vids)
    } catch {
      // Malformed JSON-LD is common on real sites; skip silently.
    }
  })
  return { images: Array.from(imgs), videos: Array.from(vids) }
}

/**
 * Extract reference image and video URLs from page HTML.
 *
 * Priority order (higher signal first):
 *   1. JSON-LD (`Product`, `ImageObject`, `VideoObject`, `photo`, `screenshot`, …)
 *   2. Open Graph / Twitter / `article:image` meta tags
 *   3. `<link rel="preload" as="image">` (`href` + `imagesrcset`)
 *   4. `<picture><source>` (`srcset` + `src`) and `<img>` (lazy attributes + `srcset`)
 *   5. `<noscript>` fallbacks (SEO / no-JS real `<img>` URLs)
 *   6. Inline `style="…url(…)…"` on elements
 *   7. `<video>` / `<iframe>` embeds
 *   8. Optional same-origin CSS `url(...)` (hero backgrounds, etc.)
 *
 * Next.js `/_next/image?url=…` URLs are expanded to the underlying asset where possible.
 * Tracker hosts and obvious chrome are dropped. Deduped by canonical key. Capped at
 * `MAX_IMAGES` / `MAX_VIDEOS`.
 */
export function extractMedia(
  html: string,
  finalUrl: string,
  cssSheets?: { href: string; text: string }[],
): ExtractedMedia {
  const $ = load(html)

  const images: string[] = []
  const videos: string[] = []
  const imgSeen = new Set<string>()
  const vidSeen = new Set<string>()

  const ld = extractFromJsonLd($)
  for (const u of ld.images) pushImageVariants(images, imgSeen, finalUrl, u)
  for (const u of ld.videos) pushVideo(videos, vidSeen, abs(finalUrl, u))

  $(
    'meta[property="og:image"], meta[property="og:image:secure_url"], meta[property="product:image"], meta[property="article:image"], meta[name="twitter:image"], meta[name="twitter:image:src"]',
  ).each((_, el) => {
    pushImageVariants(images, imgSeen, finalUrl, $(el).attr("content"))
  })

  $(
    'meta[property="og:video"], meta[property="og:video:url"], meta[property="og:video:secure_url"]',
  ).each((_, el) => {
    pushVideo(videos, vidSeen, abs(finalUrl, $(el).attr("content")))
  })

  $('link[rel="preload"][as="image"][href]').each((_, el) => {
    const $el = $(el)
    pushImageVariants(images, imgSeen, finalUrl, $el.attr("href"))
    pushImageVariants(images, imgSeen, finalUrl, largestFromSrcset(finalUrl, $el.attr("imagesrcset")))
  })

  $("picture source").each((_, el) => {
    const $el = $(el)
    pushImageVariants(images, imgSeen, finalUrl, largestFromSrcset(finalUrl, $el.attr("srcset")))
    pushImageVariants(images, imgSeen, finalUrl, $el.attr("src"))
  })

  const imgSrcAttrs = [
    "data-src",
    "data-lazy-src",
    "data-original",
    "data-large_image",
    "data-full",
    "data-hi-res",
    "data-zoom",
    "data-zoom-image",
    "data-image",
    "src",
  ]

  $("img").each((_, el) => {
    const $el = $(el)
    const w = Number($el.attr("width") ?? "")
    const h = Number($el.attr("height") ?? "")
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 && w <= 48 && h <= 48) {
      return
    }
    const fromSet =
      largestFromSrcset(finalUrl, $el.attr("srcset")) ??
      largestFromSrcset(finalUrl, $el.attr("data-srcset")) ??
      largestFromSrcset(finalUrl, $el.attr("data-lazy-srcset"))
    if (fromSet) {
      pushImageVariants(images, imgSeen, finalUrl, fromSet)
    }
    for (const attr of imgSrcAttrs) {
      const v = $el.attr(attr)
      if (v) pushImageVariants(images, imgSeen, finalUrl, v)
    }
  })

  $("noscript").each((_, el) => {
    const inner = $(el).html()
    if (!inner?.trim()) return
    const $n = load(inner)
    $n("img").each((_2, img) => {
      const $img = $n(img)
      const fromSet =
        largestFromSrcset(finalUrl, $img.attr("srcset")) ??
        largestFromSrcset(finalUrl, $img.attr("data-srcset"))
      if (fromSet) {
        pushImageVariants(images, imgSeen, finalUrl, fromSet)
      } else {
        pushImageVariants(images, imgSeen, finalUrl, $img.attr("src"))
      }
    })
  })

  $('[style*="url("]').each((_, el) => {
    for (const raw of urlsFromInlineStyle($(el).attr("style"))) {
      pushImageVariants(images, imgSeen, finalUrl, raw)
    }
  })

  $("video").each((_, el) => {
    const $el = $(el)
    pushImageVariants(images, imgSeen, finalUrl, $el.attr("poster"))
    const direct = abs(finalUrl, $el.attr("src"))
    if (direct && (VIDEO_EXT_RE.test(direct) || direct.includes(".m3u8"))) {
      pushVideo(videos, vidSeen, direct)
    }
    $el.find("source").each((_2, src) => {
      const u = abs(finalUrl, $(src).attr("src"))
      if (u && (VIDEO_EXT_RE.test(u) || u.includes(".m3u8"))) {
        pushVideo(videos, vidSeen, u)
      }
    })
  })

  $("iframe[src]").each((_, el) => {
    const u = abs(finalUrl, $(el).attr("src"))
    if (!u) return
    const lower = u.toLowerCase()
    const isEmbed =
      lower.includes("youtube.com/embed/") ||
      lower.includes("youtube-nocookie.com/embed/") ||
      lower.includes("player.vimeo.com/video/") ||
      lower.includes("fast.wistia.net/embed/") ||
      lower.includes("fast.wistia.com/embed/")
    if (isEmbed) pushVideo(videos, vidSeen, u)
  })

  if (cssSheets?.length) {
    for (const { href, text } of cssSheets) {
      for (const u of extractImageUrlsFromCss(text, href)) {
        pushImageVariants(images, imgSeen, finalUrl, u)
      }
    }
  }

  return { images, videos }
}
