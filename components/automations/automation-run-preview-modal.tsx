"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import type { UIMessage } from "ai"
import { Loader2 } from "lucide-react"

import { Message, MessageContent } from "@/components/ai-elements/message"
import { Shimmer } from "@/components/ai-elements/shimmer"
import {
  MessageParts,
  type InstagramConnectionToolSummary,
} from "@/components/chat/creative-agent-chat"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const EMPTY_INSTAGRAM_MAP = new Map<string, InstagramConnectionToolSummary>()

const POLL_MS = 1500
const MAX_POLLS = 200

type RunRow = {
  id: string
  automation_id: string
  thread_id: string | null
  status: "running" | "completed" | "failed"
  started_at: string
  finished_at: string | null
  error: string | null
  created_at: string
  run_trigger?: "manual" | "scheduled"
}

export type AutomationRunPreviewModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  automationId: string
  automationName: string
  runId: string
  initialThreadId?: string | null
  initialStatus?: "running" | "completed" | "failed"
  /** Shown while run is in progress (thread transcript may not exist until completion). */
  promptPreview?: string | null
  runTrigger?: "manual" | "scheduled"
  initialRunError?: string | null
}

function firstUserTextPreview(messages: UIMessage[]): string | null {
  const u = messages.find((m) => m.role === "user")
  if (!u?.parts) return null
  const text = u.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
  const trimmed = text.trim()
  if (!trimmed) return null
  return trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed
}

async function fetchThreadMessages(threadId: string, signal: AbortSignal): Promise<UIMessage[]> {
  const res = await fetch(`/api/chat/threads/${threadId}`, { signal })
  const j = (await res.json().catch(() => ({}))) as { thread?: { messages?: UIMessage[] }; error?: string }
  if (!res.ok) {
    throw new Error(typeof j?.error === "string" ? j.error : "Failed to load thread")
  }
  return Array.isArray(j.thread?.messages) ? j.thread!.messages! : []
}

