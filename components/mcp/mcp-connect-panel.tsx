"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowSquareOut, Check, Copy, Terminal } from "@phosphor-icons/react"
import { Code2 } from "lucide-react"
import { MCP } from "@lobehub/icons"

import { PlatformLobeIcon } from "@/components/mcp/mcp-platform-icons"
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

export type McpConnectPanelProps = {
  productName: string
  mcpBaseUrl: string
  logoSrc: string
  platform?: McpConnectPlatform
  onPlatformChange?: (platform: McpConnectPlatform) => void
  mode?: McpConnectMode
  onModeChange?: (mode: McpConnectMode) => void
  /** Guide embed uses a lighter shell; full page uses dark marketing chrome. */
  variant?: "page" | "embed"
  showToolsPreview?: boolean
  className?: string
  setupId?: string
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
      <div className="relative mt-auto min-w-0 rounded-2xl border border-white/10 bg-black/50 p-4 pr-12">
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-zinc-300 md:text-[13px]">
          {value}
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Copied" : "Copy to clipboard"}
          className="absolute top-3 right-3 touch-manipulation rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
          <span className="sr-only" aria-live="polite">
            {copied ? "Copied to clipboard" : ""}
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="mt-auto flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-black/50 p-2 pl-3 sm:pl-4">
      <code className="min-w-0 flex-1 truncate font-mono text-sm text-primary">
        {value}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy to clipboard"}
        className="shrink-0 touch-manipulation rounded-lg p-2.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
      >
        {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
        <span className="sr-only" aria-live="polite">
          {copied ? "Copied to clipboard" : ""}
        </span>
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
    <div className="flex min-h-full min-w-0 flex-col gap-3">
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

export function McpConnectPanel({
  productName,
  mcpBaseUrl,
  logoSrc,
  platform: platformProp,
  onPlatformChange,
  mode: modeProp,
  onModeChange,
  variant = "page",
  showToolsPreview = true,
  className,
  setupId = "mcp-setup",
}: McpConnectPanelProps) {
  const [internalMode, setInternalMode] = React.useState<McpConnectMode>("mcp")
  const [internalPlatform, setInternalPlatform] = React.useState<McpConnectPlatform>("claude")

  const mode = modeProp ?? internalMode
  const platform = platformProp ?? internalPlatform
  const setMode = onModeChange ?? setInternalMode
  const setPlatform = onPlatformChange ?? setInternalPlatform

  const platformsForMode = React.useMemo(() => getPlatformsForMode(mode), [mode])

  React.useEffect(() => {
    if (!platformsForMode.some((item) => item.id === platform)) {
      const next = getDefaultPlatformForMode(mode)
      if (onPlatformChange) {
        onPlatformChange(next)
      } else {
        setInternalPlatform(next)
      }
    }
  }, [mode, platform, platformsForMode, onPlatformChange])

  const steps = getMcpConnectSteps({ mode, platform, productName, mcpBaseUrl })
  const mcpEndpoint = buildMcpEndpointUrl(mcpBaseUrl)
  const isAgentLayout = steps.length === 2 && Boolean(steps[0]?.copyMultiline)
  const cliDisabled = true
  const isEmbed = variant === "embed"

  const shellClass = isEmbed
    ? "min-w-0 rounded-2xl border border-border/70 bg-[#141414] p-3 text-white shadow-md sm:p-4 md:rounded-[1.75rem] md:p-5"
    : "mx-auto max-w-6xl rounded-[1.75rem] border border-white/10 bg-[#141414] p-4 shadow-md md:p-5"

  return (
    <div className={cn("flex min-w-0 flex-col gap-10", className)}>
      <section id={setupId} className={isEmbed ? undefined : "px-4 pb-10 md:px-6"}>
        <div className={shellClass}>
          <div className="mb-5 flex min-w-0 flex-col gap-3 border-b border-white/8 pb-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="-mx-1 min-w-0 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
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
                className="w-max flex-nowrap justify-start"
                aria-label="AI platform"
              >
                {MCP_PLATFORMS.map((item) => (
                  <ToggleGroupItem
                    key={item.id}
                    value={item.id}
                    aria-label={item.label}
                    className="shrink-0 touch-manipulation gap-1.5 px-3"
                  >
                    <PlatformLobeIcon platform={item.id} size={15} />
                    {item.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

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
              className="self-start xl:self-auto"
              aria-label="Connection mode"
            >
              <ToggleGroupItem value="mcp" aria-label="MCP" className="touch-manipulation gap-1.5 px-3">
                <MCP size={14} />
                MCP
              </ToggleGroupItem>
              <ToggleGroupItem
                value="cli"
                aria-label="CLI"
                disabled={cliDisabled}
                title="CLI support coming soon"
                className="touch-manipulation gap-1.5 px-3"
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
                isAgentLayout ? "xl:grid-cols-2" : "xl:grid-cols-3",
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

      {showToolsPreview ? (
        <section className={isEmbed ? undefined : "px-4 py-10 md:px-6"}>
          <div className={isEmbed ? undefined : "mx-auto max-w-6xl"}>
            <div className="mb-6 text-center">
              <p className="text-xs font-medium tracking-[0.2em] text-zinc-500 uppercase">
                Available tools
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-wide text-white uppercase">
                What you can do once connected
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-400">
                OAuth-secured access to your {productName} account. Endpoint:{" "}
                <span className="break-all font-mono text-primary">{mcpEndpoint}</span>
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
      ) : null}
    </div>
  )
}
