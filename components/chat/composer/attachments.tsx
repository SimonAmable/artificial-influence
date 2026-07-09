"use client"

import * as React from "react"
import type { UIMessage } from "ai"
import { Books, Palette, X } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import type { AttachedRef } from "@/lib/commands/types"
import type { ChatReferenceMetadataItem } from "@/lib/chat/reference-metadata"
import {
  CHAT_AUDIO_FILENAME_EXT,
  CHAT_IMAGE_FILENAME_EXT,
  CHAT_VIDEO_FILENAME_EXT,
} from "@/components/chat/chat-media-utils"
import type {
  ComposerAssetAttachment,
  ComposerAttachment,
  PinnedSkillSummary,
} from "./types"

export const REACTFLOW_NODE_MIME = "application/reactflow-node"

type MediaValueType = "image" | "video" | "audio" | "other"

export function composerDropTypesAccept(dt: DataTransfer): boolean {
  const types = Array.from(dt.types ?? [])
  return types.includes("Files") || types.includes(REACTFLOW_NODE_MIME)
}

export function attachedRefFromDroppedMediaUrl(
  url: string,
  assetType: "image" | "video" | "audio",
): AttachedRef {
  const chipId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const label =
    assetType === "image" ? "Reference image" : assetType === "video" ? "Reference video" : "Reference audio"
  return {
    id: chipId,
    label,
    category: "asset",
    assetType,
    assetUrl: url,
    previewUrl: url,
    serialized: `Reference (${assetType}) "${label}": ${url}`,
    chipId,
    mentionToken: "",
  }
}

export function inferMediaTypeFromFile(file: File): MediaValueType {
  if (file.type.startsWith("image/")) return "image"
  if (file.type.startsWith("video/")) return "video"
  if (file.type.startsWith("audio/")) return "audio"
  const lower = file.name.toLowerCase()
  if (CHAT_IMAGE_FILENAME_EXT.test(lower)) return "image"
  if (CHAT_VIDEO_FILENAME_EXT.test(lower)) return "video"
  if (CHAT_AUDIO_FILENAME_EXT.test(lower)) return "audio"
  return "other"
}

function inferMediaTypeFromAssetType(assetType: ComposerAssetAttachment["assetType"]): MediaValueType {
  return assetType
}

function fallbackMediaTypeForAssetType(assetType: ComposerAssetAttachment["assetType"]) {
  if (assetType === "video") return "video/mp4"
  if (assetType === "audio") return "audio/mpeg"
  return "image/png"
}