export function AutomationRunPreviewModal({
  open,
  onOpenChange,
  automationId,
  automationName,
  runId,
  initialThreadId = null,
  initialStatus = "running",
  promptPreview: promptPreviewProp = null,
  runTrigger = "scheduled",
  initialRunError = null,
}: AutomationRunPreviewModalProps) {
  const [runStatus, setRunStatus] = React.useState<RunRow["status"]>(initialStatus)
  const [threadId, setThreadId] = React.useState<string | null>(initialThreadId)
  const [runError, setRunError] = React.useState<string | null>(null)
  const [messages, setMessages] = React.useState<UIMessage[]>([])
  const [loadingThread, setLoadingThread] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [userPromptPreview, setUserPromptPreview] = React.useState<string | null>(null)
  const [pollExhausted, setPollExhausted] = React.useState(false)

  const abortRef = React.useRef<AbortController | null>(null)

  const effectivePromptPreview = userPromptPreview ?? promptPreviewProp

  React.useEffect(() => {
    if (!open) {
      abortRef.current?.abort()
      abortRef.current = null
      return
    }
    setRunStatus(initialStatus)
    setThreadId(initialThreadId)
    setRunError(initialRunError)
    setMessages([])
    setLoadError(null)
    setUserPromptPreview(null)
    setPollExhausted(false)
  }, [open, runId, initialThreadId, initialStatus, initialRunError])

  React.useEffect(() => {
    if (!open || !runId) return

    const ac = new AbortController()
    abortRef.current = ac
    const { signal } = ac

    let cancelled = false
    let pollCount = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    const loadMessagesForThread = async (tid: string) => {
      setLoadingThread(true)
      setLoadError(null)
      try {
        const msgs = await fetchThreadMessages(tid, signal)
        if (cancelled) return
        setMessages(msgs)
        const preview = firstUserTextPreview(msgs)
        if (preview) setUserPromptPreview(preview)
      } catch (e) {
        if (cancelled || (e instanceof Error && e.name === "AbortError")) return
        setLoadError(e instanceof Error ? e.message : "Failed to load messages")
      } finally {
        if (!cancelled) setLoadingThread(false)
      }
    }

    const pollOnce = async (): Promise<boolean> => {
      const res = await fetch(`/api/automations/${automationId}/runs/${runId}`, { signal })
      const j = (await res.json().catch(() => ({}))) as { run?: RunRow; error?: string }
      if (res.status === 401 || res.status === 404) {
        setLoadError(typeof j?.error === "string" ? j.error : "Run not found")
        return false
      }
      if (!res.ok) {
        setLoadError(typeof j?.error === "string" ? j.error : "Failed to load run status")
        return false
      }
      const row = j.run
      if (!row) {
        setLoadError("Run not found")
        return false
      }
      setRunStatus(row.status)
      setThreadId(row.thread_id)
      setRunError(row.error)

      if (row.status === "completed" && row.thread_id) {
        await loadMessagesForThread(row.thread_id)
        return false
      }
      if (row.status === "failed") {
        return false
      }
      return row.status === "running"
    }

    void (async () => {
      if (initialStatus === "completed" && initialThreadId) {
        await loadMessagesForThread(initialThreadId)
        return
      }
      if (initialStatus === "completed" && !initialThreadId) {
        await pollOnce()
        return
      }
      if (initialStatus === "failed") {
        return
      }

      const keepPolling = await pollOnce()
      if (!keepPolling || cancelled) return

      const schedule = () => {
        if (cancelled) return
        pollCount += 1
        if (pollCount > MAX_POLLS) {
          setPollExhausted(true)
          return
        }
        timer = setTimeout(async () => {
          const cont = await pollOnce()
          if (cont && !cancelled) schedule()
        }, POLL_MS)
      }
      schedule()
    })()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      ac.abort()
    }
  }, [open, runId, automationId, initialStatus, initialThreadId])

  const triggerLabel = runTrigger === "manual" ? "Manual" : "Scheduled"

  const statusBadge = (
    <Badge
      variant={
        runStatus === "completed" ? "default" : runStatus === "failed" ? "destructive" : "secondary"
      }
      className="text-xs"
    >
      {runStatus}
    </Badge>
  )

  const showRunningUi = runStatus === "running" && !pollExhausted
  const showTranscript = runStatus === "completed" && messages.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] min-h-0 max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 py-4 text-left">
          <DialogTitle className="pr-8">Run preview</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="font-medium text-foreground">{automationName}</span>
              {statusBadge}
              <Badge variant="outline" className="text-[10px]">
                {triggerLabel}
              </Badge>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          <div className="px-4 py-4">
            {pollExhausted ? (
              <p className="text-sm text-muted-foreground">
                Still running — open the thread from Recent runs when it finishes, or try again later.
              </p>
            ) : null}

            {showRunningUi ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Automation is running…</span>
                </div>
                {effectivePromptPreview ? (
                  <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                    <p className="text-xs font-medium text-muted-foreground">Prompt</p>
                    <p className="mt-1 whitespace-pre-wrap text-foreground">{effectivePromptPreview}</p>
                  </div>
                ) : (
                  <Shimmer className="text-sm">Waiting for assistant response…</Shimmer>
                )}
              </div>
            ) : null}

            {runStatus === "failed" ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {runError || "Run failed"}
              </div>
            ) : null}

            {loadError ? (
              <p className="text-sm text-destructive">{loadError}</p>
            ) : null}

            {loadingThread && runStatus === "completed" && messages.length === 0 && !loadError ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading transcript…
              </div>
            ) : null}

            {showTranscript ? (
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-1 py-2">
                {messages.map((message) => {
                  const isUserMessage = message.role === "user"
                  return (
                    <Message
                      key={message.id}
                      from={isUserMessage ? "user" : "assistant"}
                      className={cn(!isUserMessage && "mb-2")}
                    >
                      {isUserMessage ? (
                        <MessageContent className="max-w-[85%] rounded-[24px] px-4 py-3 shadow-sm">
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

            {runStatus === "completed" && !loadingThread && messages.length === 0 && !loadError ? (
              <p className="text-sm text-muted-foreground">No messages in this thread yet.</p>
            ) : null}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border/60 px-6 py-3 sm:justify-between">
          {threadId ? (
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={`/chat/${threadId}`} target="_blank" rel="noopener noreferrer">
                Open full thread
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
