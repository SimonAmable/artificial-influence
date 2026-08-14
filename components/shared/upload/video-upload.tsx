"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X, Play, Plus, UploadSimple, FolderOpen } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { ImageUpload } from "./photo-upload"
import { toast } from "sonner"

export interface VideoUploadProps {
  value?: ImageUpload | null
  onChange?: (video: ImageUpload | null) => void
  className?: string
  title?: string
  description?: string
  accept?: string
  maxHeight?: string
  minHeight?: string
  /** Max allowed duration in seconds. Default 10. Use 30 for motion control with video orientation. */
  maxDurationSeconds?: number
  /** Show clear upload and asset-library actions in the empty state. */
  showSourceActions?: boolean
  onChooseAsset?: () => void
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
  maxDurationSeconds = 10,
  showSourceActions = false,
  onChooseAsset,
}: VideoUploadProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleRemove = () => {
    onChange?.(null)
  }

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src)
        resolve(video.duration)
      }
      
      video.onerror = () => {
        window.URL.revokeObjectURL(video.src)
        reject(new Error('Failed to load video metadata'))
      }
      
      video.src = URL.createObjectURL(file)
    })
  }

  const handleFileUpload = async (file?: File) => {
    if (!file) return
    try {
      const duration = await getVideoDuration(file)
      if (duration > maxDurationSeconds) {
        toast.error("Video duration too long", {
          description: `Video duration must be ${maxDurationSeconds} seconds or less. Your video is ${duration.toFixed(1)} seconds.`,
        })
        return
      }

      const url = URL.createObjectURL(file)
      onChange?.({ file, url })
    } catch (error) {
      console.error("Error validating video duration:", error)
      toast.error("Validation failed", {
        description: "Failed to validate video. Please try again.",
      })
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handleFileUpload(e.target.files?.[0])
    e.target.value = ""
  }

  return (
    <Card className={cn("relative bg-muted border-dashed border-2 border-muted-foreground/40 rounded-lg h-full py-0", className)}>
      <CardContent className={cn("p-1.5 sm:p-2 h-full min-h-0 flex items-center justify-center", minHeight)}>
        {value?.url ? (
          <div className="relative group flex h-full min-h-0 w-full items-center justify-center p-1">
            <video
              src={value.url}
              className={cn(
                "w-full max-w-full object-contain object-center rounded-xl",
                maxHeight
              )}
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
          <div
            role="button"
            tabIndex={0}
            className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-0.5"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                fileInputRef.current?.click()
              }
            }}
          >
            <input
              ref={fileInputRef}
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
            {showSourceActions ? (
              <div className="mt-1.5 grid w-full max-w-[15rem] grid-cols-2 gap-1.5 px-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-[10px]"
                  onClick={(event) => {
                    event.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                >
                  <UploadSimple className="size-3.5" weight="bold" />
                  Upload
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-[10px]"
                  onClick={(event) => {
                    event.stopPropagation()
                    onChooseAsset?.()
                  }}
                >
                  <FolderOpen className="size-3.5" weight="bold" />
                  Asset
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
