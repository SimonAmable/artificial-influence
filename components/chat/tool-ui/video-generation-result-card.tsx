"use client"

import * as React from "react"
import { CircleNotch } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { GenerateVideoToolPart } from "@/lib/chat/agent-tool-part-types"
import { useVideoGenerationPoll } from "@/hooks/use-generation-status"
import { cn } from "@/lib/utils"
function VideoToolPromptPopover({
  label,
  body,
  maxLabelWidthClass = "max-w-[min(100%,16rem)]",
}: {
  label: React.ReactNode
  body: React.ReactNode
  maxLabelWidthClass?: string
}) {
  const [open, setOpen] = React.useState(false)
  const pinnedRef = React.useRef(false)
  const leaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearLeaveTimer = React.useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
  }, [])

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      clearLeaveTimer()
      if (!next) pinnedRef.current = false
      setOpen(next)
    },
    [clearLeaveTimer],
  )

  const scheduleClose = React.useCallback(() => {
    clearLeaveTimer()
    leaveTimerRef.current = setTimeout(() => {
      if (!pinnedRef.current) setOpen(false)
    }, 160)
  }, [clearLeaveTimer])

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Badge
          asChild
          variant="outline"
          className={cn(
            maxLabelWidthClass,
            "cursor-pointer truncate justify-start pl-3 pr-2.5",
          )}
        >
          <button
            type="button"
            className="min-w-0 w-full max-w-full truncate text-left outline-none"
            onPointerDown={(e) => {
              if (e.button !== 0) return
              pinnedRef.current = !open
            }}
            onMouseEnter={() => {
              clearLeaveTimer()
              if (!pinnedRef.current) setOpen(true)
            }}
            onMouseLeave={() => {
              if (!pinnedRef.current) scheduleClose()
            }}
          >
            {label}
          </button>
        </Badge>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        className="max-w-md border-border/60 text-sm shadow-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onMouseEnter={clearLeaveTimer}
        onMouseLeave={() => {
          if (!pinnedRef.current) scheduleClose()
        }}
      >
        {body}
      </PopoverContent>
    </Popover>
  )
}

/** Compact pill for video tool: short visible label; full prompt (and negative) in hover or click popover. */
function VideoToolPromptPill({ input }: { input?: GenerateVideoToolPart["input"] }) {
  if (!input) return null

  const promptText = input.prompt?.trim() ?? ""
  const negativeText = input.negativePrompt?.trim() ?? ""
  const imageRefCount =
    (input.referenceIds?.length ?? 0) > 0 || (input.mediaIds?.length ?? 0) > 0
      ? (input.referenceIds?.length ?? 0) + (input.mediaIds?.length ?? 0)
      : 0
  const videoRefCount = input.referenceVideoIds?.length ?? 0
  const audioRefCount = input.referenceAudioIds?.length ?? 0
  const assetCount = input.assetIds?.length ?? 0
  const hasAnyInputRefs = imageRefCount > 0 || videoRefCount > 0 || audioRefCount > 0 || assetCount > 0

  const maxPreview = 44
  const preview =
    promptText.length > maxPreview ? `${promptText.slice(0, maxPreview)}â€¦` : promptText

  if (!promptText && !negativeText) {
    return (
      <VideoToolPromptPopover
        maxLabelWidthClass="max-w-[min(100%,14rem)]"
        label={hasAnyInputRefs ? "No text prompt" : "No prompt"}
        body={
          <p className="text-left text-sm">
            {hasAnyInputRefs
              ? "No text prompt was passed; this run uses references or model defaults."
              : "No prompt or reference ids were provided on this tool call."}
          </p>
        }
      />
    )
  }

  const popoverBody = (
    <div className="space-y-2 text-left text-sm">
      {promptText ? (
        <p className="whitespace-pre-wrap wrap-break-word">{input.prompt}</p>
      ) : null}
      {negativeText ? (
        <p className="whitespace-pre-wrap wrap-break-word text-muted-foreground">
          <span className="font-medium text-foreground">Negative</span>
          {"\n"}
          {input.negativePrompt}
        </p>
      ) : null}
    </div>
  )

  return (
    <VideoToolPromptPopover label={promptText ? preview : "Negative only"} body={popoverBody} />
  )
}

