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
import { ASSET_CATEGORIES, ASSET_CATEGORY_LABELS, getDefaultCategoryByType, saveAsset } from "@/lib/assets/library"
import type { AssetCategory, AssetType, AssetVisibility } from "@/lib/assets/types"
import { toast } from "sonner"

interface CreateAssetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: {
    title?: string
    url: string
    assetType: AssetType
    sourceNodeType?: string
  }
  onSaved?: () => void
}

export function CreateAssetDialog({ open, onOpenChange, initial, onSaved }: CreateAssetDialogProps) {
  const [title, setTitle] = React.useState("")
  const [visibility, setVisibility] = React.useState<AssetVisibility>("public")
  const [category, setCategory] = React.useState<AssetCategory>(getDefaultCategoryByType(initial.assetType))
  const [tagsInput, setTagsInput] = React.useState("")

  React.useEffect(() => {
    if (!open) return
    setTitle(initial.title?.trim() || "Untitled Asset")
    setVisibility("public")
    setCategory(getDefaultCategoryByType(initial.assetType))
    setTagsInput("")
  }, [initial.assetType, initial.title, open])

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
      onOpenChange(false)
      onSaved?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save asset")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Asset</DialogTitle>
          <DialogDescription>
            Save this output as a reusable reference asset.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
          <Button onClick={handleSave}>Save Asset</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
