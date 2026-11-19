import net from "node:net"

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
]

const MAX_REDIRECTS = 3
const MAX_CONTENT_LENGTH_BYTES = 250 * 1024 * 1024

export function assertHttpsPublicUrl(raw: string): URL {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error("Paste a public HTTPS post or media URL.")
  }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error("That URL doesn't look valid.")
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Only public HTTPS URLs are supported.")
  }
  if (parsed.username || parsed.password) {
    throw new Error("URLs with embedded credentials are not allowed.")
  }
  const hostname = parsed.hostname.toLowerCase()
  if (PRIVATE_HOST_PATTERNS.some((re) => re.test(hostname))) {
    throw new Error("Local or private network URLs are not allowed.")
  }
  const ipType = net.isIP(hostname)
  if (ipType === 4 || ipType === 6) {
  const octets = hostname.split(".").map((p) => Number.parseInt(p, 10))
    if (ipType === 4 && octets.length === 4) {
      const [a, b] = octets
      if (a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)) {
        throw new Error("Private IP addresses are not allowed.")
      }
    }
  }
  return parsed
}

export function isAllowedDirectMediaHostname(hostname: string): boolean {
  const host = hostname.replace(/^www\./i, "").toLowerCase()
  const allowedSuffixes = [
    "tiktokcdn.com",
    "tiktokv.com",
    "cdninstagram.com",
    "fbcdn.net",
    "redd.it",
    "redditmedia.com",
    "redditspeed.com",
    "pinimg.com",
    "twimg.com",
    "video.twimg.com",
    "pbs.twimg.com",
    "media.tenor.com",
    "i.redd.it",
    "v.redd.it",
    "redgifs.com",
    "media.redgifs.com",
    "gfycat.com",
    "imgur.com",
    "i.imgur.com",
  ]
  return allowedSuffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
}

export async function fetchHttpsWithRedirectGuard(
  startUrl: string,
  init?: RequestInit,
): Promise<Response> {
  let current = assertHttpsPublicUrl(startUrl).href
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(current, {
      ...init,
      redirect: "manual",
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location")
      if (!location || hop === MAX_REDIRECTS) {
        throw new Error("Too many redirects while fetching media.")
      }
      const next = new URL(location, current)
      current = assertHttpsPublicUrl(next.href).href
      continue
    }
    return response
  }
  throw new Error("Could not fetch media.")
}

export function assertContentLengthAllowed(contentLength: string | null): void {
  if (!contentLength) return
  const bytes = Number.parseInt(contentLength, 10)
  if (Number.isFinite(bytes) && bytes > MAX_CONTENT_LENGTH_BYTES) {
    throw new Error("This file is too large to import.")
  }
}

export function sniffMediaKindFromContentType(contentType: string | null): "image" | "video" | "animated" | null {
  if (!contentType) return null
  const lower = contentType.toLowerCase()
  if (lower.includes("image/gif")) return "animated"
  if (lower.startsWith("image/")) return "image"
  if (lower.startsWith("video/")) return "video"
  return null
}