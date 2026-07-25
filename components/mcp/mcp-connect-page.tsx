"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowSquareOut, Check, Copy, Terminal } from "@phosphor-icons/react"
import { Code2 } from "lucide-react"
import { MCP } from "@lobehub/icons"

import { McpIconFan } from "@/components/mcp/mcp-icon-fan"
import { PlatformLobeIcon } from "@/components/mcp/mcp-platform-icons"
import { Footer } from "@/components/landing/footer"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  buildMcpEndpointUrl,
  getDefaultPlatformForMode,
  getMcpConnectSteps,
  getPlatformsForMode,
  MCP_PLATFORMS,
  MCP_TOOLS_PREVIEW,
  type McpConnectMode,
  type McpConnectPlatform,
  type McpConnectStep,
} from "@/lib/constants/mcp-connect"
import { cn } from "@/lib/utils"

type McpConnectPageProps = {
  productName: string
  mcpBaseUrl: string
  logoSrc: string
}

function CopyControl({
  value,
  multiline = false,
}: {
  value: string
  multiline?: boolean
}) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [value])

  if (multiline) {
    return (
      <div className="relative mt-auto rounded-2xl border border-white/10 bg-black/50 p-4 pr-12">
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-zinc-300 md:text-[13px]">
          {value}
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Copied" : "Copy to clipboard"}
          className="absolute top-3 right-3 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-black/50 p-2 pl-4">
      <code className="min-w-0 flex-1 truncate font-mono text-sm text-primary">
        {value}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy to clipboard"}
        className="shrink-0 rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
      >
        {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
      </button>
    </div>
  )
}

function StepColumn({
  step,
  index,
  logoSrc,
  platform,
}: {
  step: McpConnectStep
  index: number
  logoSrc: string
  platform: McpConnectPlatform
}) {
  return (
    <div className="flex min-h-full flex-col gap-3">
      <span className="flex size-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-zinc-300">
        {index + 1}
      </span>
      <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold tracking-tight text-white normal-case">
        {step.showBrandInTitle ? (
          <>
            <span>Copy the</span>
            <Image src={logoSrc} alt="" width={18} height={18} className="size-[18px] rounded-sm" />
            <span>connector URL</span>
          </>
        ) : (
          step.title
        )}
      </h3>
      <p className="text-sm leading-relaxed text-zinc-400">{step.description}</p>

      {step.copyValue ? (
        <CopyControl value={step.copyValue} multiline={step.copyMultiline} />
      ) : null}

      {step.actionHref && step.actionLabel ? (
        step.actionExternal ? (
          <Button
            asChild
            variant="outline"
            className="mt-auto h-11 w-full rounded-xl border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            <a href={step.actionHref} target="_blank" rel="noopener noreferrer">
              {step.actionLabel}
              <ArrowSquareOut className="size-4" />
            </a>
          </Button>
        ) : (
          <Button
            asChild
            className={cn(
              "mt-auto h-11 w-full rounded-xl text-sm font-semibold",
              step.actionAccent
                ? "border-0 bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-white text-black hover:bg-zinc-200",
            )}
          >
            <Link href={step.actionHref}>
              {step.actionAccent ? <PlatformLobeIcon platform={platform} size={16} /> : null}
              {step.actionLabel}
            </Link>
          </Button>
        )
      ) : null}
    </div>
  )
}

export function McpConnectPage({ productName, mcpBaseUrl, logoSrc }: McpConnectPageProps) {
  const [mode, setMode] = React.useState<McpConnectMode>("mcp")
  const [platform, setPlatform] = React.useState<McpConnectPlatform>("claude")

  const platformsForMode = React.useMemo(() => getPlatformsForMode(mode), [mode])

  React.useEffect(() => {
    if (!platformsForMode.some((item) => item.id === platform)) {
      setPlatform(getDefaultPlatformForMode(mode))
    }
  }, [mode, platform, platformsForMode])

  const steps = getMcpConnectSteps({ mode, platform, productName, mcpBaseUrl })
  const mcpEndpoint = buildMcpEndpointUrl(mcpBaseUrl)
  const isAgentLayout = steps.length === 2 && Boolean(steps[0]?.copyMultiline)
  const cliDisabled = true

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <section className="relative overflow-hidden px-4 pb-8 pt-24 md:px-6 md:pb-10 md:pt-28">
        <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
          <McpIconFan
            productName={productName}
            logoSrc={logoSrc}
            activePlatform={platform}
            onPlatformSelect={(next) => {
              setMode("mcp")
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

      <section id="mcp-setup" className="px-4 pb-10 md:px-6">
        <div className="mx-auto max-w-6xl rounded-[1.75rem] border border-white/10 bg-[#141414] p-4 shadow-md md:p-5">
          <div className="mb-5 flex flex-col gap-3 border-b border-white/8 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <ToggleGroup
              type="single"
              value={mode === "mcp" ? platform : undefined}
              onValueChange={(value) => {
                if (!value) return
                setMode("mcp")
                setPlatform(value as McpConnectPlatform)
              }}
              variant="outline"
              size="sm"
              spacing={0}
              className="flex-wrap justify-start"
              aria-label="AI platform"
            >
              {MCP_PLATFORMS.map((item) => (
                <ToggleGroupItem
                  key={item.id}
                  value={item.id}
                  aria-label={item.label}
                  className="gap-1.5 px-3"
                >
                  <PlatformLobeIcon platform={item.id} size={15} />
                  {item.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(value) => {
                if (value === "mcp" || value === "cli") {
                  setMode(value)
                }
              }}
              variant="outline"
              size="sm"
              spacing={0}
              aria-label="Connection mode"
            >
              <ToggleGroupItem value="mcp" aria-label="MCP" className="gap-1.5 px-3">
                <MCP size={14} />
                MCP
              </ToggleGroupItem>
              <ToggleGroupItem
                value="cli"
                aria-label="CLI"
                disabled={cliDisabled}
                title="CLI support coming soon"
                className="gap-1.5 px-3"
              >
                <Code2 className="size-3.5" />
                CLI
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {mode === "cli" ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/15 bg-black/30 px-6 py-14 text-center">
              <Terminal className="size-8 text-zinc-500" />
              <div>
                <p className="text-base font-semibold text-white">CLI support coming soon</p>
                <p className="mt-2 max-w-md text-sm text-zinc-400">
                  MCP is ready today for every tab above. CLI installers land next.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => setMode("mcp")}
                className="rounded-xl bg-white text-black hover:bg-zinc-200"
              >
                Back to MCP
              </Button>
            </div>
          ) : (
            <div
              className={cn(
                "grid gap-8 md:gap-6",
                isAgentLayout ? "md:grid-cols-2" : "md:grid-cols-3",
              )}
            >
              {steps.map((step, index) => (
                <StepColumn
                  key={`${mode}-${platform}-${step.title}`}
                  step={step}
                  index={index}
                  logoSrc={logoSrc}
                  platform={platform}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="px-4 py-10 md:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 text-center">
            <p className="text-xs font-medium tracking-[0.2em] text-zinc-500 uppercase">
              Available tools
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-wide text-white uppercase">
              What you can do once connected
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-400">
              OAuth-secured access to your {productName} account. Endpoint:{" "}
              <span className="font-mono text-primary">{mcpEndpoint}</span>
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {MCP_TOOLS_PREVIEW.map((tool) => (
              <span
                key={tool}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-xs text-zinc-400"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
