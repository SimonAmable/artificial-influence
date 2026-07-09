export const MCP_OAUTH_RETURN_COOKIE = "mcp_oauth_return"

export function isMcpOAuthContinuationPath(path: string) {
  return (
    path === "/oauth/resume" ||
    path.startsWith("/oauth/resume?") ||
    path.startsWith("/oauth/authorize")
  )
}

export function isSafeMcpOAuthReturnPath(path: string | null | undefined) {
  return Boolean(path && path.startsWith("/") && isMcpOAuthContinuationPath(path))
}

export function getMcpOAuthCookieDomain(requestHost?: string | null) {
  const explicit = process.env.MCP_COOKIE_DOMAIN?.trim()
  if (explicit) return explicit

  const baseHostname = getHostname(process.env.MCP_BASE_URL)
  const host = (baseHostname || requestHost || "").split(":")[0].toLowerCase()
  if (!host || host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return undefined

  const parts = host.split(".").filter(Boolean)
  if (parts.length === 2) return `.${host}`
  if (parts.length < 2) return undefined
  return `.${parts.slice(-2).join(".")}`
}

function getHostname(value: string | undefined) {
  if (!value) return null
  try {
    return new URL(value).hostname
  } catch {
    return null
  }
}
