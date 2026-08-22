"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PhotoUpload, ImageUpload } from "@/components/shared/upload/photo-upload"
import { VideoUpload } from "@/components/shared/upload/video-upload"
import { CircleNotch } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import {
  AssetSelectionModal,
  type AssetSelectionPick,
} from "@/components/shared/modals/asset-selection-modal"
import { MotionCopyPromptField } from "@/components/tools/motion-copy/motion-copy-prompt-field"

export interface MotionCopyInputBoxProps {
  className?: string
  onImageChange?: (image: ImageUpload | null) => void
  onVideoChange?: (video: ImageUpload | null) => void
  onGenerate?: () => void
  defaultImage?: ImageUpload | null
  defaultVideo?: ImageUpload | null
  isGenerating?: boolean
  forceRowLayout?: boolean
  /** Override generate button label (e.g. Preview swap · 4 cr). */
  generateLabel?: string
  generatingLabel?: string
  photoUploadProps?: {
    title?: string
    description?: string
    /** Override preview tile sizing (defaults are old 45px cap + ~27–31px). */
    maxHeight?: string
    minHeight?: string
  }
  videoUploadProps?: {
    title?: string
    description?: string
    /** Motion copy: 10 for image orientation, 30 for video orientation */
    maxDurationSeconds?: number
    maxHeight?: string
    minHeight?: string
  }
  extraControls?: React.ReactNode
  promptValue?: string
  onPromptChange?: (value: string) => void
}

/** Old shared upload default was max-h-[45px]; motion copy uses a modest bump only (+27..+31px). */
const MOTION_COPY_PREVIEW = {
  maxHeight: "max-h-[72px] sm:max-h-[76px]",
  minHeight: "min-h-[52px] sm:min-h-[58px]",
} as const

export function MotionCopyInputBox({
  className,
  onImageChange,
  onVideoChange,
  onGenerate,
  defaultImage,
  defaultVideo,
  isGenerating = false,
  forceRowLayout = false,
  generateLabel = "Generate",
  generatingLabel = "Generating...",
  photoUploadProps,
  videoUploadProps,
  extraControls,
  promptValue = "",
  onPromptChange,
}: MotionCopyInputBoxProps) {
  const [inputImage, setInputImage] = React.useState<ImageUpload | null>(defaultImage || null)
  const [inputVideo, setInputVideo] = React.useState<ImageUpload | null>(defaultVideo || null)
  const [assetTarget, setAssetTarget] = React.useState<"image" | "video" | null>(null)

  const maxVideoDurationSeconds = videoUploadProps?.maxDurationSeconds ?? 10

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

  const handleAssetSelect = React.useCallback(
    (pick: AssetSelectionPick) => {
      if (assetTarget === "image") {
        const image = { url: pick.url }
        setInputImage(image)
        onImageChange?.(image)
      } else if (assetTarget === "video") {
        const video = { url: pick.url }
        setInputVideo(video)
        onVideoChange?.(video)
      }
      setAssetTarget(null)
    },
    [assetTarget, onImageChange, onVideoChange],
  )

  const handleGenerate = () => {
    if (onGenerate && inputImage?.url && inputVideo?.url) {
      onGenerate()
    }
  }

  // Determine if button is ready (both image and video are required)
  const isReady = React.useMemo(() => {
    return !!(inputImage?.url && inputVideo?.url)
  }, [inputImage, inputVideo])

  return (
    <Card className={cn("w-full max-w-sm sm:max-w-lg lg:max-w-4xl relative", className)}>
      <CardContent className={cn(
        "pt-1.5 pb-1.5 flex gap-1.5 sm:gap-2 px-4 sm:px-6",
        forceRowLayout ? "flex-row items-stretch flex-wrap" : "flex-col",
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
            maxHeight={photoUploadProps?.maxHeight ?? MOTION_COPY_PREVIEW.maxHeight}
            minHeight={photoUploadProps?.minHeight ?? MOTION_COPY_PREVIEW.minHeight}
            showSourceActions
            enablePaste
            onChooseAsset={() => setAssetTarget("image")}
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
            maxDurationSeconds={maxVideoDurationSeconds}
            maxHeight={videoUploadProps?.maxHeight ?? MOTION_COPY_PREVIEW.maxHeight}
            minHeight={videoUploadProps?.minHeight ?? MOTION_COPY_PREVIEW.minHeight}
            showSourceActions
            onChooseAsset={() => setAssetTarget("video")}
          />
        </div>

        <div className="w-full px-0.5 pt-0.5">
          <MotionCopyPromptField
            value={promptValue}
            onChange={(value) => onPromptChange?.(value)}
            onGenerate={handleGenerate}
            disabled={isGenerating}
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
                {generatingLabel}
              </>
            ) : (
              generateLabel
            )}
          </Button>
        </div>
      </CardContent>

      <AssetSelectionModal
        open={assetTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAssetTarget(null)
        }}
        onSelect={handleAssetSelect}
        allowedAssetTypes={assetTarget === "video" ? ["video"] : ["image"]}
        defaultTab="assets"
      />
    </Card>
  )
}
