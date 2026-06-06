"use client"

import * as React from "react"
import Link from "next/link"
import { CircleNotch } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { TextOverlayToolPart } from "@/lib/chat/agent-tool-part-types"

const EDITOR_PROJECT_UPDATED_EVENT = "editor-project-updated"

export function TextOverlayResultCard({
  messageId,
  part,
}: {
  messageId: string
  part: TextOverlayToolPart
}) {
  const dispatchedRef = React.useRef<string | null>(null)
  const output = part.output

  React.useEffect(() => {
    if (
      part.state !== "output-available" ||
      (output?.status !== "applied" && output?.status !== "completed") ||
      !output.projectId
    ) {
      return
    }

    const dispatchKey = `${output.projectId}:${output.itemId ?? "item"}`
    if (dispatchedRef.current === dispatchKey) {
      return
    }

    dispatchedRef.current = dispatchKey
    window.dispatchEvent(
      new CustomEvent(EDITOR_PROJECT_UPDATED_EVENT, {
        detail: { projectId: output.projectId },
      }),
    )
  }, [output, part.state])

  if (part.state === "input-streaming" || part.state === "input-available") {
    return (
      <Card key={messageId} className="border-border/60 bg-muted/20">
        <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <CircleNotch className="h-4 w-4 animate-spin" />
          Rendering captions into the final video...
        </CardContent>
      </Card>
    )
  }

  if (part.state === "output-error") {
    return (
      <Card key={messageId} className="border-destructive/30 bg-destructive/5">
        <CardContent className="space-y-2 p-4 text-sm text-destructive">
          <p className="font-medium">Video render failed</p>
          <p>{part.errorText || "Unknown tool error."}</p>
        </CardContent>
      </Card>
    )
  }

  if (part.state !== "output-available") {
    return null
  }

  return (
    <Card key={messageId} className="overflow-hidden border-border/60 bg-muted/10">
      <CardContent className="space-y-3 p-4">
        {output?.video?.url ? (
          <video
            src={output.video.url}
            controls
            playsInline
            className="max-h-[520px] w-full rounded-xl bg-black"
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {output?.message || "The project was saved, but no rendered video was returned."}
          </p>
        )}

        {output?.projectId ? (
          <Button asChild size="sm">
            <Link href={`/editor?project=${encodeURIComponent(output.projectId)}`}>
              Open project in editor
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
