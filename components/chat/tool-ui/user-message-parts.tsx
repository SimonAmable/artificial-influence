"use client"

import type { UIMessage } from "ai"
import { MessageResponse } from "@/components/ai-elements/message"
import {
  isTemplateHiddenContextText,
  isTemplateHiddenMediaFilename,
} from "@/lib/templates/prompt-filler"
import { cn } from "@/lib/utils"

type FileMessagePart = Extract<UIMessage["parts"][number], { type: "file" }>

export function MessageFilePart({
  className,
  messageId,
  part,
  partIndex,
}: {
  className?: string
  messageId: string
  part: FileMessagePart
  partIndex: number
}) {
  if (part.mediaType?.startsWith("image/")) {
    return (
      <img
        key={`${messageId}-${partIndex}`}
        src={part.url}
        alt={part.filename || "Attachment"}
        className={cn("my-2 max-h-72 rounded-2xl border border-border/60 object-contain", className)}
      />
    )
  }

  if (part.mediaType?.startsWith("video/")) {
    return (
      <video
        key={`${messageId}-${partIndex}`}
        src={part.url}
        controls
        className={cn("my-2 max-h-72 rounded-2xl border border-border/60 bg-black", className)}
      />
    )
  }

  if (part.mediaType?.startsWith("audio/")) {
    return (
      <audio
        key={`${messageId}-${partIndex}`}
        src={part.url}
        controls
        className={cn("my-2 w-full", className)}
      />
    )
  }

  return null
}

export function UserMessageTextParts({ message }: { message: UIMessage }) {
  const parts = message.parts ?? []
  const textParts = parts.filter(
    (part): part is Extract<UIMessage["parts"][number], { type: "text" }> =>
      part.type === "text" && !isTemplateHiddenContextText(part.text),
  )

  if (textParts.length === 0) return null

  return (
    <>
      {textParts.map((part, index) => (
        <MessageResponse key={`${message.id}-text-${index}`}>
          {part.text}
        </MessageResponse>
      ))}
    </>
  )
}

export function UserMessageMediaParts({ message }: { message: UIMessage }) {
  const parts = message.parts ?? []
  const mediaParts = parts.filter(
    (part): part is FileMessagePart =>
      part.type === "file"
      && !isTemplateHiddenMediaFilename(part.filename)
      && (part.mediaType?.startsWith("image/")
        || part.mediaType?.startsWith("video/")
        || part.mediaType?.startsWith("audio/")),
  )

  if (mediaParts.length === 0) return null

  return (
    <div className="flex w-full flex-col items-end gap-2">
      {mediaParts.map((part, index) => (
        <MessageFilePart
          key={`${message.id}-media-${index}`}
          messageId={`${message.id}-media`}
          part={part}
          partIndex={index}
          className="my-0 max-w-full rounded-[18px]"
        />
      ))}
    </div>
  )
}
