"use client"

import * as React from "react"

import { McpConnectPanel } from "@/components/mcp/mcp-connect-panel"
import { McpIconFan } from "@/components/mcp/mcp-icon-fan"
import type { McpConnectPlatform } from "@/lib/constants/mcp-connect"

type GuideMcpFanProps = {
  productName: string
  logoSrc: string
}

type GuideMcpConnectEmbedProps = {
  productName: string
  mcpBaseUrl: string
  logoSrc: string
  showToolsPreview?: boolean
}

const GuideMcpPlatformContext = React.createContext<{
  platform: McpConnectPlatform
  setPlatform: (platform: McpConnectPlatform) => void
} | null>(null)

function useGuideMcpPlatform() {
  const context = React.useContext(GuideMcpPlatformContext)
  if (!context) {
    throw new Error("Guide MCP components must be used within GuideMcpPlatformProvider")
  }
  return context
}

export function GuideMcpPlatformProvider({ children }: { children: React.ReactNode }) {
  const [platform, setPlatform] = React.useState<McpConnectPlatform>("claude")

  const value = React.useMemo(
    () => ({ platform, setPlatform }),
    [platform],
  )

  return (
    <GuideMcpPlatformContext.Provider value={value}>
      {children}
    </GuideMcpPlatformContext.Provider>
  )
}

export function GuideMcpFan({ productName, logoSrc }: GuideMcpFanProps) {
  const { platform, setPlatform } = useGuideMcpPlatform()

  return (
    <div className="relative -mx-4 flex justify-center overflow-hidden rounded-2xl bg-[#0a0a0a] px-4 py-10 sm:-mx-6 sm:px-6 md:py-12">
      <McpIconFan
        productName={productName}
        logoSrc={logoSrc}
        activePlatform={platform}
        onPlatformSelect={setPlatform}
      />
    </div>
  )
}

export function GuideMcpConnectEmbed({
  productName,
  mcpBaseUrl,
  logoSrc,
  showToolsPreview = true,
}: GuideMcpConnectEmbedProps) {
  const { platform, setPlatform } = useGuideMcpPlatform()

  return (
    <div className="w-full min-w-0">
      <div className="min-w-0">
        <p className="mb-4 text-sm leading-6 text-muted-foreground">
          Pick your AI tool, copy the connector steps, and sign in once. OAuth ties the external
          agent to your account and credits — same balance as the studio.
        </p>
        <McpConnectPanel
          productName={productName}
          mcpBaseUrl={mcpBaseUrl}
          logoSrc={logoSrc}
          platform={platform}
          onPlatformChange={setPlatform}
          variant="embed"
          showToolsPreview={showToolsPreview}
        />
      </div>
    </div>
  )
}
