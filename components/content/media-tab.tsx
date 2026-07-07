"use client"

import * as React from "react"
import { ImageIcon, Loader2, Search, Upload, Video } from "lucide-react"
import { toast } from "sonner"

import type { FanvueMediaItem } from "@/components/content/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type MediaTabProps = {
  connectionId: string | null
}

function mediaStatusLabel(status?: string | null) {
  const normalized = (status ?? "").toLowerCase()
  if (!normalized || normalized === "ready" || normalized === "completed" || normalized === "active") {
    return "Ready"
  }
  if (normalized === "processing") return "Processing"
  if (normalized === "failed" || normalized === "error") return "Failed"
  return status ?? "Unknown"
}

export function MediaTab({ connectionId }: MediaTabProps) {
  const [items, setItems] = React.useState<FanvueMediaItem[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [mediaType, setMediaType] = React.useState<"all" | "image" | "video">("all")
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const loadMedia = React.useCallback(async () => {
    if (!connectionId) {
      setItems([])
      return
    }

    setIsLoading(true)
    try {
      const params = new URLSearchParams({ connectionId })
      if (search.trim()) params.set("q", search.trim())
      if (mediaType !== "all") params.set("mediaType", mediaType)

      const response = await fetch(`/api/fanvue/media?${params.toString()}`, { cache: "no-store" })
      const data = (await response.json()) as { items?: FanvueMediaItem[]; error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to load media.")
      }
      setItems(data.items ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load media.")
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [connectionId, mediaType, search])

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
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Upload failed.")
      }

      toast.success("Media uploaded to your Fanvue vault.")
      await loadMedia()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  if (!connectionId) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-6 py-10 text-center">
        <p className="text-sm font-medium text-foreground">Connect Fanvue to manage media</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload content to your vault before scheduling posts.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search media..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "image", "video"] as const).map((type) => (
            <Button
              key={type}
              type="button"
              size="sm"
              variant={mediaType === type ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setMediaType(type)}
            >
              {type === "all" ? "All" : type === "image" ? "Images" : "Videos"}
            </Button>
          ))}
          <Button
            type="button"
            className="rounded-full"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(event) => void handleUpload(event)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading media library...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">No media yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Upload images or videos to build your vault library.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => {
            const isVideo = (item.mediaType ?? "").toLowerCase() === "video"
            const status = mediaStatusLabel(item.status)
            return (
              <article
                key={item.uuid}
                className="overflow-hidden rounded-2xl border border-border/70 bg-background/80"
              >
                <div className="relative aspect-square bg-muted/30">
                  {item.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" src={item.thumbnailUrl} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      {isVideo ? <Video className="h-8 w-8" /> : <ImageIcon className="h-8 w-8" />}
                    </div>
                  )}
                  <Badge
                    className={cn(
                      "absolute left-2 top-2",
                      status === "Ready" && "bg-emerald-500 text-white",
                      status === "Processing" && "bg-amber-500 text-white",
                      status === "Failed" && "bg-destructive text-white"
                    )}
                  >
                    {status}
                  </Badge>
                </div>
                <div className="space-y-1 p-3">
                  <p className="line-clamp-2 text-sm font-medium text-foreground">
                    {item.name || item.filename || "Untitled media"}
                  </p>
                  <p className="text-xs text-muted-foreground">{isVideo ? "Video" : "Image"}</p>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
