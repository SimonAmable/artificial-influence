"use client"

import * as React from "react"
import { Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

import type { FanvueMediaItem } from "@/components/content/types"
import {
  FanvueMediaPreview,
  getFanvueMediaDisplayName,
} from "@/components/content/fanvue-media-preview"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { isFanvueMediaBrowsable } from "@/lib/fanvue/media"

type VaultMediaPickerProps = {
  connectionId: string
  selectedMediaUuid: string | null
  previewMediaUuid: string | null
  onSelectMedia?: (item: FanvueMediaItem) => void
  onSelectPreview?: (item: FanvueMediaItem) => void
  previewMode?: boolean
  disabled?: boolean
  allowUpload?: boolean
  onUploaded?: (item: FanvueMediaItem) => void
  className?: string
}

export function VaultMediaPicker({
  connectionId,
  selectedMediaUuid,
  previewMediaUuid,
  onSelectMedia,
  onSelectPreview,
  previewMode = false,
  disabled,
  allowUpload = true,
  onUploaded,
  className,
}: VaultMediaPickerProps) {
  const [items, setItems] = React.useState<FanvueMediaItem[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const loadVersion = React.useRef(0)

  const loadMedia = React.useCallback(async () => {
    const version = ++loadVersion.current
    setIsLoading(true)
    try {
      const response = await fetch(`/api/fanvue/media?connectionId=${encodeURIComponent(connectionId)}`, {
        cache: "no-store",
      })
      const data = (await response.json()) as { items?: FanvueMediaItem[]; error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to load media.")
      }
      if (version !== loadVersion.current) return
      setItems((data.items ?? []).filter((item) => isFanvueMediaBrowsable(item)))
    } catch (error) {
      if (version !== loadVersion.current) return
      toast.error(error instanceof Error ? error.message : "Failed to load media.")
      setItems([])
    } finally {
      if (version === loadVersion.current) {
        setIsLoading(false)
      }
    }
  }, [connectionId])

  React.useEffect(() => {
    void loadMedia()
  }, [loadMedia])

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !connectionId) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("connectionId", connectionId)
      formData.append("file", file)

      const response = await fetch("/api/fanvue/media/upload", {
        method: "POST",
        body: formData,
      })
      const data = (await response.json()) as { media?: FanvueMediaItem; error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Upload failed.")
      }

      toast.success("Media uploaded to your vault.")
      await loadMedia()

      const uploaded = data.media
      if (uploaded?.uuid) {
        const handleSelect = previewMode ? onSelectPreview : onSelectMedia
        handleSelect?.(uploaded)
        onUploaded?.(uploaded)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const activeUuid = previewMode ? previewMediaUuid : selectedMediaUuid
  const handleSelect = previewMode ? onSelectPreview : onSelectMedia

  const renderGrid = () => {
    if (isLoading) {
      return (
        <div className="flex items-center gap-2 px-1 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading vault media...
        </div>
      )
    }

    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">No vault media yet. Upload to get started.</p>
          {allowUpload ? (
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              disabled={disabled || isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Upload media
            </Button>
          ) : null}
        </div>
      )
    }

    return (
      <div className="grid grid-cols-3 gap-2 p-1 sm:grid-cols-4">
        {allowUpload ? (
          <button
            type="button"
            disabled={disabled || isUploading}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/70 bg-muted/10 text-muted-foreground transition-colors",
              "hover:border-primary/40 hover:bg-muted/20 hover:text-foreground",
              (disabled || isUploading) && "opacity-60"
            )}
          >
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
            <span className="text-[10px] font-medium">Upload</span>
          </button>
        ) : null}
        {items.map((item) => {
          const selected = activeUuid === item.uuid
          return (
            <button
              key={item.uuid}
              type="button"
              disabled={disabled || !handleSelect}
              onClick={() => handleSelect?.(item)}
              className={cn(
                "relative overflow-hidden rounded-xl border text-left transition-colors",
                selected ? "border-primary ring-2 ring-primary/20" : "border-border/70 hover:border-primary/40",
                disabled && "opacity-60"
              )}
            >
              <FanvueMediaPreview item={item} showStatusBadge={!selected} />
              {selected ? (
                <Badge className="absolute left-2 top-2 bg-primary text-primary-foreground">
                  {previewMode ? "Preview" : "Selected"}
                </Badge>
              ) : null}
              <div className="px-2 py-1.5">
                <p className="line-clamp-1 text-[10px] font-medium text-muted-foreground">
                  {getFanvueMediaDisplayName(item)}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      {allowUpload && items.length > 0 ? (
        <div className="flex items-center justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-full"
            disabled={disabled || isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
            Upload
          </Button>
        </div>
      ) : null}

      <ScrollArea className="h-[min(280px,40vh)] rounded-xl border border-border/60 bg-muted/5">
        {renderGrid()}
      </ScrollArea>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(event) => void handleUpload(event)}
      />
    </div>
  )
}
