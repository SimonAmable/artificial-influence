export const MCP_OAUTH_RETURN_COOKIE = "mcp_oauth_return"

export function isMcpOAuthContinuationPath(path: string) {
  return path === "/oauth/resume" || path.startsWith("/oauth/authorize")
}
