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
import { Sparkle, SpinnerGap } from "@phosphor-icons/react"
import type { AssetCategory, AssetType, AssetVisibility } from "@/lib/assets/types"
import { invalidateCommandCache } from "@/lib/commands/cache"
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
    uploadId?: string
    supabaseStoragePath?: string
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
  const [isAutofilling, setIsAutofilling] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setTitle(initial.title?.trim() || "Untitled Asset")
    setVisibility(initial.visibility || "public")
    setCategory(initial.category || getDefaultCategoryByType(initial.assetType))
    setTagsInput((initial.tags || []).join(", "))
  }, [initial.assetType, initial.category, initial.tags, initial.title, initial.visibility, open])

  const handleAutofill = async () => {
    if (!initial.url) return
    setIsAutofilling(true)
    
    try {
      const res = await fetch("/api/assets/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: initial.url, assetType: initial.assetType, fileName: initial.title }),
      })
      if (!res.ok) throw new Error("Autofill failed")
      const data = await res.json()
      if (data.result) {
        if (data.result.title) setTitle(data.result.title)
        if (data.result.category) setCategory(data.result.category)
        if (data.result.tags && Array.isArray(data.result.tags)) {
          setTagsInput(data.result.tags.join(", "))
        }
        toast.success("Autofilled asset details")
      }
    } catch (err) {
      console.warn("AI autofill failed:", err)
      toast.error("Failed to autofill with AI")
    } finally {
      setIsAutofilling(false)
    }
  }

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
          uploadId: initial.uploadId,
          supabaseStoragePath: initial.supabaseStoragePath,
          sourceNodeType: initial.sourceNodeType,
        })
        toast.success("Asset updated")
        invalidateCommandCache()
      } else {
        await saveAsset({
          title,
          assetType: initial.assetType,
          category,
          visibility,
          tags,
          url: initial.url,
          uploadId: initial.uploadId,
          supabaseStoragePath: initial.supabaseStoragePath,
          sourceNodeType: initial.sourceNodeType,
        })
        toast.success("Asset saved")
        invalidateCommandCache()
      }
      onOpenChange(false)
      onSaved?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${mode === "edit" ? "update" : "save"} asset`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "edit" ? "Edit Asset" : "Create Asset"}
            {isAutofilling && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-amber-500 animate-pulse bg-amber-500/10 px-2 py-1 rounded-md">
                <Sparkle weight="fill" className="h-3 w-3" />
                Autofilling with AI...
              </span>
            )}
          </DialogTitle>
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
                <img
                  src={initial.url}
                  alt={title || "Asset preview"}
                  className="block max-h-[200px] w-full rounded-md bg-black/10 object-contain"
                />
              )}
              {initial.assetType === "video" && (
                <video
                  src={initial.url}
                  controls
                  className="block max-h-[200px] w-full rounded-md object-contain"
                  preload="metadata"
                />
              )}
              {initial.assetType === "audio" && (
                <audio src={initial.url} controls className="w-full max-w-full" />
              )}
            </div>
          </div>

          <div className="space-y-2 relative">
            <Label htmlFor="asset-title">Title</Label>
            <Input
              id="asset-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My TikTok Dance Character"
              disabled={isAutofilling}
              className={isAutofilling ? "opacity-70" : ""}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select value={visibility} onValueChange={(value) => setVisibility(value as AssetVisibility)} disabled={isAutofilling}>
                <SelectTrigger className={isAutofilling ? "opacity-70" : ""}>
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
              <Select value={category} onValueChange={(value) => setCategory(value as AssetCategory)} disabled={isAutofilling}>
                <SelectTrigger className={isAutofilling ? "opacity-70" : ""}>
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
              disabled={isAutofilling}
              className={isAutofilling ? "opacity-70" : ""}
            />
          </div>
        </div>

        <DialogFooter className="flex w-full items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="secondary"
            onClick={handleAutofill}
            disabled={isAutofilling}
            className="gap-2"
          >
            {isAutofilling ? (
              <SpinnerGap className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkle weight="fill" className="h-4 w-4 text-amber-500" />
            )}
            Autofill with AI
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isAutofilling}>
              {mode === "edit" ? "Update Asset" : "Save Asset"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
