"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowSquareOut,
  ChatCircle,
  Code,
  CursorClick,
  Sparkle,
  Terminal,
} from "@phosphor-icons/react"

import { CopyField } from "@/components/mcp/copy-field"
import { Footer } from "@/components/landing/footer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  buildMcpEndpointUrl,
  getDefaultPlatformForMode,
  getMcpConnectSteps,
  getPlatformsForMode,
  MCP_TOOLS_PREVIEW,
  type McpConnectMode,
  type McpConnectPlatform,
} from "@/lib/constants/mcp-connect"
import { cn } from "@/lib/utils"

type McpConnectPageProps = {
  productName: string
  siteUrl: string
  logoSrc: string
}

const PLATFORM_ICONS: Record<McpConnectPlatform, React.ReactNode> = {
  claude: <Sparkle className="size-3.5" weight="fill" />,
  chatgpt: <ChatCircle className="size-3.5" weight="fill" />,
  cursor: <CursorClick className="size-3.5" weight="fill" />,
  codex: <Code className="size-3.5" weight="fill" />,
}

function StepCard({
  step,
  index,
}: {
  step: ReturnType<typeof getMcpConnectSteps>[number]
  index: number
}) {
  return (
    <div className="flex min-h-full flex-col rounded-3xl border border-border/60 bg-card/70 p-5 md:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background text-sm font-semibold text-foreground">
          {index + 1}
        </span>
        <h3 className="font-display text-base font-semibold tracking-wide text-foreground uppercase">
          {step.title}
        </h3>
      </div>
      <p className="mb-5 flex-1 text-sm leading-relaxed text-muted-foreground">
        {step.description}
      </p>
      {step.copyValue ? (
        <CopyField
          value={step.copyValue}
          mono={!step.copyValue.trim().startsWith("{")}
          className="mt-auto"
        />
      ) : null}
      {step.actionHref && step.actionLabel ? (
        <Button asChild className="mt-4 w-full rounded-2xl">
          <Link href={step.actionHref}>
            {step.actionLabel}
            <ArrowSquareOut className="size-4" />
          </Link>
        </Button>
      ) : null}
      {step.promptExample ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-background/50 px-4 py-3 text-sm text-muted-foreground">
          <span className="text-foreground/70">Try: </span>
          &ldquo;{step.promptExample}&rdquo;
        </div>
      ) : null}
    </div>
  )
}

export function McpConnectPage({ productName, siteUrl, logoSrc }: McpConnectPageProps) {
  const [mode, setMode] = React.useState<McpConnectMode>("mcp")
  const [platform, setPlatform] = React.useState<McpConnectPlatform>("claude")

  const platformsForMode = React.useMemo(() => getPlatformsForMode(mode), [mode])

  React.useEffect(() => {
    if (!platformsForMode.some((item) => item.id === platform)) {
      setPlatform(getDefaultPlatformForMode(mode))
    }
  }, [mode, platform, platformsForMode])

  const steps = getMcpConnectSteps({ mode, platform, productName, siteUrl })
  const mcpEndpoint = buildMcpEndpointUrl(siteUrl)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden px-4 pb-10 pt-24 md:px-6 md:pb-14 md:pt-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_top,oklch(0.58_0.28_351.4/0.18),transparent_55%)] dark:bg-[radial-gradient(circle_at_top,oklch(0.65_0.25_351.4/0.22),transparent_55%)]"
        />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
          <div className="mb-8 flex items-center justify-center">
            <div className="relative flex h-20 w-44 items-center justify-center">
              <div className="absolute -left-6 top-2 flex size-11 rotate-[-12deg] items-center justify-center rounded-2xl border border-border/60 bg-card shadow-md">
                <Sparkle className="size-5 text-orange-400" weight="fill" />
              </div>
              <div className="absolute -right-6 top-1 flex size-11 rotate-[10deg] items-center justify-center rounded-2xl border border-border/60 bg-card shadow-md">
                <ChatCircle className="size-5 text-emerald-400" weight="fill" />
              </div>
              <div className="absolute -left-1 bottom-0 flex size-10 rotate-[-6deg] items-center justify-center rounded-2xl border border-border/60 bg-card shadow-md">
                <CursorClick className="size-4 text-sky-400" weight="fill" />
              </div>
              <div className="relative z-10 flex size-16 items-center justify-center rounded-3xl border border-primary/30 bg-primary/10 shadow-[0_0_40px_oklch(0.58_0.28_351.4/0.25)]">
                <Image src={logoSrc} alt={productName} width={36} height={36} className="size-9" />
              </div>
            </div>
          </div>

          <p className="mb-3 text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Model Context Protocol
          </p>
          <h1 className="font-display text-3xl font-bold tracking-wide text-foreground uppercase md:text-5xl">
            {productName} MCP for any AI
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Connect {productName} to your workflow and generate images, videos, and audio directly
            from Claude, ChatGPT, Cursor, and coding agents.
          </p>

          <Button asChild size="lg" className="mt-8 h-12 rounded-full px-6 text-base">
            <Link href="/login?mode=signup">
              Connect MCP &amp; start free
              <Badge variant="secondary" className="ml-2 bg-primary/15 text-primary">
                Free trial
              </Badge>
            </Link>
          </Button>
        </div>
      </section>

      <section className="px-4 pb-8 md:px-6">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-border/60 bg-card/50 p-4 shadow-[var(--shadow-l)] md:p-6">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex w-fit rounded-full border border-border/70 bg-background/80 p-1">
              {(
                [
                  { id: "mcp" as const, label: "MCP", icon: Terminal },
                  { id: "cli" as const, label: "CLI", icon: Code },
                ] as const
              ).map((item) => {
                const Icon = item.icon
                const active = mode === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMode(item.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" weight={active ? "fill" : "regular"} />
                    {item.label}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              {platformsForMode.map((item) => {
                const active = platform === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPlatform(item.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "border-primary/40 bg-primary text-primary-foreground"
                        : "border-border/70 bg-background/60 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {PLATFORM_ICONS[item.id]}
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <StepCard
                key={`${mode}-${platform}-${step.title}`}
                step={step}
                index={index}
              />
            ))}
          </div>

          <div className="mt-6 flex justify-center">
            <p className="rounded-full border border-border/60 bg-background/70 px-4 py-2 text-center text-sm text-muted-foreground">
              {mode === "mcp" ? (
                <>
                  Using Claude Code, Codex, or Cursor terminal? It&apos;s quicker from the CLI.{" "}
                  <button
                    type="button"
                    onClick={() => setMode("cli")}
                    className="font-medium text-primary hover:underline"
                  >
                    Use the CLI tab
                  </button>
                </>
              ) : (
                <>
                  Prefer a chat connector UI? Switch back to{" "}
                  <button
                    type="button"
                    onClick={() => setMode("mcp")}
                    className="font-medium text-primary hover:underline"
                  >
                    MCP setup
                  </button>
                  .
                </>
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 md:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 text-center">
            <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
              Available tools
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-wide uppercase">
              What you can do once connected
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
              OAuth-secured access to your {productName} account. Endpoint:{" "}
              <span className="font-mono text-primary">{mcpEndpoint}</span>
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {MCP_TOOLS_PREVIEW.map((tool) => (
              <span
                key={tool}
                className="rounded-full border border-border/70 bg-card/70 px-3 py-1.5 font-mono text-xs text-muted-foreground"
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
