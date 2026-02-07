"use client"

import * as React from "react"
import { useReactFlow } from "@xyflow/react"
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
import { extractGroupAsWorkflow } from "@/lib/workflows/utils"
import { captureWorkflowScreenshot, dataUrlToFile } from "@/lib/workflows/utils"
import { Loader2, Upload } from "lucide-react"
import Image from "next/image"

interface SaveWorkflowDialogProps {
  groupId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

export function SaveWorkflowDialog({
  groupId,
  open,
  onOpenChange,
  onSaved,
}: SaveWorkflowDialogProps) {
  const reactFlowInstance = useReactFlow()
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [isPublic, setIsPublic] = React.useState(false)
  const [thumbnailUrl, setThumbnailUrl] = React.useState<string | null>(null)
  const [thumbnailFile, setThumbnailFile] = React.useState<File | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const previewUrlRef = React.useRef<string | null>(null)

  // Reset form when dialog closes
  React.useEffect(() => {
    if (!open) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
      setName("")
      setDescription("")
      setIsPublic(false)
      setThumbnailUrl(null)
      setThumbnailFile(null)
    }
  }, [open])

  React.useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB")
      return
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }

    const previewUrl = URL.createObjectURL(file)
    previewUrlRef.current = previewUrl
    setThumbnailFile(file)
    setThumbnailUrl(previewUrl)
  }

  const handleSave = async () => {
    if (!groupId) return
    if (!name.trim()) {
      toast.error("Please enter a workflow name")
      return
    }

    try {
      setIsSaving(true)

      // Extract group and children nodes/edges
      const allNodes = reactFlowInstance.getNodes()
      const allEdges = reactFlowInstance.getEdges()
      const { nodes, edges } = extractGroupAsWorkflow(groupId, allNodes, allEdges)

      let fileToUpload: File | null = thumbnailFile
      if (!fileToUpload) {
        try {
          const dataUrl = await captureWorkflowScreenshot(groupId, reactFlowInstance)
          fileToUpload = dataUrlToFile(dataUrl, `workflow-${Date.now()}.png`)
        } catch (screenshotError) {
          console.error("Error capturing screenshot, saving without thumbnail:", screenshotError)
        }
      }

      // Create workflow first to get ID
      const createResponse = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          nodes,
          edges,
          is_public: isPublic,
        }),
      })

      if (!createResponse.ok) {
        throw new Error("Failed to create workflow")
      }

      const workflow = await createResponse.json()

      // Upload selected thumbnail or fallback screenshot
      if (fileToUpload) {
        setIsUploading(true)
        // Upload thumbnail
        const formData = new FormData()
        formData.append("file", fileToUpload)

        const uploadResponse = await fetch(`/api/workflows/${workflow.id}/thumbnail`, {
          method: "POST",
          body: formData,
        })

        if (!uploadResponse.ok) {
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
      }

      toast.success("Workflow saved successfully!")
      onOpenChange(false)
      onSaved?.()
    } catch (error) {
      console.error("Error saving workflow:", error)
      toast.error(error instanceof Error ? error.message : "Failed to save workflow")
    } finally {
      setIsSaving(false)
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Save Workflow</DialogTitle>
          <DialogDescription>
            Save this group as a reusable template with custom thumbnail and visibility settings.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Thumbnail</Label>
            <div className="flex gap-4 items-center">
              <div className="w-32 h-32 rounded-lg overflow-hidden bg-zinc-800 flex items-center justify-center border border-white/10">
                {thumbnailUrl ? (
                  <Image
                    src={thumbnailUrl}
                    alt="Workflow thumbnail preview"
                    width={128}
                    height={128}
                    className="object-cover w-full h-full"
                    unoptimized
                  />
                ) : (
                  <p className="text-xs text-zinc-500">Auto screenshot</p>
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
                  disabled={isSaving || isUploading}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Thumbnail
                </Button>
                <p className="text-xs text-muted-foreground">
                  Max 5MB. PNG, JPG, or WebP. If none selected, we auto-capture a screenshot.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My awesome workflow"
              disabled={isSaving}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this workflow does..."
              rows={3}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-white/10 p-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="save-is-public" className="cursor-pointer">
                Make Public
              </Label>
              <p className="text-xs text-muted-foreground">
                Allow other users to view and use this workflow
              </p>
            </div>
            <Switch
              id="save-is-public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
              disabled={isSaving || isUploading}
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
            {isUploading ? "Uploading..." : "Save Workflow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
