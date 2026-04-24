"use client"

import * as React from "react"
import Image from "next/image"
import type { UIMessage } from "ai"
import {
  ArrowSquareOut,
  Clock,
  Database,
  Lightning,
  MagicWand,
  PlayCircle,
  RocketLaunch,
  SkipForward,
} from "@phosphor-icons/react"

import { Message, MessageContent } from "@/components/ai-elements/message"
import { Shimmer } from "@/components/ai-elements/shimmer"
import {
  MessageParts,
  type InstagramConnectionToolSummary,
} from "@/components/chat/creative-agent-chat"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { describeCronHumanSummary } from "@/lib/automations/schedule"
import type { OnboardingLearnAutomation } from "@/lib/onboarding/learn-automation"
import { cn } from "@/lib/utils"

const EMPTY_INSTAGRAM_MAP = new Map<string, InstagramConnectionToolSummary>()

type OnboardingLearnScreenProps = {
  automation: OnboardingLearnAutomation
  onSkip: () => void
  onContinue: () => void
}

function formatDateTime(value: string | null, timezone?: string): string {
  if (!value) return "Not available"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    ...(timezone ? { timeZone: timezone } : {}),
  })
}

function DataPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

export function OnboardingLearnScreen({
  automation,
  onSkip,
  onContinue,
}: OnboardingLearnScreenProps) {
  const [messages, setMessages] = React.useState<UIMessage[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const ac = new AbortController()

    const loadPreview = async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const res = await fetch(`/api/automations/${automation.id}/preview`, {
          signal: ac.signal,
        })
        const json = (await res.json().catch(() => ({}))) as {
          messages?: UIMessage[]
          error?: string
        }

        if (!res.ok) {
          setLoadError(typeof json.error === "string" ? json.error : "Failed to load preview")
          setMessages([])
          return
        }

        setMessages(Array.isArray(json.messages) ? json.messages : [])
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return
        setLoadError(error instanceof Error ? error.message : "Failed to load preview")
        setMessages([])
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    }

    void loadPreview()

    return () => ac.abort()
  }, [automation.id])

  const recordJson = React.useMemo(
    () =>
      JSON.stringify(
        {
          id: automation.id,
          user_id: automation.userId,
          name: automation.name,
          prompt: automation.prompt,
          cron_schedule: automation.cronSchedule,
          timezone: automation.timezone,
          model: automation.model,
          is_active: automation.isActive,
          last_run_at: automation.lastRunAt,
          next_run_at: automation.nextRunAt,
          run_count: automation.runCount,
          last_error: automation.lastError,
          created_at: automation.createdAt,
          updated_at: automation.updatedAt,
          prompt_payload: automation.promptPayload,
          is_public: automation.isPublic,
          preview_captured_at: automation.previewCapturedAt,
          cloned_from: automation.clonedFrom,
          description: automation.description,
          preview_run_id: automation.previewRunId,
        },
        null,
        2,
      ),
    [automation],
  )

  const attachmentPreview = automation.promptPayload.attachments[0] ?? null

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_40%)]" />

      <div className="relative flex min-h-dvh flex-col">
        <div className="border-b border-border/60 bg-background/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1.5">
                  <RocketLaunch className="size-3.5" />
                  Learn by example
                </Badge>
                <Badge variant="outline">Public automation</Badge>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                One real automation before you jump in
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                This full-screen walkthrough shows an actual public automation, the preview run it
                generated, and the record behind it so new users can see what "set it once, let it
                run" looks like in practice.
              </p>
            </div>

            <Button type="button" variant="ghost" size="sm" onClick={onSkip} className="shrink-0">
              <SkipForward className="size-4" />
              Skip
            </Button>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6">
          <div className="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
            <Card className="min-h-[44svh] border-border/70 bg-card/80 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] lg:min-h-0">
              <CardHeader className="border-b border-border/60">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                      <PlayCircle className="size-5 text-primary" weight="duotone" />
                      Preview transcript
                    </CardTitle>
                    <CardDescription className="mt-2 max-w-2xl leading-6">
                      {automation.name}
                      {automation.description ? ` - ${automation.description}` : ""}
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{describeCronHumanSummary(automation.cronSchedule)}</Badge>
                    {automation.model ? <Badge variant="secondary">{automation.model}</Badge> : null}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="min-h-0 flex-1 px-0">
                <ScrollArea className="h-[min(62svh,100%)] px-4 py-4 lg:h-full lg:px-6">
                  {loading ? (
                    <div className="space-y-4">
                      <Shimmer className="text-sm">Loading preview run...</Shimmer>
                      <div className="rounded-2xl border border-border/60 bg-muted/25 p-4 text-sm text-muted-foreground">
                        Pulling the shared preview thread for this public automation.
                      </div>
                    </div>
                  ) : null}

                  {!loading && loadError ? (
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                        {loadError}
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          Prompt fallback
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
                          {automation.promptPayload.text}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {!loading && !loadError && messages.length === 0 ? (
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                      No preview messages were captured for this automation yet.
                    </div>
                  ) : null}

                  {!loading && !loadError && messages.length > 0 ? (
                    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 py-1">
                      {messages.map((message) => {
                        const isUserMessage = message.role === "user"

                        return (
                          <Message
                            key={message.id}
                            from={isUserMessage ? "user" : "assistant"}
                            className={cn(!isUserMessage && "mb-2")}
                          >
                            {isUserMessage ? (
                              <MessageContent className="max-w-[88%] rounded-[24px] px-4 py-3 shadow-sm">
                                <MessageParts
                                  message={message}
                                  instagramConnectionsById={EMPTY_INSTAGRAM_MAP}
                                  onToolApprovalResponse={() => {}}
                                />
                              </MessageContent>
                            ) : (
                              <div className="flex w-full min-w-0 max-w-3xl items-start gap-3">
                                <span className="mt-1 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted/40">
                                  <Image
                                    src="/logo.svg"
                                    alt=""
                                    width={16}
                                    height={16}
                                    className="dark:invert"
                                  />
                                </span>
                                <div className="min-w-0 flex-1 space-y-3 text-left text-[15px] leading-7 text-foreground">
                                  <MessageParts
                                    message={message}
                                    instagramConnectionsById={EMPTY_INSTAGRAM_MAP}
                                    onToolApprovalResponse={() => {}}
                                  />
                                </div>
                              </div>
                            )}
                          </Message>
                        )
                      })}
                    </div>
                  ) : null}
                </ScrollArea>
              </CardContent>
            </Card>

            <Tabs defaultValue="overview" className="min-h-0">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">
                  <Lightning className="size-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="prompt">
                  <MagicWand className="size-4" />
                  Prompt
                </TabsTrigger>
                <TabsTrigger value="json">
                  <Database className="size-4" />
                  Data
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="min-h-0">
                <Card className="border-border/70 bg-card/80 lg:min-h-[44svh] lg:h-full">
                  <CardHeader className="border-b border-border/60">
                    <CardTitle>What this automation is doing</CardTitle>
                    <CardDescription>
                      A public, scheduled workflow with a saved prompt, reference media, and a shareable
                      preview run.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 py-1">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <DataPill label="Schedule" value={describeCronHumanSummary(automation.cronSchedule)} />
                      <DataPill label="Timezone" value={automation.timezone} />
                      <DataPill label="Model" value={automation.model ?? "Default model"} />
                      <DataPill label="Runs completed" value={automation.runCount.toLocaleString()} />
                      <DataPill
                        label="Last run"
                        value={formatDateTime(automation.lastRunAt, automation.timezone)}
                      />
                      <DataPill
                        label="Next run"
                        value={formatDateTime(automation.nextRunAt, automation.timezone)}
                      />
                    </div>

                    {attachmentPreview ? (
                      <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                              Reference attachment
                            </p>
                            <p className="mt-1 text-sm font-medium text-foreground">
                              {attachmentPreview.filename ?? "Reference image"}
                            </p>
                          </div>
                          <Badge variant="outline">{attachmentPreview.mediaType}</Badge>
                        </div>

                        <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
                          <div className="relative aspect-[4/3] w-full">
                            <Image
                              src={attachmentPreview.url}
                              alt={attachmentPreview.filename ?? "Reference attachment"}
                              fill
                              className="object-cover"
                            />
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{automation.isPublic ? "Public" : "Private"}</Badge>
                        {automation.previewRunId ? <Badge variant="secondary">Preview run ready</Badge> : null}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Preview captured {formatDateTime(automation.previewCapturedAt, automation.timezone)}. This
                        record includes the saved prompt payload, the scheduling metadata, and the run snapshot
                        that powers the community preview.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="prompt" className="min-h-0">
                <Card className="border-border/70 bg-card/80 lg:min-h-[44svh] lg:h-full">
                  <CardHeader className="border-b border-border/60">
                    <CardTitle>Prompt payload</CardTitle>
                    <CardDescription>
                      The saved prompt plus any files and references that run every time the automation fires.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="min-h-0 py-1">
                    <ScrollArea className="h-[52svh] lg:h-[calc(100%-0.5rem)]">
                      <div className="space-y-4 px-0 pb-1">
                        <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            Prompt text
                          </p>
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                            {automation.promptPayload.text}
                          </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <DataPill
                            label="Attachments"
                            value={automation.promptPayload.attachments.length.toString()}
                          />
                          <DataPill label="Refs" value={automation.promptPayload.refs.length.toString()} />
                          <DataPill
                            label="Variables"
                            value={(automation.promptPayload.variables?.length ?? 0).toString()}
                          />
                        </div>

                        <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            Payload JSON
                          </p>
                          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-xs leading-6 text-foreground">
                            {JSON.stringify(automation.promptPayload, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="json" className="min-h-0">
                <Card className="border-border/70 bg-card/80 lg:min-h-[44svh] lg:h-full">
                  <CardHeader className="border-b border-border/60">
                    <CardTitle>Automation record</CardTitle>
                    <CardDescription>
                      The exact row shape behind this featured automation, ready for users to inspect.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="min-h-0 py-1">
                    <ScrollArea className="h-[52svh] lg:h-[calc(100%-0.5rem)]">
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-2xl border border-border/70 bg-background/70 p-4 text-xs leading-6 text-foreground">
                        {recordJson}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-4" />
              <span>Preview captured {formatDateTime(automation.previewCapturedAt, automation.timezone)}</span>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" variant="outline" onClick={onSkip}>
                <SkipForward className="size-4" />
                Skip for now
              </Button>
              <Button type="button" size="lg" onClick={onContinue}>
                Continue to chat
                <ArrowSquareOut className="size-4" data-icon="inline-end" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
