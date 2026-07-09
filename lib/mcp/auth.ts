import "server-only"

import { createHash, randomBytes, timingSafeEqual } from "crypto"
import type { User } from "@supabase/supabase-js"

import { createServiceRoleClient } from "@/lib/supabase/service-role"

export const MCP_ACCESS_TOKEN_PREFIX = "unican_mcp_"
export const MCP_REFRESH_TOKEN_PREFIX = "unican_mcp_refresh_"

export const MCP_SCOPES = [
  "account:read",
  "models:read",
  "generations:read",
  "generations:write",
] as const

export type McpScope = (typeof MCP_SCOPES)[number]

export type McpAuthContext = {
  tokenId: string
  rawToken: string
  clientId: string
  scopes: McpScope[]
  user: Pick<User, "id" | "email">
}

export class McpAuthError extends Error {
  status: number

  constructor(message: string, status = 401) {
    super(message)
    this.name = "McpAuthError"
    this.status = status
  }
}

export function getMcpBaseUrl(requestUrl: URL) {
  return process.env.MCP_BASE_URL?.replace(/\/$/, "") || requestUrl.origin
}

export function getMcpEndpointUrl(requestUrl: URL) {
  return `${getMcpBaseUrl(requestUrl)}/mcp`
}

export function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

export function randomToken(prefix: string) {
  return `${prefix}${randomBytes(32).toString("base64url")}`
}

export function normalizeScopes(rawScope: string | null | undefined): McpScope[] {
  const requested = (rawScope || "")
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean)

  const allowed = new Set<string>(MCP_SCOPES)
  const scopes = requested.filter((scope): scope is McpScope => allowed.has(scope))
  return scopes.length > 0 ? [...new Set(scopes)] : [...MCP_SCOPES]
}

export function hasScopes(auth: McpAuthContext, requiredScopes: McpScope[]) {
  const granted = new Set(auth.scopes)
  return requiredScopes.every((scope) => granted.has(scope))
}

export async function requireMcpAuth(
  headers: Headers,
  requiredScopes: McpScope[] = [],
): Promise<McpAuthContext> {
  const authorization = headers.get("authorization") || ""
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  const rawToken = match?.[1]?.trim()

  if (!rawToken || !rawToken.startsWith(MCP_ACCESS_TOKEN_PREFIX)) {
    throw new McpAuthError("Missing MCP bearer token")
  }

  const supabase = createServiceRoleClient()
  if (!supabase) {
    throw new McpAuthError("MCP auth is not configured", 500)
  }

  const tokenHash = hashToken(rawToken)
  const { data: tokenRow, error } = await supabase
    .from("mcp_oauth_tokens")
    .select("id, client_id, user_id, scopes, expires_at, revoked_at")
    .eq("access_token_hash", tokenHash)
    .maybeSingle()

  if (error || !tokenRow) {
    throw new McpAuthError("Invalid MCP bearer token")
  }

  if (tokenRow.revoked_at) {
    throw new McpAuthError("MCP bearer token has been revoked")
  }

  if (new Date(String(tokenRow.expires_at)).getTime() <= Date.now()) {
    throw new McpAuthError("MCP bearer token has expired")
  }

  const scopes = Array.isArray(tokenRow.scopes)
    ? tokenRow.scopes.filter((scope): scope is McpScope =>
        (MCP_SCOPES as readonly string[]).includes(String(scope)),
      )
    : []

  const auth: McpAuthContext = {
    tokenId: String(tokenRow.id),
    rawToken,
    clientId: String(tokenRow.client_id),
    scopes,
    user: { id: String(tokenRow.user_id), email: undefined },
  }

  if (!hasScopes(auth, requiredScopes)) {
    throw new McpAuthError("MCP bearer token does not include the required scope", 403)
  }

  const { data: userResult } = await supabase.auth.admin.getUserById(auth.user.id)
  auth.user.email = userResult.user?.email

  void supabase
    .from("mcp_oauth_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", auth.tokenId)

  return auth
}

export async function validateClientRedirect(clientId: string, redirectUri: string) {
  const client = await getMcpClient(clientId)

  if (!client) return null
  const redirectUris = Array.isArray(client.redirect_uris) ? client.redirect_uris : []
  if (!redirectUris.includes(redirectUri)) return null
  return client
}

export async function getMcpClient(clientId: string) {
  const supabase = createServiceRoleClient()
  if (!supabase) return null

  const { data: client } = await supabase
    .from("mcp_oauth_clients")
    .select("client_id, redirect_uris, token_endpoint_auth_method, client_secret_hash")
    .eq("client_id", clientId)
    .maybeSingle()

  return client || null
}

export function verifyClientSecret(rawSecret: string, expectedHash: string | null) {
  if (!expectedHash) return false
  const actual = Buffer.from(hashToken(rawSecret), "hex")
  const expected = Buffer.from(expectedHash, "hex")
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function verifyPkce(codeVerifier: string, codeChallenge: string | null, method: string | null) {
  if (!codeChallenge) return true
  if (!codeVerifier) return false

  if ((method || "plain").toUpperCase() === "S256") {
    const digest = createHash("sha256").update(codeVerifier).digest("base64url")
    return digest === codeChallenge
  }

  return codeVerifier === codeChallenge
}

export function bearerChallenge(requestUrl: URL) {
  const metadataUrl = `${getMcpBaseUrl(requestUrl)}/.well-known/oauth-protected-resource`
  return `Bearer resource_metadata="${metadataUrl}"`
}
