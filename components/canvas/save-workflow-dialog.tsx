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
import { extractGroupAsWorkflow } from "@/lib/workflows/utils"
import { captureWorkflowScreenshot, dataUrlToFile } from "@/lib/workflows/utils"
import { Loader2 } from "lucide-react"

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
  const [isSaving, setIsSaving] = React.useState(false)

  // Reset form when dialog closes
  React.useEffect(() => {
    if (!open) {
      setName("")
      setDescription("")
    }
  }, [open])

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

      // Capture screenshot for thumbnail
      let thumbnailUrl: string | null = null
      try {
        const dataUrl = await captureWorkflowScreenshot(groupId, reactFlowInstance)
        const thumbnailFile = dataUrlToFile(dataUrl, `workflow-${Date.now()}.png`)

        // Create workflow first to get ID
        const createResponse = await fetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            nodes,
            edges,
          }),
        })

        if (!createResponse.ok) {
          throw new Error("Failed to create workflow")
        }

        const workflow = await createResponse.json()

        // Upload thumbnail
        const formData = new FormData()
        formData.append("file", thumbnailFile)

        const uploadResponse = await fetch(`/api/workflows/${workflow.id}/thumbnail`, {
          method: "POST",
          body: formData,
        })

        if (uploadResponse.ok) {
          const { thumbnail_url } = await uploadResponse.json()
          thumbnailUrl = thumbnail_url
        }
      } catch (screenshotError) {
        console.error("Error capturing screenshot, saving without thumbnail:", screenshotError)
        
        // Save without thumbnail
        const response = await fetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            nodes,
            edges,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to create workflow")
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
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Save Workflow</DialogTitle>
          <DialogDescription>
            Save this group as a reusable workflow template. You can browse and instantiate saved
            workflows from the sidebar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
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

          <p className="text-sm text-muted-foreground">
            A screenshot will be automatically captured for the thumbnail. You can change it later
            from the workflow menu.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
