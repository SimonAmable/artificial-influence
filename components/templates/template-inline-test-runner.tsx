"use client"

import * as React from "react"
import { Chat, useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { CheckCircle, CircleNotch, WarningCircle } from "@phosphor-icons/react"
import { analyzeChatHistoryForTemplate } from "@/lib/chat/analyze-chat-history"
import { DEFAULT_CHAT_GATEWAY_MODEL } from "@/lib/constants/chat-llm-models"
import type { ThumbnailKind } from "@/lib/templates/types"
import { Button } from "@/components/ui/button"
import { TemplatePreviewMedia } from "@/components/templates/template-preview-media"

export interface TemplateInlineTestStart {
  threadId: string
  templateSlug: string
  openingMessage: UIMessage
  inputValues: Record<string, unknown>
}

export interface TemplateInlineTestResult {
  threadId: string
  outputUrl: string | null
  outputKind: ThumbnailKind
  outputType: "image" | "video" | "audio" | "slideshow" | "mixed"
  credits: number
  inputValues: Record<string, unknown>
}

interface TemplateInlineTestRunnerProps {
  start: TemplateInlineTestStart
  onComplete: (result: TemplateInlineTestResult) => void
  onReset: () => void
}

export function TemplateInlineTestRunner({
  start,
  onComplete,
  onReset,
}: TemplateInlineTestRunnerProps) {
  const didSendRef = React.useRef(false)
  const didCompleteRef = React.useRef(false)
  const sawRunningRef = React.useRef(false)

  const chat = React.useMemo(
    () =>
      new Chat({
        id: `template-test-${start.threadId}`,
        messages: [],
        transport: new DefaultChatTransport({
          api: "/api/chat",
          prepareSendMessagesRequest: ({ messages }) => ({
            body: {
              message: messages[messages.length - 1],
              generationApprovalMode: "auto",
              mode: "chat",
              model: DEFAULT_CHAT_GATEWAY_MODEL,
              pagePath: "/templates",
              threadId: start.threadId,
            },
          }),
        }),
      }),
    [start.threadId],
  )

  const { messages, sendMessage, status, error } = useChat({
    chat,
    experimental_throttle: 50,
  })

  const analysis = React.useMemo(
    () => analyzeChatHistoryForTemplate(messages),
    [messages],
  )

  React.useEffect(() => {
    if (didSendRef.current) return
    didSendRef.current = true
    void sendMessage({
      role: start.openingMessage.role,
      parts: start.openingMessage.parts,
    })
  }, [sendMessage, start.openingMessage.parts, start.openingMessage.role])

  React.useEffect(() => {
    if (status === "submitted" || status === "streaming") {
      sawRunningRef.current = true
      return
    }
    if (!sawRunningRef.current || didCompleteRef.current || status !== "ready") return

    didCompleteRef.current = true
    onComplete({
      threadId: start.threadId,
      outputUrl: analysis.thumbnailUrl,
      outputKind: analysis.thumbnailKind,
      outputType: analysis.outputKind,
      credits: analysis.creditsTotal,
      inputValues: start.inputValues,
    })
  }, [analysis, onComplete, start.inputValues, start.threadId, status])

  if (error) {
    return (
      <div className="space-y-4 rounded-2xl border bg-background p-6 text-center shadow-sm">
        <WarningCircle className="mx-auto size-8 text-destructive" weight="fill" />
        <div className="space-y-1">
          <p className="font-medium">The test could not finish</p>
          <p className="text-sm text-muted-foreground">
            Your draft is safe. Try again or open the run to review what happened.
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <Button variant="outline" asChild>
            <a href={`/chat/${start.threadId}`} target="_blank" rel="noreferrer">
              Open run
            </a>
          </Button>
          <Button onClick={onReset}>Try again</Button>
        </div>
      </div>
    )
  }

  if (status === "submitted" || status === "streaming" || !sawRunningRef.current) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border bg-background p-8 text-center shadow-sm">
        <CircleNotch className="mb-4 size-8 animate-spin text-primary" weight="bold" />
        <p className="font-medium">Testing your template</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          The result and exact credit cost will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-background p-4 shadow-sm">
      {analysis.thumbnailUrl ? (
        <div className="aspect-[3/4] overflow-hidden rounded-xl bg-muted">
          <TemplatePreviewMedia
            afterUrl={analysis.thumbnailUrl}
            afterKind={analysis.thumbnailKind}
            alt="Template test result"
          />
        </div>
      ) : (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-xl bg-muted/40 p-6 text-center">
          <WarningCircle className="mb-3 size-7 text-muted-foreground" />
          <p className="font-medium">No finished media was detected</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Open the run to inspect the result, then test again.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="size-5 text-primary" weight="fill" />
          <div>
            <p className="text-sm font-medium">Test complete</p>
            <p className="text-xs text-muted-foreground">
              {analysis.creditsTotal > 0
                ? `${analysis.creditsTotal} credits used`
                : "No generation cost detected"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onReset}>
            Test again
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`/chat/${start.threadId}`} target="_blank" rel="noreferrer">
              Details
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}
