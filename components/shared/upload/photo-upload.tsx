"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog"
import { X, User, Plus } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

export interface ImageUpload {
  url?: string
  file?: File
}

export interface PhotoUploadProps {
  value?: ImageUpload | null
  onChange?: (image: ImageUpload | null) => void
  className?: string
  title?: string
  description?: string
  accept?: string
  maxHeight?: string
  minHeight?: string
}

export function PhotoUpload({
  value,
  onChange,
  className,
  title = "Your Photo",
  description = "Upload the character you want to insert",
  accept = "image/*",
  maxHeight = "max-h-[45px]",
  minHeight = "min-h-[50px] sm:min-h-[55px]",
}: PhotoUploadProps) {
  const [isFullscreenOpen, setIsFullscreenOpen] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const dragCounter = React.useRef(0)

  const handleFileUpload = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith("image/")) return

    const url = URL.createObjectURL(file)
    const newImage = { file, url }
    onChange?.(newImage)
  }

  const handleRemove = () => {
    onChange?.(null)
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(e.target.files?.[0])
  }

  const handleImageClick = () => {
    if (value?.url) {
      setIsFullscreenOpen(true)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setIsDragging(false)
    handleFileUpload(e.dataTransfer.files?.[0])
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
    <Card
      className={cn(
        "relative bg-muted border-dashed border-2 rounded-lg h-full py-0 transition-colors",
        isDragging ? "border-primary bg-primary/10" : "border-muted-foreground/40",
        className
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <CardContent className={cn("p-1.5 sm:p-2 h-full flex items-center justify-center", minHeight)}>
        {value?.url ? (
          <div className="relative group flex items-center justify-center w-full h-full min-h-[45px] p-1">
            <img
              src={value.url}
              alt="Uploaded photo"
              className={cn("max-w-full w-auto h-auto object-contain rounded-xl cursor-pointer", maxHeight)}
              onClick={handleImageClick}
            />
            <button
              onClick={handleRemove}
              className="absolute top-2 right-2 bg-background/80 hover:bg-background rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
              aria-label="Remove image"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-0.5 cursor-pointer w-full h-full">
            <input
              type="file"
              accept={accept}
              onChange={handleUpload}
              className="hidden"
            />
            <div className="relative">
              <User className="size-5 sm:size-6 text-foreground" weight="bold" />
              <Plus className="size-2 sm:size-2.5 text-foreground absolute -top-0.5 -right-0.5 bg-muted rounded-full p-0.5" weight="bold" />
            </div>
            <div className="flex flex-col items-center gap-0">
              <div className="text-foreground font-bold text-[9px] sm:text-[10px]">{title}</div>
              <div className="text-muted-foreground text-[8px] sm:text-[9px] text-center px-1">{description}</div>
            </div>
          </label>
        )}
      </CardContent>

      <Dialog open={isFullscreenOpen} onOpenChange={setIsFullscreenOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0">
          <div className="relative w-full h-full flex items-center justify-center bg-black/95">
            <img
              src={value?.url}
              alt="Full screen view"
              className="max-w-full max-h-full object-contain"
            />
            <DialogClose className="absolute top-4 right-4 bg-background/80 hover:bg-background rounded-full p-2">
              <X className="size-6" />
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
