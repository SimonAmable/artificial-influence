"use client"

import * as React from "react"
import { Flag } from "@phosphor-icons/react"

import { FeedbackDialog } from "@/components/app/feedback-dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ReportContentButtonProps = {
  contentType: string
  contentId?: string
  contentSlug?: string
  contentUrl?: string
  className?: string
}

function buildReportMessage({
  contentType,
  contentId,
  contentSlug,
  contentUrl,
}: ReportContentButtonProps): string {
  const lines = [`Content type: ${contentType}`]
  if (contentId) lines.push(`ID: ${contentId}`)
  if (contentSlug) lines.push(`Slug: ${contentSlug}`)
  if (contentUrl) lines.push(`URL: ${contentUrl}`)
  lines.push("", "Describe the issue:")
  return lines.join("\n")
}

function stopCardActivation(event: React.SyntheticEvent) {
  event.preventDefault()
  event.stopPropagation()
}

export function ReportContentButton({
  contentType,
  contentId,
  contentSlug,
  contentUrl,
  className,
}: ReportContentButtonProps) {
  const [open, setOpen] = React.useState(false)
  const initialMessage = React.useMemo(
    () =>
      buildReportMessage({
        contentType,
        contentId,
        contentSlug,
        contentUrl,
      }),
    [contentType, contentId, contentSlug, contentUrl]
  )

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        data-report-content
        className={cn("h-8 w-8 text-muted-foreground hover:text-foreground", className)}
        aria-label="Report content"
        onPointerDown={stopCardActivation}
        onMouseDown={stopCardActivation}
        onClick={(event) => {
          stopCardActivation(event)
          setOpen(true)
        }}
      >
        <Flag className="h-4 w-4" weight="regular" />
      </Button>
      <FeedbackDialog
        open={open}
        onOpenChange={setOpen}
        title="Report content"
        description="Report abusive, illegal, or policy-violating content."
        initialFeedbackType="abuse"
        hideFeedbackType
        initialMessage={initialMessage}
      />
    </>
  )
}
