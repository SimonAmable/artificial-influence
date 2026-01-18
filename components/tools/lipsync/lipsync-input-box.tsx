"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PhotoUpload, ImageUpload } from "@/components/shared/upload/photo-upload"
import { AudioUpload, AudioUploadValue } from "@/components/shared/upload/audio-upload"
import { cn } from "@/lib/utils"
import { CircleNotch } from "@phosphor-icons/react"

interface LipsyncInputBoxProps {
  className?: string
  onImageChange?: (image: ImageUpload | null) => void
  onAudioChange?: (audio: AudioUploadValue | null) => void
  onGenerate?: () => void
  defaultImage?: ImageUpload
  defaultAudio?: AudioUploadValue
  isGenerating?: boolean
  forceRowLayout?: boolean
  photoUploadProps?: Partial<React.ComponentProps<typeof PhotoUpload>>
  audioUploadProps?: Partial<React.ComponentProps<typeof AudioUpload>>
  uploadContainerClassName?: string
}

export function LipsyncInputBox({
  className,
  onImageChange,
  onAudioChange,
  onGenerate,
  defaultImage,
  defaultAudio,
  isGenerating = false,
  forceRowLayout: _forceRowLayout = false,
  photoUploadProps,
  audioUploadProps,
  uploadContainerClassName,
}: LipsyncInputBoxProps) {
  const [inputImage, setInputImage] = React.useState<ImageUpload | null>(defaultImage || null)
  const [inputAudio, setInputAudio] = React.useState<AudioUploadValue | null>(defaultAudio || null)

  // Sync with external changes
  React.useEffect(() => {
    if (defaultImage !== undefined) {
      setInputImage(defaultImage || null)
    }
  }, [defaultImage])

  React.useEffect(() => {
    if (defaultAudio !== undefined) {
      setInputAudio(defaultAudio || null)
    }
  }, [defaultAudio])

  const handleImageChange = (image: ImageUpload | null) => {
    setInputImage(image)
    onImageChange?.(image)
  }

  const handleAudioChange = (audio: AudioUploadValue | null) => {
    setInputAudio(audio)
    onAudioChange?.(audio)
  }

  const handleGenerate = () => {
    if (onGenerate && inputImage && inputAudio) {
      onGenerate()
    }
  }

  // Determine if button is ready (both image and audio are required)
  const isReady = React.useMemo(() => {
    return !!(inputImage && inputAudio)
  }, [inputImage, inputAudio])

  return (
    <Card className={cn("w-full max-w-sm sm:max-w-lg lg:max-w-4xl relative", className)}>
      <CardContent className="pt-1.5 flex flex-col gap-1.5 px-4 sm:px-6">
        {/* Image and Audio Uploads */}
        <div className={cn(
          "flex gap-1.5 sm:gap-2",
          uploadContainerClassName
        )}>
          <div className="flex-1">
            <PhotoUpload
              value={inputImage}
              onChange={handleImageChange}
              title="Upload Image"
              description="Click to upload image"
              {...photoUploadProps}
            />
          </div>
          <div className="flex-1">
            <AudioUpload
              value={inputAudio}
              onChange={handleAudioChange}
              title="Upload Audio"
              description="Click to upload audio"
              {...audioUploadProps}
            />
          </div>
        </div>

        {/* Generate Button */}
        <div className="flex justify-center pt-1.5 pb-1.5">
          <Button
            onClick={handleGenerate}
            disabled={!isReady || isGenerating}
            className={cn(
              "w-full sm:w-auto px-8 py-2 text-sm font-semibold",
              !isReady && "opacity-50 cursor-not-allowed"
            )}
          >
            {isGenerating ? (
              <>
                <CircleNotch className="size-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Lipsync"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
