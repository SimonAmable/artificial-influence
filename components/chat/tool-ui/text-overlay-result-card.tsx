"use client"

import * as React from "react"
import { CircleNotch, Sparkle } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { TextOverlayToolPart } from "@/lib/chat/agent-tool-part-types"

const EDITOR_PROJECT_UPDATED_EVENT = "editor-project-updated"

function textJustifyContent(textAlign: "left" | "center" | "right") {
  if (textAlign === "left") {
    return "flex-start"
  }
  if (textAlign === "right") {
    return "flex-end"
  }
  return "center"
}

function previewTextStyle(part: NonNullable<TextOverlayToolPart["output"]>["previewItem"]) {
  if (!part) {
    return {}
  }

  const strokeWidth = Number(part.textStrokeWidth ?? 0)
  const stroke =
    strokeWidth > 0 ? `${strokeWidth}px ${part.textStrokeColor || "#000000"}` : undefined

  return {
    color: part.color,
    fontFamily: part.fontFamily,
    fontSize: `${Math.max(22, Math.min(48, Math.round(part.fontSize * 0.52)))}px`,
    fontWeight: part.fontWeight,
    fontStyle: part.fontStyle,
    lineHeight: part.lineHeight,
    letterSpacing: `${part.letterSpacingPx}px`,
    textAlign: part.textAlign,
    textShadow: part.textShadow || "none",
    textTransform: part.textTransform === "uppercase" ? "uppercase" : "none",
    WebkitTextStroke: stroke,
    paintOrder: stroke ? "stroke fill" : undefined,
  } as const
}

export function TextOverlayResultCard({
  messageId,
  part,
}: {
  messageId: string
  part: TextOverlayToolPart
}) {
  const dispatchedRef = React.useRef<string | null>(null)
  const output = part.output
  const previewItem = output?.previewItem ?? null

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

  if (part.state === "input-streaming") {
    return (
      <Card key={messageId} className="border-border/60 bg-muted/20">
        <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <CircleNotch className="h-4 w-4 animate-spin" />
          Building text overlay...
        </CardContent>
      </Card>
    )
  }

  if (part.state === "input-available") {
    return (
      <Card key={messageId} className="border-border/60 bg-muted/20">
        <CardContent className="flex items-center gap-3 p-4">
          <CircleNotch className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Text Overlay Tool</p>
            <p className="truncate text-xs text-muted-foreground">
              Styling {part.input?.text ? `"${part.input.text}"` : "your overlay"} with a preset
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (part.state === "output-error") {
    return (
      <Card key={messageId} className="border-destructive/30 bg-destructive/5">
        <CardContent className="space-y-2 p-4 text-sm text-destructive">
          <p className="font-medium">Text overlay failed</p>
          <p>{part.errorText || "Unknown tool error."}</p>
        </CardContent>
      </Card>
    )
  }

  if (part.state !== "output-available") {
    return null
  }

  const backgroundMode =
    previewItem?.backgroundMode ?? (previewItem?.backgroundColor ? "box" : "none")
  const backgroundStyle =
    previewItem?.backgroundColor && backgroundMode !== "none"
      ? {
          backgroundColor: previewItem.backgroundColor,
          paddingLeft: `${previewItem.backgroundPaddingX}px`,
          paddingRight: `${previewItem.backgroundPaddingX}px`,
          paddingTop: `${previewItem.backgroundPaddingY}px`,
          paddingBottom: `${previewItem.backgroundPaddingY}px`,
          borderRadius: `${previewItem.backgroundRadius}px`,
        }
      : null
  const previewStyle = previewTextStyle(previewItem)
  const placement = output?.placement ?? part.input?.placement ?? "bottom"
  const justifyContent =
    placement === "top" ? "flex-start" : placement === "center" ? "center" : "flex-end"
  const alignsTo = previewItem?.textAlign ?? "center"
  const renderedVideo = output?.video ?? null

  return (
    <Card key={messageId} className="overflow-hidden border-border/60 bg-muted/10">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>
            {output?.status === "completed"
              ? "Rendered"
              : output?.status === "applied"
                ? "Applied"
                : "Preview"}
          </Badge>
          {output?.presetLabel ? <Badge variant="outline">{output.presetLabel}</Badge> : null}
          <Badge variant="outline">{placement}</Badge>
          {previewItem?.durationInFrames ? (
            <Badge variant="outline">{previewItem.durationInFrames}f</Badge>
          ) : null}
          {output?.projectName ? (
            <Badge variant="outline">{output.projectName}</Badge>
          ) : null}
          {output?.renderedMediaId ? <Badge variant="outline">On thread</Badge> : null}
        </div>

        {renderedVideo?.url ? (
          <video
            src={renderedVideo.url}
            controls
            playsInline
            className="max-h-[420px] w-full rounded-2xl border border-border/60 bg-black"
          />
        ) : null}

        <div className="overflow-hidden rounded-[28px] border border-border/60 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_45%),linear-gradient(180deg,_rgba(24,24,27,0.95),_rgba(9,9,11,0.98))] p-4">
          <div className="mx-auto aspect-[9/16] max-h-[320px] w-full max-w-[180px] rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0.02))] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div
              className="flex h-full w-full"
              style={{
                justifyContent,
                alignItems: justifyContent,
              }}
            >
              <div
                className="flex w-full"
                style={{ justifyContent: textJustifyContent(alignsTo as "left" | "center" | "right") }}
              >
                <div
                  className="max-w-full whitespace-pre-wrap break-words"
                  style={{
                    ...previewStyle,
                    ...(backgroundMode === "box" && backgroundStyle ? backgroundStyle : null),
                  }}
                >
                  {backgroundMode === "line" && backgroundStyle ? (
                    <span
                      style={{
                        ...backgroundStyle,
                        boxDecorationBreak: "clone",
                        WebkitBoxDecorationBreak: "clone",
                      }}
                    >
                      {previewItem?.text ?? part.input?.text ?? ""}
                    </span>
                  ) : (
                    previewItem?.text ?? part.input?.text ?? ""
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-1 text-sm">
          <p className="font-medium">
            {output?.status === "applied"
              ? "Overlay added to the editor"
              : output?.status === "completed"
                ? "Final video rendered"
              : "Preview ready"}
          </p>
          {output?.message ? <p className="text-muted-foreground">{output.message}</p> : null}
          {output?.syncError ? (
            <p className="text-destructive">{output.syncError}</p>
          ) : null}
          {output?.status === "applied" || output?.status === "completed" ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkle className="h-3.5 w-3.5" />
              {output?.status === "completed"
                ? "The rendered MP4 is ready, and the overlay project has been saved."
                : "The new text layer should now be selected in the editor."}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
