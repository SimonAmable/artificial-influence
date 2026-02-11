"use client"

import * as React from "react"
import { UploadSimple, Image as ImageIcon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useImageEditor } from "./image-editor-provider"

interface ImageEditorEmptyStateProps {
  className?: string
}

export function ImageEditorEmptyState({ className }: ImageEditorEmptyStateProps) {
  const { loadImage } = useImageEditor()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)
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

  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center z-10",
        "bg-zinc-950",
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
            : "border-zinc-700 bg-zinc-900/50 hover:border-zinc-500"
        )}
      >
        <div
          className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-colors",
            isDragging ? "bg-primary/20" : "bg-zinc-800"
          )}
        >
          {isDragging ? (
            <UploadSimple size={40} className="text-primary" />
          ) : (
            <ImageIcon size={40} className="text-zinc-500" />
          )}
        </div>

        <h3 className="text-xl font-medium text-zinc-200 mb-2">
          {isDragging ? "Drop image here" : "Start editing"}
        </h3>

        <p className="text-sm text-zinc-500 mb-6 text-center max-w-xs">
          Upload an image to start editing, or drag and drop a file here
        </p>

        <Button
          onClick={() => fileInputRef.current?.click()}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <UploadSimple size={18} className="mr-2" />
          Upload Image
        </Button>

        <p className="text-xs text-zinc-600 mt-4">
          Supports PNG, JPG, GIF, WebP
        </p>
      </div>
    </div>
  )
}
