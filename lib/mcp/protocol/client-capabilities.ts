import { UNICAN_MEDIA_WIDGET_MIME_TYPE } from "@/lib/mcp/widget"

export type McpClientUiCapability = {
  mimeTypes: string[]
}

export function parseClientUiCapability(params: unknown): McpClientUiCapability | null {
  if (!params || typeof params !== "object") return null

  const capabilities = (params as { capabilities?: unknown }).capabilities
  if (!capabilities || typeof capabilities !== "object") return null

  const extensions = (capabilities as { extensions?: unknown }).extensions
  if (!extensions || typeof extensions !== "object") return null

  const uiExtension = (extensions as Record<string, unknown>)["io.modelcontextprotocol/ui"]
  if (!uiExtension || typeof uiExtension !== "object") return null

  const mimeTypes = (uiExtension as { mimeTypes?: unknown }).mimeTypes
  if (!Array.isArray(mimeTypes)) return null

  const normalized = mimeTypes.filter((value): value is string => typeof value === "string")
  if (!normalized.includes(UNICAN_MEDIA_WIDGET_MIME_TYPE)) return null

  return { mimeTypes: normalized }
}
