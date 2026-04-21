"use client"

import * as React from "react"
import { UploadSimple, FolderOpen } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  AssetSelectionModal,
  type AssetSelectionPick,
} from "@/components/shared/modals/asset-selection-modal"
import { toast } from "sonner"
import { useImageEditor } from "./image-editor-provider"

interface ImageEditorEmptyStateProps {
  className?: string
}

export function ImageEditorEmptyState({ className }: ImageEditorEmptyStateProps) {
  const { loadImage } = useImageEditor()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [assetModalOpen, setAssetModalOpen] = React.useState(false)
  const dragCounter = React.useRef(0)

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      return
    }

    const url = URL.createObjectURL(file)
    try {
      await loadImage(url)
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current += 1
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragging(false)
    }
  }

  const handleAssetSelect = async ({ url, assetType }: AssetSelectionPick) => {
    if (assetType !== "image") {
      toast.error("Selected item must be an image")
      return
    }
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error("Failed to fetch")
      const blob = await response.blob()
      if (!blob.type.startsWith("image/")) {
        toast.error("Selected item must be an image")
        return
      }
      // Use the canonical URL for canvas + state so currentImage stays valid for export/generate (same as /image references).
      await loadImage(url)
      setAssetModalOpen(false)
    } catch {
      toast.error("Could not load image from library")
    }
  }

  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center z-10 bg-transparent",
        isDragging && "ring-2 ring-inset ring-primary/40 rounded-xl",
        className
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />

      <div className="flex flex-col items-center gap-3 px-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-shadow hover:shadow-lg hover:shadow-black/35 dark:hover:shadow-black/50"
          >
            <UploadSimple size={18} className="mr-2" />
            {isDragging ? "Drop image here" : "Upload Image"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setAssetModalOpen(true)}
          >
            <FolderOpen size={18} className="mr-2" />
            Select Asset
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center max-w-sm">
          Drag and drop anywhere in this area · PNG, JPG, GIF, WebP
        </p>

        <AssetSelectionModal
          open={assetModalOpen}
          onOpenChange={setAssetModalOpen}
          onSelect={handleAssetSelect}
        />
      </div>
    </div>
  )
}
