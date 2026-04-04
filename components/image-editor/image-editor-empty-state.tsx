"use client"

import * as React from "react"
import { UploadSimple, Image as ImageIcon, FolderOpen } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AssetSelectionModal } from "@/components/shared/modals/asset-selection-modal"
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

  const handleAssetSelect = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl)
      if (!response.ok) throw new Error("Failed to fetch")
      const blob = await response.blob()
      if (!blob.type.startsWith("image/")) {
        toast.error("Selected item must be an image")
        return
      }
      // Use the canonical URL for canvas + state so currentImage stays valid for export/generate (same as /image references).
      await loadImage(imageUrl)
      setAssetModalOpen(false)
    } catch {
      toast.error("Could not load image from library")
    }
  }

  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center z-10",
        "bg-muted",
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

      <div
        className={cn(
          "flex flex-col items-center justify-center p-12 rounded-2xl border-2 border-dashed transition-all",
          isDragging
            ? "border-primary bg-primary/10 scale-105"
            : "border-border bg-card/60 hover:border-muted-foreground/40"
        )}
      >
        <div
          className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors",
            isDragging ? "bg-primary/20" : "bg-muted"
          )}
        >
          {isDragging ? (
            <UploadSimple size={40} className="text-primary" />
          ) : (
            <ImageIcon size={40} className="text-muted-foreground" />
          )}
        </div>

        <h3 className="text-xl font-medium text-foreground mb-2">
          {isDragging ? "Drop image here" : "Start editing"}
        </h3>

        <p className="text-sm text-muted-foreground mb-6 text-center max-w-xs">
          Upload an image to start editing, or drag and drop a file here
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full max-w-xs sm:max-w-none sm:w-auto">
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-shadow hover:shadow-lg hover:shadow-black/35 dark:hover:shadow-black/50"
          >
            <UploadSimple size={18} className="mr-2" />
            Upload Image
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

        <AssetSelectionModal
          open={assetModalOpen}
          onOpenChange={setAssetModalOpen}
          onSelect={handleAssetSelect}
        />

        <p className="text-xs text-muted-foreground/80 mt-4">
          Supports PNG, JPG, GIF, WebP
        </p>
      </div>
    </div>
  )
}
