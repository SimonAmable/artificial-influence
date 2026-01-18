"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { X, Play, Plus } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { ImageUpload } from "./photo-upload"

export interface VideoUploadProps {
  value?: ImageUpload | null
  onChange?: (video: ImageUpload | null) => void
  className?: string
  title?: string
  description?: string
  accept?: string
  maxHeight?: string
  minHeight?: string
}

export function VideoUpload({
  value,
  onChange,
  className,
  title = "Input Video",
  description = "Click to upload video",
  accept = "video/*",
  maxHeight = "max-h-[45px]",
  minHeight = "min-h-[50px] sm:min-h-[55px]",
}: VideoUploadProps) {
  const handleRemove = () => {
    onChange?.(null)
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      const newVideo = { file, url }
      onChange?.(newVideo)
    }
  }

  return (
    <Card className={cn("relative bg-muted border-dashed border-2 border-muted-foreground/40 rounded-lg h-full py-0", className)}>
      <CardContent className={cn("p-1.5 sm:p-2 h-full flex items-center justify-center", minHeight)}>
        {value?.url ? (
          <div className="relative group flex items-center justify-center w-full h-full min-h-[45px] p-1">
            <video
              src={value.url}
              className={cn("max-w-full w-auto h-auto object-contain rounded-xl", maxHeight)}
              controls
              preload="metadata"
            >
              Your browser does not support the video tag.
            </video>
            <button
              onClick={handleRemove}
              className="absolute top-2 right-2 bg-background/80 hover:bg-background rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Remove video"
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
              <Play className="size-5 sm:size-6 text-foreground" weight="bold" />
              <Plus className="size-2 sm:size-2.5 text-foreground absolute -top-0.5 -right-0.5 bg-muted rounded-full p-0.5" weight="bold" />
            </div>
            <div className="flex flex-col items-center gap-0">
              <div className="text-foreground font-bold text-[9px] sm:text-[10px]">{title}</div>
              <div className="text-muted-foreground text-[8px] sm:text-[9px] text-center px-1">{description}</div>
            </div>
          </label>
        )}
      </CardContent>
    </Card>
  )
}