function useAttachmentObjectUrls(attachments: ComposerAttachment[]) {
  const [urls, setUrls] = React.useState<string[]>([])

  React.useLayoutEffect(() => {
    const objectUrls: string[] = []
    const next = attachments.map((attachment) => {
      if (attachment.source === "asset") {
        return attachment.url
      }

      const url = URL.createObjectURL(attachment.file)
      objectUrls.push(url)
      return url
    })
    setUrls(next)
    return () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [attachments])

  return urls
}

const COMPOSER_THUMB_BOX =
  "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40"
const COMPOSER_THUMB_MEDIA = "h-full w-full object-cover"

export function ComposerAttachmentPreviews({
  attachments,
  onRemove,
}: {
  attachments: ComposerAttachment[]
  onRemove: (attachment: ComposerAttachment) => void
}) {
  const urls = useAttachmentObjectUrls(attachments)

  if (attachments.length === 0) return null

  return (
    <div className="flex flex-row flex-wrap items-start gap-2">
      {attachments.map((attachment, index) => {
        const isUpload = attachment.source === "upload"
        const isUploading = isUpload ? attachment.isUploading : false
        const title = isUpload ? attachment.file.name : attachment.title
        const url = urls[index]
        const mediaType = isUpload
          ? inferMediaTypeFromFile(attachment.file)
          : inferMediaTypeFromAssetType(attachment.assetType)

        return (
          <div key={attachment.id} className="relative shrink-0">
            {mediaType === "image" ? (
              <div className={COMPOSER_THUMB_BOX} title={title}>
                {url ? (
                  <img src={url} alt="" className={COMPOSER_THUMB_MEDIA} />
                ) : (
                  <div className="h-full w-full animate-pulse bg-muted" aria-hidden />
                )}
              </div>
            ) : mediaType === "video" ? (
              <div className={COMPOSER_THUMB_BOX} title={title}>
                {url ? (
                  <video
                    src={url}
                    muted
                    playsInline
                    className={COMPOSER_THUMB_MEDIA}
                    aria-label={title}
                  />
                ) : (
                  <div className="h-full w-full animate-pulse bg-muted" aria-hidden />
                )}
              </div>
            ) : mediaType === "audio" ? (
              <div
                className="relative flex h-16 w-[min(100%,200px)] min-w-[160px] max-w-[220px] shrink-0 items-center rounded-lg border border-border bg-muted/40 px-2 py-1"
                title={title}
              >
                {url ? (
                  <audio src={url} controls className="h-8 w-full" />
                ) : (
                  <div className="h-8 w-full animate-pulse rounded bg-muted" aria-hidden />
                )}
              </div>
            ) : (
              <Badge variant="outline" className="max-w-[200px] shrink-0 truncate" title={title}>
                {title}
              </Badge>
            )}
            {isUploading ? (
              <span className="absolute bottom-1 left-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] text-muted-foreground shadow-sm">
                Uploading...
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => onRemove(attachment)}
              className="absolute -top-1.5 -right-1.5 z-10 rounded-full border border-border bg-background p-1 shadow-sm hover:bg-destructive hover:text-destructive-foreground"
              aria-label={`Remove ${title}`}
            >
              <X className="size-3" weight="bold" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export async function filesToMessageParts(
  attachments: ComposerAttachment[] | undefined,
): Promise<UIMessage["parts"]> {
  if (!attachments || attachments.length === 0) return []

  const parts = await Promise.all(
    attachments.map(
      (attachment) =>
        new Promise<UIMessage["parts"][number]>((resolve, reject) => {
          if (attachment.source === "asset") {
            resolve({
              type: "file",
              url: attachment.url,
              mediaType: fallbackMediaTypeForAssetType(attachment.assetType),
              filename: attachment.title,
            })
            return
          }

          const { file, uploadedUrl } = attachment

          if (uploadedUrl) {
            resolve({
              type: "file",
              url: uploadedUrl,
              mediaType: file.type,
              filename: file.name,
            })
            return
          }

          const reader = new FileReader()
          reader.onload = () => {
            resolve({
              type: "file",
              url: reader.result as string,
              mediaType: file.type,
              filename: file.name,
            })
          }
          reader.onerror = reject
          reader.readAsDataURL(file)
        }),
    ),
  )

  return parts
}

export function brandReferencesOnly(refs: ChatReferenceMetadataItem[]) {
  return refs.filter((ref) => ref.category === "brand")
}

export function ChatBrandPills({
  refs,
  onRemove,
}: {
  refs: ChatReferenceMetadataItem[]
  onRemove?: (id: string) => void
}) {
  const brandRefs = brandReferencesOnly(refs)
  if (brandRefs.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5" role="list" aria-label="Attached brand context">
      {brandRefs.map((ref) => (
        <span
          key={ref.id}
          role="listitem"
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-xs text-foreground"
        >
          <span className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-background">
            {ref.previewUrl ? (
              <img src={ref.previewUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Palette className="size-3 text-primary" weight="regular" aria-hidden />
            )}
          </span>
          <span className="truncate font-medium">{ref.label}</span>
          {onRemove ? (
            <button
              type="button"
              className="rounded-full p-0.5 text-muted-foreground hover:bg-background/80 hover:text-foreground"
              onClick={() => onRemove(ref.id)}
              aria-label={`Remove ${ref.label}`}
            >
              <X className="size-3" weight="bold" />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  )
}

export function PinnedSkillPills({
  skills,
  onRemove,
}: {
  skills: PinnedSkillSummary[]
  onRemove?: (slug: string) => void
}) {
  if (skills.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="list" aria-label="Pinned skills">
      <span className="text-xs font-medium text-muted-foreground">Pinned skills</span>
      {skills.map((skill) => (
        <span
          key={skill.slug}
          role="listitem"
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/70 bg-muted/30 px-2 py-1 text-xs text-foreground"
          title={skill.description}
        >
          <Books className="size-3.5 shrink-0 text-muted-foreground" weight="regular" />
          <span className="truncate font-medium">{skill.title?.trim() || skill.slug}</span>
          {onRemove ? (
            <button
              type="button"
              className="rounded-full p-0.5 text-muted-foreground hover:bg-background/80 hover:text-foreground"
              onClick={() => onRemove(skill.slug)}
              aria-label={`Unpin ${skill.title?.trim() || skill.slug}`}
            >
              <X className="size-3" weight="bold" />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  )
}
