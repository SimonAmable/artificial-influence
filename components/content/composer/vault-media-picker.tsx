"use client"

import * as React from "react"
import { ImageIcon, Loader2, Video } from "lucide-react"

import type { FanvueMediaItem } from "@/components/content/types"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type VaultMediaPickerProps = {
  connectionId: string
  selectedMediaUuid: string | null
  previewMediaUuid: string | null
  onSelectMedia?: (item: FanvueMediaItem) => void
  onSelectPreview?: (item: FanvueMediaItem) => void
  previewMode?: boolean
  disabled?: boolean
}

export function VaultMediaPicker({
  connectionId,
  selectedMediaUuid,
  previewMediaUuid,
  onSelectMedia,
  onSelectPreview,
  previewMode = false,
  disabled,
}: VaultMediaPickerProps) {
  const [items, setItems] = React.useState<FanvueMediaItem[]>([])
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    fetch(`/api/fanvue/media?connectionId=${encodeURIComponent(connectionId)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { items?: FanvueMediaItem[]; error?: string }
        if (!response.ok) {
          throw new Error(data.error || "Failed to load media.")
        }
        if (!cancelled) {
          setItems((data.items ?? []).filter((item) => (item.status ?? "").toLowerCase() !== "failed"))
        }
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [connectionId])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading vault media...
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
        Upload media in the Media tab before creating a post.
      </div>
    )
  }

  const activeUuid = previewMode ? previewMediaUuid : selectedMediaUuid
  const handleSelect = previewMode ? onSelectPreview : onSelectMedia

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {items.map((item) => {
        const selected = activeUuid === item.uuid
        const isVideo = (item.mediaType ?? "").toLowerCase() === "video"
        return (
          <button
            key={item.uuid}
            type="button"
            disabled={disabled || !handleSelect}
            onClick={() => handleSelect?.(item)}
            className={cn(
              "overflow-hidden rounded-xl border text-left transition-colors",
              selected ? "border-primary ring-2 ring-primary/20" : "border-border/70 hover:border-primary/40",
              disabled && "opacity-60"
            )}
          >
            <div className="relative aspect-square bg-muted/30">
              {item.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={item.thumbnailUrl} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  {isVideo ? <Video className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
                </div>
              )}
              {selected ? (
                <Badge className="absolute left-2 top-2 bg-primary text-primary-foreground">
                  {previewMode ? "Preview" : "Selected"}
                </Badge>
              ) : null}
            </div>
          </button>
        )
      })}
    </div>
  )
}
