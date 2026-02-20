"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  ASSET_CATEGORIES,
  ASSET_CATEGORY_LABELS,
  getDefaultCategoryByType,
  saveAsset,
  updateAsset,
} from "@/lib/assets/library"
import type { AssetCategory, AssetType, AssetVisibility } from "@/lib/assets/types"
import Image from "next/image"
import { toast } from "sonner"

interface CreateAssetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode?: "create" | "edit"
  assetId?: string
  initial: {
    title?: string
    url: string
    assetType: AssetType
    visibility?: AssetVisibility
    category?: AssetCategory
    tags?: string[]
    sourceNodeType?: string
  }
  onSaved?: () => void
}

export function CreateAssetDialog({
  open,
  onOpenChange,
  mode = "create",
  assetId,
  initial,
  onSaved,
}: CreateAssetDialogProps) {
  const [title, setTitle] = React.useState("")
  const [visibility, setVisibility] = React.useState<AssetVisibility>("public")
  const [category, setCategory] = React.useState<AssetCategory>(getDefaultCategoryByType(initial.assetType))
  const [tagsInput, setTagsInput] = React.useState("")

  React.useEffect(() => {
    if (!open) return
    setTitle(initial.title?.trim() || "Untitled Asset")
    setVisibility(initial.visibility || "public")
    setCategory(initial.category || getDefaultCategoryByType(initial.assetType))
    setTagsInput((initial.tags || []).join(", "))
  }, [initial.assetType, initial.category, initial.tags, initial.title, initial.visibility, open])

  const handleSave = async () => {
    if (!initial.url) {
      toast.error("Missing asset URL")
      return
    }

    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)

    try {
      if (mode === "edit") {
        if (!assetId) {
          toast.error("Missing asset ID")
          return
        }
        await updateAsset(assetId, {
          title,
          assetType: initial.assetType,
          category,
          visibility,
          tags,
          url: initial.url,
          sourceNodeType: initial.sourceNodeType,
        })
        toast.success("Asset updated")
      } else {
        await saveAsset({
          title,
          assetType: initial.assetType,
          category,
          visibility,
          tags,
          url: initial.url,
          sourceNodeType: initial.sourceNodeType,
        })
        toast.success("Asset saved")
      }
      onOpenChange(false)
      onSaved?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${mode === "edit" ? "update" : "save"} asset`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit Asset" : "Create Asset"}</DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Update your asset details and preview before saving."
              : "Save this output as a reusable reference asset."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="overflow-hidden rounded-lg border border-border bg-muted/20 p-2">
              {initial.assetType === "image" && (
                <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black/10">
                  <Image
                    src={initial.url}
                    alt={title || "Asset preview"}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
              )}
              {initial.assetType === "video" && (
                <video
                  src={initial.url}
                  controls
                  className="w-full h-auto rounded-md"
                  preload="metadata"
                />
              )}
              {initial.assetType === "audio" && (
                <audio src={initial.url} controls className="w-full" />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="asset-title">Title</Label>
            <Input
              id="asset-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My TikTok Dance Character"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select value={visibility} onValueChange={(value) => setVisibility(value as AssetVisibility)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(value) => setCategory(value as AssetCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {ASSET_CATEGORY_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="asset-tags">Tags (comma separated)</Label>
            <Input
              id="asset-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Optional: tiktok, dance, shorts"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>{mode === "edit" ? "Update Asset" : "Save Asset"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
