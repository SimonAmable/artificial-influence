"use client"

import * as React from "react"
import { toast } from "sonner"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import type { Workflow } from "@/lib/workflows/database-server"
import { Loader2, Upload } from "lucide-react"
import Image from "next/image"

interface EditWorkflowDialogProps {
  workflow: Workflow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

export function EditWorkflowDialog({
  workflow,
  open,
  onOpenChange,
  onSaved,
}: EditWorkflowDialogProps) {
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [isPublic, setIsPublic] = React.useState(false)
  const [thumbnailUrl, setThumbnailUrl] = React.useState<string | null>(null)
  const [thumbnailFile, setThumbnailFile] = React.useState<File | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Update form when workflow changes
  React.useEffect(() => {
    if (workflow) {
      setName(workflow.name)
      setDescription(workflow.description || "")
      setIsPublic(workflow.is_public)
      setThumbnailUrl(workflow.thumbnail_url)
      setThumbnailFile(null)
    }
  }, [workflow])

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file")
        return
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error("Image must be smaller than 5MB")
        return
      }
      setThumbnailFile(file)
      // Create preview URL
      const previewUrl = URL.createObjectURL(file)
      setThumbnailUrl(previewUrl)
    }
  }

  const handleSave = async () => {
    if (!workflow) return
    if (!name.trim()) {
      toast.error("Please enter a workflow name")
      return
    }

    try {
      setIsSaving(true)

      // Upload thumbnail if a new file was selected
      if (thumbnailFile) {
        setIsUploading(true)
        const formData = new FormData()
        formData.append("file", thumbnailFile)

        const uploadResponse = await fetch(`/api/workflows/${workflow.id}/thumbnail`, {
          method: "POST",
          body: formData,
        })

        if (uploadResponse.ok) {
          const { thumbnail_url } = await uploadResponse.json()
          setThumbnailUrl(thumbnail_url)
        } else {
          let message = "Failed to upload thumbnail"
          try {
            const errorBody = await uploadResponse.json()
            if (typeof errorBody?.error === "string" && errorBody.error.trim().length > 0) {
              message = errorBody.error
            }
          } catch {
            // Ignore JSON parse errors and keep fallback message
          }
          toast.error(message)
        }
        setIsUploading(false)
      }

      // Update workflow metadata
      const response = await fetch(`/api/workflows/${workflow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          is_public: isPublic,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update workflow")
      }

      toast.success("Workflow updated successfully!")
      onOpenChange(false)
      onSaved?.()
    } catch (error) {
      console.error("Error updating workflow:", error)
      toast.error(error instanceof Error ? error.message : "Failed to update workflow")
    } finally {
      setIsSaving(false)
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Edit Workflow</DialogTitle>
          <DialogDescription>
            Update your workflow&apos;s name, description, visibility, and thumbnail.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Thumbnail */}
          <div className="grid gap-2">
            <Label>Thumbnail</Label>
            <div className="flex gap-4 items-center">
              <div className="w-32 h-32 rounded-lg overflow-hidden bg-zinc-800 flex items-center justify-center border border-white/10">
                {thumbnailUrl ? (
                  <Image
                    src={thumbnailUrl}
                    alt="Workflow thumbnail"
                    width={128}
                    height={128}
                    className="object-cover w-full h-full"
                    unoptimized
                  />
                ) : (
                  <p className="text-xs text-zinc-500">No thumbnail</p>
                )}
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSaving}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload New Image
                </Button>
                <p className="text-xs text-muted-foreground">
                  Max 5MB. PNG, JPG, or WebP.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My awesome workflow"
              disabled={isSaving}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this workflow does..."
              rows={3}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-white/10 p-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="is-public" className="cursor-pointer">
                Make Public
              </Label>
              <p className="text-xs text-muted-foreground">
                Allow other users to view and use this workflow
              </p>
            </div>
            <Switch
              id="is-public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
              disabled={isSaving}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving || isUploading}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isUploading}>
            {(isSaving || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isUploading ? "Uploading..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
