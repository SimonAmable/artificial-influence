import dns from "node:dns/promises"
import net from "node:net"

const FETCH_TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 5
const MAX_BODY_CHARS = 2_000_000

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "metadata",
])

function isPrivateOrReservedIPv4(parts: number[]): boolean {
  if (parts.length !== 4) return false
  const [a, b] = parts
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  return false
}

/** Returns true if the IP string should be blocked (SSRF). */
export function isBlockedIp(ip: string): boolean {
  const trimmed = ip.trim()
  if (trimmed.includes(".")) {
    const parts = trimmed.split(".").map((p) => Number(p))
    if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true
    return isPrivateOrReservedIPv4(parts)
  }
  if (trimmed.includes(":")) {
    const low = trimmed.toLowerCase()
    if (low === "::1") return true
    if (low.startsWith("fe80:")) return true
    if (low.startsWith("fc") || low.startsWith("fd")) return true
    if (low.startsWith("::ffff:")) {
      const v4 = low.slice("::ffff:".length)
      if (v4.includes(".")) {
        const parts = v4.split(".").map((p) => Number(p))
        if (parts.length === 4 && !parts.some((n) => Number.isNaN(n)))
          return isPrivateOrReservedIPv4(parts)
      }
    }
    return false
  }
  return true
}

async function assertHostnameResolvesPublic(hostname: string): Promise<void> {
  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) {
    throw new Error("Host not allowed")
  }
  try {
    const records = await dns.lookup(hostname, { all: true })
    for (const r of records) {
      if (isBlockedIp(r.address)) {
        throw new Error("Host resolves to a non-public address")
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Host resolves")) throw e
    throw new Error("Could not resolve host")
  }
}

/**
 * Normalize user input to an absolute http(s) URL string.
 */
export function normalizeHttpUrl(raw: string): string {
  const t = raw.trim()
  if (!t) throw new Error("URL is required")
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`
  let u: URL
  try {
    u = new URL(withProto)
  } catch {
    throw new Error("Invalid URL")
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed")
  }
  if (u.username || u.password) {
    throw new Error("URLs with credentials are not allowed")
  }
  if (BLOCKED_HOSTNAMES.has(u.hostname.toLowerCase())) {
    throw new Error("Host not allowed")
  }
  // Block literal IP in hostname (validated in assertUrlSafeForFetch)
  return u.href
}

export async function assertUrlSafeForFetch(href: string): Promise<URL> {
  const u = new URL(href)
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed")
  }
  if (BLOCKED_HOSTNAMES.has(u.hostname.toLowerCase())) {
    throw new Error("Host not allowed")
  }

  // Only treat *literal* IPs as IPs. Domain names (e.g. example.com) contain dots but
  // must not go through isBlockedIp — that would mis-parse labels as octets and block everything.
  if (net.isIP(u.hostname) !== 0 && isBlockedIp(u.hostname)) {
    throw new Error("Address not allowed")
  }

  await assertHostnameResolvesPublic(u.hostname)
  return u
}

export type SafeFetchResult = {
  html: string
  finalUrl: string
  contentType: string | null
}

/**
 * Fetch a URL with manual redirect handling and SSRF checks at each hop.
 */
export async function fetchUrlSafe(startHref: string): Promise<SafeFetchResult> {
  let current = await assertUrlSafeForFetch(normalizeHttpUrl(startHref))

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    current = await assertUrlSafeForFetch(current.href)

    const res = await fetch(current.href, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BrandKitBot/1.0; +https://example.invalid) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location")
      if (!loc || hop === MAX_REDIRECTS) {
        throw new Error("Too many redirects or missing Location")
      }
      current = new URL(loc, current)
      continue
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const ct = res.headers.get("content-type")
    const text = await res.text()
    return {
      html: text.slice(0, MAX_BODY_CHARS),
      finalUrl: current.href,
      contentType: ct,
    }
  }

  throw new Error("Too many redirects")
}

const MAX_CSS_FETCH_BYTES = 400_000

/**
 * Fetch a stylesheet (or text) URL with the same SSRF + redirect rules as fetchUrlSafe.
 * Returns null on any failure so callers can skip optional assets.
 */
export async function fetchCssTextSafe(href: string): Promise<string | null> {
  try {
    let current = await assertUrlSafeForFetch(normalizeHttpUrl(href))

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      current = await assertUrlSafeForFetch(current.href)

      const res = await fetch(current.href, {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; BrandKitBot/1.0; +https://example.invalid) AppleWebKit/537.36",
          Accept: "text/css,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location")
        if (!loc || hop === MAX_REDIRECTS) {
          return null
        }
        current = new URL(loc, current)
        continue
      }

      if (!res.ok) {
        return null
      }

      const text = await res.text()
      return text.slice(0, MAX_CSS_FETCH_BYTES)
    }

    return null
  } catch {
    return null
  }
}