export function VideoGenerationResultCard({
  messageId,
  part,
  onToolApprovalResponse,
}: {
  messageId: string
  part: GenerateVideoToolPart
  onToolApprovalResponse?: (approvalId: string, approved: boolean) => void
}) {
  const pollEnabled =
    part.state === "output-available" &&
    part.output?.status === "pending" &&
    Boolean(part.output?.predictionId)

  const polledState = useVideoGenerationPoll(part.output?.predictionId, pollEnabled)

  if (part.state === "input-streaming") {
    return (
      <Card key={messageId} className="border-border/60 bg-muted/20">
        <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <CircleNotch className="h-4 w-4 animate-spin" />
          Preparing video generation...
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
              <p className="text-sm font-medium">Video Generation Tool</p>
              <p className="text-xs text-muted-foreground">Starting video generation</p>
            </div>
            <CircleNotch className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!part.input?.modelIdentifier ? <Badge variant="outline">Model auto</Badge> : null}
            {part.input?.modelIdentifier ? (
              <Badge variant="outline" className="max-w-[12rem] truncate font-mono text-[10px]">
                {part.input.modelIdentifier}
              </Badge>
            ) : null}
            <VideoToolPromptPill input={part.input} />
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
            <p className="text-sm font-medium">Generate this video?</p>
            <p className="text-xs text-muted-foreground">
              Confirm before spending credits and starting the video job.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!part.input?.modelIdentifier ? <Badge variant="outline">Model auto</Badge> : null}
            {part.input?.modelIdentifier ? (
              <Badge variant="outline" className="max-w-[12rem] truncate font-mono text-[10px]">
                {part.input.modelIdentifier}
              </Badge>
            ) : null}
            {part.input?.aspectRatio ? <Badge variant="outline">{part.input.aspectRatio}</Badge> : null}
            {part.input?.duration ? <Badge variant="outline">{part.input.duration}s</Badge> : null}
            <VideoToolPromptPill input={part.input} />
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
          <CircleNotch className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Processing approval</p>
            <p className="truncate text-xs text-muted-foreground">
              {part.approval?.approved ? "Starting video generation" : "Canceling video generation"}
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
          <p className="font-medium">Video generation canceled</p>
          <p className="text-muted-foreground">No video job was started.</p>
        </CardContent>
      </Card>
    )
  }

  if (part.state === "output-error") {
    return (
      <Card key={messageId} className="border-destructive/30 bg-destructive/5">
        <CardContent className="space-y-4 p-4 text-sm text-destructive">
          <div className="space-y-2">
            <p className="font-medium">Video generation failed</p>
            <p>{part.errorText || "Unknown tool error."}</p>
          </div>
          {part.input ? (
            <div className="flex flex-wrap gap-2 border-t border-destructive/20 pt-3 text-foreground">
              <VideoToolPromptPill input={part.input} />
            </div>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  if (part.state === "output-available") {
    const effectiveStatus = polledState?.status ?? part.output?.status ?? "completed"
    const effectiveVideo = polledState?.video ?? part.output?.video
    const effectiveGenerationId = polledState?.generationId ?? part.output?.generationId

    if (effectiveStatus === "failed") {
      return (
        <Card key={messageId} className="border-destructive/30 bg-destructive/5">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2 text-foreground">
              <Badge variant="destructive" className="bg-destructive/20 text-destructive-foreground">
                Failed
              </Badge>
              {part.output?.model ? <Badge variant="outline">{part.output.model}</Badge> : null}
              <VideoToolPromptPill input={part.input} />
            </div>
            <div className="space-y-2 text-sm text-destructive">
              <p className="font-medium">Video generation failed</p>
              <p>{polledState?.error || part.errorText || "Unknown tool error."}</p>
            </div>
          </CardContent>
        </Card>
      )
    }

    if (effectiveStatus === "pending") {
      return (
        <Card key={messageId} className="border-border/60 bg-muted/10">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Video Pending</Badge>
              {part.output?.model ? <Badge variant="outline">{part.output.model}</Badge> : null}
              <VideoToolPromptPill input={part.input} />
              <Badge variant="outline">
                {part.output?.usedImageReferenceCount || 0} image ref
                {(part.output?.usedImageReferenceCount || 0) === 1 ? "" : "s"}
              </Badge>
              <Badge variant="outline">
                {part.output?.usedVideoReferenceCount || 0} video ref
                {(part.output?.usedVideoReferenceCount || 0) === 1 ? "" : "s"}
              </Badge>
              {(part.output?.usedAudioReferenceCount ?? 0) > 0 ? (
                <Badge variant="outline">
                  {part.output?.usedAudioReferenceCount} audio ref
                  {(part.output?.usedAudioReferenceCount ?? 0) === 1 ? "" : "s"}
                </Badge>
              ) : null}
            </div>
            {part.output?.message ? (
              <p className="text-sm text-muted-foreground">{part.output.message}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <CircleNotch className="h-4 w-4 animate-spin" />
              <span>Video generation is still running.</span>
              {effectiveGenerationId ? <Badge variant="outline">job {effectiveGenerationId.slice(0, 8)}</Badge> : null}
            </div>
          </CardContent>
        </Card>
      )
    }

    return (
      <Card key={messageId} className="border-border/60 bg-muted/10">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Generated Video</Badge>
            {part.output?.model ? <Badge variant="outline">{part.output.model}</Badge> : null}
            <VideoToolPromptPill input={part.input} />
            <Badge variant="outline">
              {part.output?.usedImageReferenceCount || 0} image ref
              {(part.output?.usedImageReferenceCount || 0) === 1 ? "" : "s"}
            </Badge>
            <Badge variant="outline">
              {part.output?.usedVideoReferenceCount || 0} video ref
              {(part.output?.usedVideoReferenceCount || 0) === 1 ? "" : "s"}
            </Badge>
            {(part.output?.usedAudioReferenceCount ?? 0) > 0 ? (
              <Badge variant="outline">
                {part.output?.usedAudioReferenceCount} audio ref
                {(part.output?.usedAudioReferenceCount ?? 0) === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>
          {part.output?.message ? (
            <p className="text-sm text-muted-foreground">{part.output.message}</p>
          ) : null}
          {effectiveVideo?.url ? (
            <video
              src={effectiveVideo.url}
              controls
              playsInline
              className="max-h-[420px] w-full rounded-2xl border border-border/60 bg-black"
            />
          ) : null}
        </CardContent>
      </Card>
    )
  }

  return null
}

