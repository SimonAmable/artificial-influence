import type { Metadata } from "next"

import { McpConnectPage } from "@/components/mcp/mcp-connect-page"
import { getMcpConnectBaseUrl } from "@/lib/mcp/auth"
import { currentProduct, getCurrentProductSiteUrl } from "@/lib/product/current"

export const metadata: Metadata = {
  title: "MCP & CLI Connect",
  description: `Connect ${currentProduct.name} to Claude, ChatGPT, Cursor, and coding agents via MCP. Generate images, videos, and audio from any AI workflow.`,
}

export default function McpPage() {
  const siteUrl = getCurrentProductSiteUrl()

  return (
    <McpConnectPage
      productName={currentProduct.name}
      mcpBaseUrl={getMcpConnectBaseUrl(currentProduct.mcpSiteUrl ?? siteUrl)}
      logoSrc={currentProduct.logo}
    />
  )
}
