"use client"

import { CircleNotch } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { GenerateAudioToolPart } from "@/lib/chat/agent-tool-part-types"
import { PromptLengthBadge } from "./badges"

export function AudioGenerationResultCard({
  messageId,
  part,
  onToolApprovalResponse,
}: {
  messageId: string
  part: GenerateAudioToolPart
  onToolApprovalResponse?: (approvalId: string, approved: boolean) => void
}) {
  if (part.state === "input-streaming") {
    return (
      <Card key={messageId} className="border-border/60 bg-muted/20">
        <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <CircleNotch className="h-4 w-4 animate-spin" />
          Preparing audio generation...
        </CardContent>
      </Card>
    )
  }

  if (part.state === "input-available") {
    return (
      <Card key={messageId} className="border-border/60 bg-muted/20">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Audio Generation Tool</p>
              <p className="text-xs text-muted-foreground">Starting text-to-speech generation</p>
            </div>
            <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
          {part.input?.text ? (
            <p className="text-sm leading-6 text-foreground">{part.input.text}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {part.input?.provider ? <Badge variant="outline">{part.input.provider}</Badge> : null}
            {part.input?.modelIdentifier ? <Badge variant="outline">{part.input.modelIdentifier}</Badge> : null}
            {part.input?.voiceId ? <Badge variant="outline">{part.input.voiceId}</Badge> : null}
            {part.input?.languageCode ? <Badge variant="outline">{part.input.languageCode}</Badge> : null}
            <PromptLengthBadge prompt={part.input?.text} />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (part.state === "approval-requested") {
    return (
      <Card key={messageId} className="border-border/60 bg-muted/10">
        <CardContent className="space-y-4 p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Generate this audio?</p>
            <p className="text-xs text-muted-foreground">
              Confirm before spending credits and starting text-to-speech.
            </p>
          </div>
          {part.input?.text ? (
            <p className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border/60 bg-background/80 p-3 text-sm leading-6">
              {part.input.text}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {part.input?.provider ? <Badge variant="outline">{part.input.provider}</Badge> : null}
            {part.input?.modelIdentifier ? <Badge variant="outline">{part.input.modelIdentifier}</Badge> : null}
            {part.input?.voiceId ? <Badge variant="outline">{part.input.voiceId}</Badge> : null}
            {part.input?.languageCode ? <Badge variant="outline">{part.input.languageCode}</Badge> : null}
            <PromptLengthBadge prompt={part.input?.text} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => part.approval?.id && onToolApprovalResponse?.(part.approval.id, true)}
            >
              Generate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => part.approval?.id && onToolApprovalResponse?.(part.approval.id, false)}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (part.state === "approval-responded") {
    return (
      <Card key={messageId} className="border-border/60 bg-muted/20">
        <CardContent className="flex items-center gap-3 p-4">
          <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Processing approval</p>
            <p className="truncate text-xs text-muted-foreground">
              {part.approval?.approved ? "Starting audio generation" : "Canceling audio generation"}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (part.state === "output-denied") {
    return (
      <Card key={messageId} className="border-border/60 bg-muted/10">
        <CardContent className="space-y-2 p-4 text-sm">
          <p className="font-medium">Audio generation canceled</p>
          <p className="text-muted-foreground">No audio job was started.</p>
        </CardContent>
      </Card>
    )
  }

  if (part.state === "output-error") {
    return (
      <Card key={messageId} className="border-destructive/30 bg-destructive/5">
        <CardContent className="space-y-2 p-4 text-sm text-destructive">
          <p className="font-medium">Audio generation failed</p>
          <p>{part.errorText || "Unknown tool error."}</p>
        </CardContent>
      </Card>
    )
  }

  if (part.state === "output-available") {
    return (
      <Card key={messageId} className="border-border/60 bg-muted/10">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Generated Audio</Badge>
            {part.output?.provider ? <Badge variant="outline">{part.output.provider}</Badge> : null}
            {part.output?.model ? <Badge variant="outline">{part.output.model}</Badge> : null}
            {part.output?.voiceDisplayName ? (
              <Badge variant="outline">{part.output.voiceDisplayName}</Badge>
            ) : part.output?.voiceId ? (
              <Badge variant="outline">{part.output.voiceId}</Badge>
            ) : null}
            {part.input?.languageCode ? <Badge variant="outline">{part.input.languageCode}</Badge> : null}
            <PromptLengthBadge prompt={part.input?.text} />
          </div>
          {part.output?.message ? (
            <p className="text-sm text-muted-foreground">{part.output.message}</p>
          ) : null}
          {part.output?.audio?.url ? (
            <audio
              src={part.output.audio.url}
              controls
              className="w-full rounded-xl border border-border/60 bg-background p-2"
            />
          ) : (
            <p className="text-sm text-muted-foreground">No audio URL returned.</p>
          )}
        </CardContent>
      </Card>
    )
  }

  return null
}
