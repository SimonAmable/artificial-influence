const DEFAULT_ALLOWED_ORIGINS = [
  "https://chatgpt.com",
  "https://chat.openai.com",
  "https://platform.openai.com",
  "https://claude.ai",
  "https://desktop.claude.ai",
  "http://localhost:6274",
  "http://127.0.0.1:6274",
]

export function isAllowedMcpOrigin(request: Request, requestUrl: URL) {
  const origin = request.headers.get("origin")
  if (!origin) return true

  const configuredOrigins = (process.env.MCP_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
  const allowed = new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins])
  allowed.add(requestUrl.origin)

  return allowed.has(origin)
}
