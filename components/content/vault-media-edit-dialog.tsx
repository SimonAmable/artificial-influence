"use client"

import * as React from "react"
import { ImageIcon, Loader2, Video } from "lucide-react"
import { toast } from "sonner"

import type { FanvueMediaItem, FanvueVaultFolder } from "@/components/content/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type VaultMediaEditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionId: string
  media: FanvueMediaItem | null
  folderName?: string | null
  folders?: FanvueVaultFolder[]
  onSaved: () => Promise<void> | void
}

function formatRecommendedPriceInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return ""
  return (value / 100).toFixed(2)
}

function parseRecommendedPriceInput(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Recommended price must be a valid amount.")
  }
  return Math.round(parsed * 100)
}

export function VaultMediaEditDialog({
  open,
  onOpenChange,
  connectionId,
  media,
  folderName = null,
  folders = [],
  onSaved,
}: VaultMediaEditDialogProps) {
  const [name, setName] = React.useState("")
  const [caption, setCaption] = React.useState("")
  const [recommendedPrice, setRecommendedPrice] = React.useState("")
  const [priceFolderName, setPriceFolderName] = React.useState<string>("")
  const [details, setDetails] = React.useState<FanvueMediaItem | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open || !media?.uuid) {
      setDetails(null)
      setName("")
      setCaption("")
      setRecommendedPrice("")
      setPriceFolderName("")
      return
    }

    setPriceFolderName(folderName ?? folders[0]?.name ?? "")

    let cancelled = false
    setIsLoading(true)
    setName(media.name ?? media.filename ?? "")
    setCaption(media.caption ?? "")
    setRecommendedPrice(formatRecommendedPriceInput(media.recommendedPrice))

    void fetch(
      `/api/fanvue/media/${encodeURIComponent(media.uuid)}?connectionId=${encodeURIComponent(connectionId)}`,
      { cache: "no-store" }
    )
      .then(async (response) => {
        const data = (await response.json()) as { media?: FanvueMediaItem; error?: string }
        if (!response.ok) {
          throw new Error(data.error || "Failed to load media details.")
        }
        if (!cancelled && data.media) {
          setDetails(data.media)
          setName(data.media.name ?? data.media.filename ?? "")
          setCaption(data.media.caption ?? "")
          setRecommendedPrice(formatRecommendedPriceInput(data.media.recommendedPrice))
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load media details.")
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
  }, [connectionId, folderName, folders, media, open])

  const activePriceFolderName = folderName ?? (priceFolderName || null)
  const showPriceFolderPicker = !folderName && folders.length > 0

  const previewItem = details ?? media
  const isVideo = (previewItem?.mediaType ?? "").toLowerCase() === "video"
  const displayName = previewItem?.name || previewItem?.filename || "Untitled"

  const handleSave = async () => {
    if (!media?.uuid) return

    setIsSaving(true)
    try {
      const trimmedName = name.trim()
      const trimmedCaption = caption.trim()
      const nextRecommendedPrice = parseRecommendedPriceInput(recommendedPrice)

      const response = await fetch(`/api/fanvue/media/${encodeURIComponent(media.uuid)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId,
          name: trimmedName || null,
          caption: trimmedCaption || null,
          recommendedPrice: nextRecommendedPrice,
          folderName: activePriceFolderName,
        }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to update media.")
      }

      toast.success("Vault media updated.")
      onOpenChange(false)
      await onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update media.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-1 border-b border-border/70 px-6 py-4">
          <DialogTitle>Edit vault media</DialogTitle>
          <DialogDescription>Update how this item appears in your Fanvue vault.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-6 py-4">
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/20">
            <div className="relative aspect-video bg-muted/30">
              {previewItem?.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={previewItem.thumbnailUrl} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  {isVideo ? <Video className="h-8 w-8" /> : <ImageIcon className="h-8 w-8" />}
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/40 to-transparent px-3 pb-2.5 pt-8">
                <p className="truncate text-sm font-medium text-white">{displayName}</p>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading details...
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="vault-media-name">Display name</Label>
                <Input
                  id="vault-media-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Untitled"
                  maxLength={255}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vault-media-caption">Caption</Label>
                <Textarea
                  id="vault-media-caption"
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  placeholder="Add a caption for this media..."
                  rows={4}
                  maxLength={5000}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vault-media-price">Recommended price (USD)</Label>
                <Input
                  id="vault-media-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={recommendedPrice}
                  onChange={(event) => setRecommendedPrice(event.target.value)}
                  placeholder="Leave empty for no price"
                />
                {showPriceFolderPicker ? (
                  <div className="space-y-2">
                    <Label htmlFor="vault-media-price-folder" className="text-xs text-muted-foreground">
                      Folder for price update
                    </Label>
                    <Select value={priceFolderName} onValueChange={setPriceFolderName}>
                      <SelectTrigger id="vault-media-price-folder">
                        <SelectValue placeholder="Select a folder" />
                      </SelectTrigger>
                      <SelectContent>
                        {folders.map((folder) => (
                          <SelectItem key={folder.name} value={folder.name}>
                            {folder.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Suggested price for this vault item. Leave blank to clear it.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="border-t border-border/70 px-6 py-4">
          <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={isSaving || isLoading || !media?.uuid} onClick={() => void handleSave()}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
