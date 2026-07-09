"use client"

import * as React from "react"
import { ImageIcon, Loader2, Video } from "lucide-react"

import type { FanvueMediaItem } from "@/components/content/types"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  isFanvueMediaFailedStatus,
  isFanvueMediaProcessingStatus,
} from "@/lib/fanvue/media"

type FanvueMediaPreviewProps = {
  item: Pick<FanvueMediaItem, "thumbnailUrl" | "mediaType" | "status" | "name" | "filename">
  className?: string
  imageClassName?: string
  showStatusBadge?: boolean
}

export function getFanvueMediaDisplayName(
  item: Pick<FanvueMediaItem, "name" | "filename">
): string {
  return item.name?.trim() || item.filename?.trim() || "Untitled"
}

function getStatusBadgeLabel(status: string | null | undefined): string | null {
  if (isFanvueMediaFailedStatus(status)) return "Failed"
  if (isFanvueMediaProcessingStatus(status)) return "Processing"
  return null
}

export function FanvueMediaPreview({
  item,
  className,
  imageClassName,
  showStatusBadge = true,
}: FanvueMediaPreviewProps) {
  const [thumbnailFailed, setThumbnailFailed] = React.useState(false)
  const isVideo = (item.mediaType ?? "").toLowerCase() === "video"
  const statusLabel = showStatusBadge ? getStatusBadgeLabel(item.status) : null
  const showThumbnail = Boolean(item.thumbnailUrl) && !thumbnailFailed

  React.useEffect(() => {
    setThumbnailFailed(false)
  }, [item.thumbnailUrl])

  return (
    <div className={cn("relative aspect-square bg-muted/30", className)}>
      {showThumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          src={item.thumbnailUrl ?? undefined}
          className={cn("h-full w-full object-cover", imageClassName)}
          onError={() => setThumbnailFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
          {statusLabel === "Processing" ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : isVideo ? (
            <Video className="h-6 w-6" />
          ) : (
            <ImageIcon className="h-6 w-6" />
          )}
        </div>
      )}
      {statusLabel ? (
        <Badge
          variant={statusLabel === "Failed" ? "destructive" : "secondary"}
          className="absolute left-2 top-2"
        >
          {statusLabel}
        </Badge>
      ) : null}
    </div>
  )
}
