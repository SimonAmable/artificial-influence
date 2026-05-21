/** Hostnames we can proxy server-side for in-app TikTok preview playback. */
const PROXY_HOST_SUFFIXES = ["tiktokcdn.com", "tiktokv.com"] as const

function parseHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function isApifyHostedMp4Url(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== "api.apify.com") return false
    const path = parsed.pathname.toLowerCase()
    return path.includes("/v2/key-value-stores/") && path.includes("/records/") && path.endsWith(".mp4")
  } catch {
    return false
  }
}

export function isTikTokCdnMediaUrl(url: string): boolean {
  const host = parseHostname(url)
  if (!host) return false
  return PROXY_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
}

/** Whether this URL must be loaded via `/api/tiktok-references/stream` (auth + server fetch). */
export function needsTikTokPlaybackProxy(url: string): boolean {
  return isTikTokCdnMediaUrl(url) || isApifyHostedMp4Url(url)
}

export function isAllowedTikTokStreamSourceUrl(url: string): boolean {
  return needsTikTokPlaybackProxy(url)
}

/** Same-origin playback URL for `<video src>` — proxies TikTok CDN / Apify KV through our API. */
export function toTikTokPlaybackUrl(sourceUrl: string | null | undefined): string | null {
  if (typeof sourceUrl !== "string" || !sourceUrl.startsWith("http")) {
    return null
  }
  if (!needsTikTokPlaybackProxy(sourceUrl)) {
    return sourceUrl
  }
  return `/api/tiktok-references/stream?url=${encodeURIComponent(sourceUrl)}`
}
