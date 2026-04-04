"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { ImageEditor } from "./image-editor"
import type { ImageEditorDialogProps } from "@/lib/image-editor/types"

export function ImageEditorDialog({
  open,
  onOpenChange,
  initialImage,
  onSave,
  variant = "inpaint",
}: ImageEditorDialogProps) {
  const handleSave = (url: string) => {
    onSave?.(url)
    onOpenChange(false)
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-none w-screen h-[90vh] p-0 gap-0 overflow-hidden bg-background border-border">
        <DialogTitle className="sr-only">Inpaint editor</DialogTitle>
        <ImageEditor
          initialImage={initialImage}
          mode="modal"
          onSave={handleSave}
          onClose={handleClose}
          className="h-full"
          variant={variant}
        />
      </DialogContent>
    </Dialog>
  )
}
