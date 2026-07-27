"use client"

import * as React from "react"

import { McpConnectPanel } from "@/components/mcp/mcp-connect-panel"
import { McpIconFan } from "@/components/mcp/mcp-icon-fan"
import { Footer } from "@/components/landing/footer"
import type { McpConnectPlatform } from "@/lib/constants/mcp-connect"

type McpConnectPageProps = {
  productName: string
  mcpBaseUrl: string
  logoSrc: string
}

export function McpConnectPage({ productName, mcpBaseUrl, logoSrc }: McpConnectPageProps) {
  const [platform, setPlatform] = React.useState<McpConnectPlatform>("claude")

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <section className="relative overflow-hidden px-4 pb-8 pt-24 md:px-6 md:pb-10 md:pt-28">
        <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
          <McpIconFan
            productName={productName}
            logoSrc={logoSrc}
            activePlatform={platform}
            onPlatformSelect={(next) => {
              setPlatform(next)
            }}
          />

          <h1 className="mt-8 font-display text-3xl font-bold tracking-[0.04em] text-primary uppercase md:text-5xl md:tracking-[0.06em]">
            {productName}
            {" "}
            MCP & CLI for any AI
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-300 md:text-lg">
            Create images and videos directly from your prompts in any AI tool
          </p>
        </div>
      </section>

      <McpConnectPanel
        productName={productName}
        mcpBaseUrl={mcpBaseUrl}
        logoSrc={logoSrc}
        platform={platform}
        onPlatformChange={setPlatform}
        variant="page"
      />

      <Footer />
    </div>
  )
}
