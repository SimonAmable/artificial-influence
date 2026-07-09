"use client"

import * as React from "react"
import { ImageIcon, Loader2, Search, Video } from "lucide-react"
import { toast } from "sonner"

import type { FanvueMediaItem } from "@/components/content/types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type VaultAddMediaDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionId: string
  folderName: string
  existingMediaUuids: Set<string>
  onAdded: () => Promise<void> | void
}

import { isFanvueMediaReadyStatus } from "@/lib/fanvue/media"

export function VaultAddMediaDialog({
  open,
  onOpenChange,
  connectionId,
  folderName,
  existingMediaUuids,
  onAdded,
}: VaultAddMediaDialogProps) {
  const [items, setItems] = React.useState<FanvueMediaItem[]>([])
  const [search, setSearch] = React.useState("")
  const [selectedUuids, setSelectedUuids] = React.useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setSearch("")
      setSelectedUuids(new Set())
      return
    }

    let cancelled = false
    setIsLoading(true)
    void fetch(
      `/api/fanvue/media?connectionId=${encodeURIComponent(connectionId)}&mediaSource=presence`,
      { cache: "no-store" }
    )
      .then(async (response) => {
        const data = (await response.json()) as { items?: FanvueMediaItem[]; error?: string }
        if (!response.ok) {
          throw new Error(data.error || "Failed to load media library.")
        }
        if (!cancelled) {
          setItems(data.items ?? [])
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load media library.")
          setItems([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [connectionId, open])

  const availableItems = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter((item) => {
      if (!isFanvueMediaReadyStatus(item.status)) return false
      if (existingMediaUuids.has(item.uuid)) return false
      if (!query) return true
      const haystack = `${item.name ?? ""} ${item.filename ?? ""}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [existingMediaUuids, items, search])

  const toggleSelection = (uuid: string, checked: boolean) => {
    setSelectedUuids((current) => {
      const next = new Set(current)
      if (checked) {
        next.add(uuid)
      } else {
        next.delete(uuid)
      }
      return next
    })
  }

  const handleAddSelected = async () => {
    const mediaUuids = Array.from(selectedUuids)
    if (mediaUuids.length === 0) return

    setIsSubmitting(true)
    try {
      const response = await fetch(
        `/api/fanvue/vault/folders/${encodeURIComponent(folderName)}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId, mediaUuids }),
        }
      )
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to add media to folder.")
      }

      toast.success(
        mediaUuids.length === 1
          ? "Added 1 item to folder."
          : `Added ${mediaUuids.length} items to folder.`
      )
      onOpenChange(false)
      await onAdded()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add media to folder.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-1 border-b border-border/70 px-6 py-4">
          <DialogTitle>Add media to &ldquo;{folderName}&rdquo;</DialogTitle>
          <DialogDescription>
            Choose items from your studio library. Upload new media on the Media tab first.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-border/70 px-6 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search library..."
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="h-[min(52vh,420px)] px-6 py-4">
          {isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading library...
            </div>
          ) : availableItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-10 text-center">
              <p className="text-sm font-medium text-foreground">No media available to add</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload on the Media tab first, or everything here is already in this folder.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {availableItems.map((item) => {
                const isVideo = (item.mediaType ?? "").toLowerCase() === "video"
                const isSelected = selectedUuids.has(item.uuid)
                return (
                  <button
                    key={item.uuid}
                    type="button"
                    onClick={() => toggleSelection(item.uuid, !isSelected)}
                    className={cn(
                      "overflow-hidden rounded-2xl border text-left transition-colors",
                      isSelected
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border/70 hover:border-border"
                    )}
                  >
                    <div className="relative aspect-square bg-muted/30">
                      {item.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="" src={item.thumbnailUrl} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          {isVideo ? <Video className="h-7 w-7" /> : <ImageIcon className="h-7 w-7" />}
                        </div>
                      )}
                      <div className="absolute left-2 top-2 rounded-md bg-background/90 p-0.5">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => toggleSelection(item.uuid, checked === true)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Select ${item.name || item.filename || "media"}`}
                        />
                      </div>
                    </div>
                    <div className="p-2.5">
                      <p className="line-clamp-2 text-xs font-medium text-foreground">
                        {item.name || item.filename || "Untitled"}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="border-t border-border/70 px-6 py-4">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSubmitting || selectedUuids.size === 0}
            onClick={() => void handleAddSelected()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : selectedUuids.size > 0 ? (
              `Add ${selectedUuids.size} to folder`
            ) : (
              "Add to folder"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
