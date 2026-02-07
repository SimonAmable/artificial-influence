"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { ImageEditor } from "./image-editor"
import type { ImageEditorDialogProps } from "@/lib/image-editor/types"

export function ImageEditorDialog({
  open,
  onOpenChange,
  initialImage,
  onSave,
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
      <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 gap-0 overflow-hidden bg-zinc-950 border-white/10">
        <ImageEditor
          initialImage={initialImage}
          mode="modal"
          onSave={handleSave}
          onClose={handleClose}
          className="h-full"
        />
      </DialogContent>
    </Dialog>
  )
}
