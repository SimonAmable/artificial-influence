"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PhotoUpload, ImageUpload } from "@/components/shared/upload/photo-upload"
import { VideoUpload } from "@/components/shared/upload/video-upload"
import { CircleNotch } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

export interface MotionCopyInputBoxProps {
  className?: string
  onImageChange?: (image: ImageUpload | null) => void
  onVideoChange?: (video: ImageUpload | null) => void
  onGenerate?: () => void
  defaultImage?: ImageUpload | null
  defaultVideo?: ImageUpload | null
  isGenerating?: boolean
  forceRowLayout?: boolean
  photoUploadProps?: {
    title?: string
    description?: string
  }
  videoUploadProps?: {
    title?: string
    description?: string
  }
  extraControls?: React.ReactNode
}

export function MotionCopyInputBox({
  className,
  onImageChange,
  onVideoChange,
  onGenerate,
  defaultImage,
  defaultVideo,
  isGenerating = false,
  forceRowLayout = false,
  photoUploadProps,
  videoUploadProps,
  extraControls,
}: MotionCopyInputBoxProps) {
  const [inputImage, setInputImage] = React.useState<ImageUpload | null>(defaultImage || null)
  const [inputVideo, setInputVideo] = React.useState<ImageUpload | null>(defaultVideo || null)

  // Sync with external changes
  React.useEffect(() => {
    if (defaultImage !== undefined) {
      setInputImage(defaultImage || null)
    }
  }, [defaultImage])

  React.useEffect(() => {
    if (defaultVideo !== undefined) {
      setInputVideo(defaultVideo || null)
    }
  }, [defaultVideo])

  const handleImageChange = (image: ImageUpload | null) => {
    setInputImage(image)
    onImageChange?.(image)
  }

  const handleVideoChange = (video: ImageUpload | null) => {
    setInputVideo(video)
    onVideoChange?.(video)
  }

  const handleGenerate = () => {
    if (onGenerate && inputImage && inputVideo) {
      onGenerate()
    }
  }

  // Determine if button is ready (both image and video are required)
  const isReady = React.useMemo(() => {
    return !!(inputImage?.file && inputVideo?.file)
  }, [inputImage, inputVideo])

  return (
    <Card className={cn("w-full max-w-sm sm:max-w-lg lg:max-w-4xl relative", className)}>
      <CardContent className={cn(
        "pt-1.5 pb-1.5 flex gap-1.5 sm:gap-2 px-4 sm:px-6",
        forceRowLayout ? "flex-row items-stretch" : "flex-col",
        extraControls && "flex-wrap"
      )}>
        {/* Image Upload */}
        <div className={cn(
          forceRowLayout ? "flex-1" : "w-full"
        )}>
          <PhotoUpload
            value={inputImage}
            onChange={handleImageChange}
            title={photoUploadProps?.title || "Upload Image"}
            description={photoUploadProps?.description || "Click to upload image"}
          />
        </div>

        {/* Video Upload */}
        <div className={cn(
          forceRowLayout ? "flex-1" : "w-full"
        )}>
          <VideoUpload
            value={inputVideo}
            onChange={handleVideoChange}
            title={videoUploadProps?.title || "Upload Video"}
            description={videoUploadProps?.description || "Click to upload video"}
          />
        </div>

        {extraControls && (
          <div className={cn(
            forceRowLayout ? "w-full" : "w-full"
          )}>
            {extraControls}
          </div>
        )}

        {/* Generate Button - Same size as inputs */}
        <div className={cn(
          forceRowLayout ? "flex-1" : "w-full"
        )}>
          <Button
            onClick={handleGenerate}
            disabled={!isReady || isGenerating}
            className={cn(
              "w-full h-full min-h-[50px] sm:min-h-[55px] text-sm font-semibold",
              !isReady && "opacity-50 cursor-not-allowed"
            )}
          >
            {isGenerating ? (
              <>
                <CircleNotch className="size-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
