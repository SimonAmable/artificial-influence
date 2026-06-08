"use client"

import * as React from "react"
import { CircleNotch } from "@phosphor-icons/react"
import { toast } from "sonner"

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
import { Textarea } from "@/components/ui/textarea"
import type { SlideshowCollection } from "@/lib/slideshow/types"

export type CreateCollectionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (collection: SlideshowCollection) => void
}

export function CreateCollectionDialog({ open, onOpenChange, onCreated }: CreateCollectionDialogProps) {
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setName("")
      setDescription("")
      setBusy(false)
    }
  }, [open])

  async function handleCreate() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error("Enter a collection name.")
      return
    }

    setBusy(true)
    try {
      const response = await fetch("/api/slideshow/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || null,
        }),
      })
      const data = (await response.json().catch(() => ({}))) as {
        error?: string | Record<string, string[]>
        collection?: SlideshowCollection
      }

      if (!response.ok) {
        const message =
          typeof data.error === "string"
            ? data.error
            : "Failed to create collection."
        throw new Error(message)
      }

      if (!data.collection) {
        throw new Error("Collection was created but could not be loaded.")
      }

      onCreated?.(data.collection)
      onOpenChange(false)
      toast.success("Collection created.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create collection.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New collection</DialogTitle>
          <DialogDescription>
            Group images into a reusable pack for slideshows and templates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="collection-name">Name</Label>
            <Input
              id="collection-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Product lifestyle shots"
              maxLength={120}
              disabled={busy}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  void handleCreate()
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="collection-description">Description (optional)</Label>
            <Textarea
              id="collection-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What kind of images belong in this pack?"
              rows={3}
              maxLength={500}
              disabled={busy}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleCreate()} disabled={busy || !name.trim()}>
            {busy ? <CircleNotch className="h-4 w-4 animate-spin" /> : null}
            Create collection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
