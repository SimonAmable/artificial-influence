import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain"])

function parseIpv4(address: string) {
  const parts = address.split(".").map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null
  }
  return parts as [number, number, number, number]
}

export function isPrivateIpAddress(address: string) {
  const ipVersion = isIP(address)

  if (ipVersion === 4) {
    const parts = parseIpv4(address)
    if (!parts) return true
    const [a, b] = parts

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    )
  }

  if (ipVersion === 6) {
    const normalized = address.toLowerCase()
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:169.254.") ||
      normalized.startsWith("::ffff:192.168.")
    )
  }

  return false
}

function isBlockedHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "")
  return (
    BLOCKED_HOSTS.has(normalized) ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local")
  )
}

export async function assertSafeHttpUrl(rawUrl: string) {
  let parsed: URL

  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error("Invalid URL.")
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http(s) URLs are supported.")
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "")
  if (!hostname || isBlockedHostname(hostname)) {
    throw new Error("Local and private network URLs are not allowed.")
  }

  if (isIP(hostname)) {
    if (isPrivateIpAddress(hostname)) {
      throw new Error("Local and private network URLs are not allowed.")
    }
  } else {
    let addresses: Array<{ address: string }>
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true })
    } catch {
      throw new Error("Could not verify that the URL resolves to a public address.")
    }

    if (addresses.length === 0 || addresses.some((entry) => isPrivateIpAddress(entry.address))) {
      throw new Error("Local and private network URLs are not allowed.")
    }
  }

  parsed.hash = ""
  parsed.username = ""
  parsed.password = ""
  return parsed.toString()
}
