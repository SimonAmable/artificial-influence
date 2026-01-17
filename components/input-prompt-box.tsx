"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, X, UserList, FilePlus } from "@phosphor-icons/react"
import { PhotoUpload, ImageUpload } from "./photo-upload"
import { VideoUpload } from "./video-upload"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface InputPromptBoxProps {
  className?: string
  onImageChange?: (image: ImageUpload | null) => void
  onVideoChange?: (video: ImageUpload | null) => void
  onModelChange?: (model: string) => void
  onAspectRatioChange?: (aspectRatio: string) => void
  onResolutionChange?: (resolution: string) => void
  onQualityChange?: (quality: string) => void
  onGenerate?: () => void
  defaultImage?: ImageUpload
  defaultVideo?: ImageUpload
  defaultModel?: string
  defaultAspectRatio?: string
  defaultResolution?: string
  defaultQuality?: string
  generateCredits?: number
  forceRowLayout?: boolean
  showPhotoUpload?: boolean
  showVideoUpload?: boolean
  photoUploadProps?: Partial<React.ComponentProps<typeof PhotoUpload>>
  videoUploadProps?: Partial<React.ComponentProps<typeof VideoUpload>>
  uploadContainerClassName?: string
  showPlusButton?: boolean
  onPlusClick?: () => void
  onChooseAvatar?: () => void
  onReferenceImageChange?: (image: ImageUpload | null) => void
  defaultReferenceImage?: ImageUpload
  showTextInput?: boolean
  textInputValue?: string
  onTextInputChange?: (value: string) => void
  textInputPlaceholder?: string
  textInputClassName?: string
  enhancePrompt?: boolean
  onEnhancePromptChange?: (enabled: boolean) => void
  showEnhancePrompt?: boolean
  showModelSelect?: boolean
  showAspectRatioSelect?: boolean
  showResolutionSelect?: boolean
  showQualitySelect?: boolean
}

// Aspect ratio icon component
function AspectRatioIcon({ ratio }: { ratio: string }) {
  const getIconStyle = () => {
    switch (ratio) {
      case "1:1":
        return "w-3 h-3" // Square
      case "9:16":
        return "w-2 h-3" // Vertical (portrait)
      case "16:9":
        return "w-3 h-2" // Horizontal (landscape)
      case "4:3":
        return "w-3 h-2.5" // Slightly horizontal
      case "3:4":
        return "w-2.5 h-3" // Slightly vertical
      default:
        return "w-3 h-3"
    }
  }

  return (
    <div
      className={cn(
        "border-2 border-foreground/60 rounded-[2px] shrink-0",
        getIconStyle()
      )}
    />
  )
}

export function InputPromptBox({
  className,
  onImageChange,
  onVideoChange,
  onModelChange,
  onAspectRatioChange,
  onResolutionChange,
  onQualityChange,
  onGenerate,
  defaultImage,
  defaultVideo,
  defaultModel = "Wan 2.2 Replace",
  defaultAspectRatio = "9:16",
  defaultResolution = "580p",
  defaultQuality = "Standard",
  generateCredits = 18,
  forceRowLayout = false,
  showPhotoUpload = true,
  showVideoUpload = true,
  photoUploadProps,
  videoUploadProps,
  uploadContainerClassName,
  showPlusButton = false,
  onPlusClick,
  onChooseAvatar,
  onReferenceImageChange,
  defaultReferenceImage,
  showTextInput = false,
  textInputValue,
  onTextInputChange,
  textInputPlaceholder = "Enter text...",
  textInputClassName,
  enhancePrompt = false,
  onEnhancePromptChange,
  showEnhancePrompt = true,
  showModelSelect = true,
  showAspectRatioSelect = true,
  showResolutionSelect = true,
  showQualitySelect = true,
}: InputPromptBoxProps) {
  const [inputImage, setInputImage] = React.useState<ImageUpload | null>(defaultImage || null)
  const [inputVideo, setInputVideo] = React.useState<ImageUpload | null>(defaultVideo || null)
  const [model, setModel] = React.useState(defaultModel)
  const [aspectRatio, setAspectRatio] = React.useState(defaultAspectRatio)
  const [resolution, setResolution] = React.useState(defaultResolution)
  const [quality, setQuality] = React.useState(defaultQuality)
  const [localTextInput, setLocalTextInput] = React.useState(textInputValue || "")
  const [referenceImage, setReferenceImage] = React.useState<ImageUpload | null>(defaultReferenceImage || null)
  const [isFullScreenPreviewOpen, setIsFullScreenPreviewOpen] = React.useState(false)
  const [localEnhancePrompt, setLocalEnhancePrompt] = React.useState(enhancePrompt)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleImageChange = (image: ImageUpload | null) => {
    setInputImage(image)
    onImageChange?.(image)
  }

  const handleVideoChange = (video: ImageUpload | null) => {
    setInputVideo(video)
    onVideoChange?.(video)
  }

  const handleTextInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setLocalTextInput(value)
    onTextInputChange?.(value)
  }

  const handleTextInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // If Enter is pressed without Shift, trigger generate
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (localTextInput.trim().length > 0 && onGenerate) {
        onGenerate()
      }
    }
  }

  React.useEffect(() => {
    if (textInputValue !== undefined) {
      setLocalTextInput(textInputValue)
    }
  }, [textInputValue])

  React.useEffect(() => {
    setLocalEnhancePrompt(enhancePrompt)
  }, [enhancePrompt])

  const handleEnhancePromptChange = (checked: boolean) => {
    setLocalEnhancePrompt(checked)
    onEnhancePromptChange?.(checked)
  }

  const handleReferenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      const newImage = { file, url }
      setReferenceImage(newImage)
      onReferenceImageChange?.(newImage)
    }
  }

  const handleReferenceImageRemove = () => {
    if (referenceImage?.url) {
      URL.revokeObjectURL(referenceImage.url)
    }
    setReferenceImage(null)
    onReferenceImageChange?.(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleChooseAvatar = () => {
    onChooseAvatar?.()
  }

  const handleUploadReferenceImage = () => {
    fileInputRef.current?.click()
  }

  const handleImagePreviewClick = () => {
    setIsFullScreenPreviewOpen(true)
  }

  const handleCloseFullScreenPreview = React.useCallback(() => {
    setIsFullScreenPreviewOpen(false)
  }, [])

  // Handle escape key to close full screen preview
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullScreenPreviewOpen) {
        handleCloseFullScreenPreview()
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isFullScreenPreviewOpen, handleCloseFullScreenPreview])

  // Determine if button is ready (has text input OR has required uploads)
  const isReady = React.useMemo(() => {
    if (showTextInput) {
      return localTextInput.trim().length > 0
    }
    // If no text input, check if we have required uploads
    // For motion copy: both image and video are required
    if (showPhotoUpload && showVideoUpload) {
      return !!(inputImage && inputVideo)
    }
    // If only one upload type, that one is required
    if (showPhotoUpload) {
      return !!inputImage
    }
    if (showVideoUpload) {
      return !!inputVideo
    }
    // Default: always ready if no requirements
    return true
  }, [localTextInput, showTextInput, showPhotoUpload, showVideoUpload, inputImage, inputVideo])

  return (
    <Card className={cn("w-full max-w-sm sm:max-w-lg lg:max-w-4xl relative", className)}>
      <CardContent className="pt-1.5 flex flex-col gap-1.5 px-4 sm:px-6">
        {/* Plus Button and Image Preview - Top Left */}
        {showPlusButton && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-muted hover:bg-muted/80"
                  aria-label="Add"
                >
                  <Plus className="size-4" weight="bold" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={handleChooseAvatar}>
                  <UserList className="size-4 mr-2" />
                  Choose Avatar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleUploadReferenceImage}>
                  <FilePlus className="size-4 mr-2" />
                  Upload Reference Image
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Image Preview */}
            {referenceImage?.url && (
              <div className="relative">
                <img
                  src={referenceImage.url}
                  alt="Reference image preview"
                  className="h-8 w-auto max-w-32 rounded-lg object-contain border border-border cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={handleImagePreviewClick}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleReferenceImageRemove()
                  }}
                  className="absolute -top-1 -right-1 bg-background hover:bg-destructive text-destructive-foreground rounded-full p-0.5 shadow-sm border border-border z-10"
                  aria-label="Remove reference image"
                >
                  <X className="size-3" weight="bold" />
                </button>
              </div>
            )}
            
            {/* Hidden file input for reference image */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleReferenceImageUpload}
              className="hidden"
            />
          </div>
        )}

        {/* Prompt Box - Textarea with no background or styling */}
        {showTextInput && (
          <div className="pt-4">
            <textarea
              value={localTextInput}
              onChange={handleTextInputChange}
              onKeyDown={handleTextInputKeyDown}
              placeholder={textInputPlaceholder}
              className={cn("w-full border-none outline-none resize-none bg-transparent", textInputClassName)}
            />
          </div>
        )}

        {/* Image and Video Uploads */}
        {(showPhotoUpload || showVideoUpload) && (
          <div className={cn(
            "flex gap-1.5 sm:gap-2",
            uploadContainerClassName
          )}>
            {showPhotoUpload && (
              <div className="flex-1">
                <PhotoUpload
                  value={inputImage}
                  onChange={handleImageChange}
                  {...photoUploadProps}
                />
              </div>
            )}
            {showVideoUpload && (
              <div className="flex-1">
                <VideoUpload
                  value={inputVideo}
                  onChange={handleVideoChange}
                  {...videoUploadProps}
                />
              </div>
            )}
          </div>
        )}

        {/* Prompt Enhancement Toggle */}
        {showEnhancePrompt && (
          <div className="flex items-center gap-2 pb-1">
            <Switch
              id="enhance-prompt"
              checked={localEnhancePrompt}
              onCheckedChange={handleEnhancePromptChange}
            />
            <Label
              htmlFor="enhance-prompt"
              className="text-xs sm:text-sm cursor-pointer"
            >
              Enhance Prompt
            </Label>
          </div>
        )}

        {/* Model, Resolution, and Generate - Row on mobile, column on desktop */}
        <div className={cn(
          "flex gap-1.5 sm:gap-2 items-start",
          forceRowLayout ? "flex-row" : "flex-row lg:flex-col lg:gap-2 lg:items-stretch"
        )}>
          {/* Model, Aspect Ratio, and Resolution grouped together on the left */}
          <div className={cn(
            "flex gap-1 sm:gap-1.5 items-start",
            forceRowLayout ? "flex-1" : "flex-1 lg:flex-none"
          )}>
            {/* Model Selection */}
            {showModelSelect && (
              <div className={cn(forceRowLayout ? "" : "flex-1 lg:flex-none")}>
                <Select value={model} onValueChange={(value) => {
                  setModel(value)
                  onModelChange?.(value)
                }}>
                  <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Wan 2.2 Replace">Wan 2.2 Replace</SelectItem>
                    <SelectItem value="Wan 2.2 Animate">Wan 2.2 Animate</SelectItem>
                    <SelectItem value="Wan 2.1">Wan 2.1</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Aspect Ratio Selection */}
            {showAspectRatioSelect && (
              <div className={cn(forceRowLayout ? "" : "flex-1 lg:flex-none")}>
                <Select value={aspectRatio} onValueChange={(value) => {
                  setAspectRatio(value)
                  onAspectRatioChange?.(value)
                }}>
                  <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <AspectRatioIcon ratio={aspectRatio} />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1:1">1:1</SelectItem>
                    <SelectItem value="9:16">9:16</SelectItem>
                    <SelectItem value="16:9">16:9</SelectItem>
                    <SelectItem value="4:3">4:3</SelectItem>
                    <SelectItem value="3:4">3:4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Resolution Selection */}
            {showResolutionSelect && (
              <div className={cn(forceRowLayout ? "" : "flex-1 lg:flex-none")}>
                <Select value={resolution} onValueChange={(value) => {
                  setResolution(value)
                  onResolutionChange?.(value)
                }}>
                  <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="480p">480p</SelectItem>
                    <SelectItem value="580p">580p</SelectItem>
                    <SelectItem value="720p">720p</SelectItem>
                    <SelectItem value="1080p">1080p</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Quality Selection */}
            {showQualitySelect && (
              <div className={cn(forceRowLayout ? "" : "flex-1 lg:flex-none")}>
                <Select value={quality} onValueChange={(value) => {
                  setQuality(value)
                  onQualityChange?.(value)
                }}>
                  <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Standard">Standard</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Generate Button - Right side, vertically centered with selects, same size as selects */}
          <div className={cn(
            "flex items-center",
            forceRowLayout ? "pt-6" : "pt-6 lg:flex-none lg:items-stretch lg:pt-0"
          )}>
            <div
              className={cn(
                "relative inline-block transition-all duration-300",
                isReady && "before:content-[''] before:absolute before:inset-[-12px] before:bg-primary before:rounded-full before:blur-[15px] before:opacity-50 before:-z-10"
              )}
            >
              <Button
                onClick={onGenerate}
                disabled={!isReady}
                className={cn(
                  "bg-primary hover:bg-primary/80 text-primary-foreground font-semibold h-8 sm:h-9 text-xs sm:text-sm transition-all duration-300 relative z-0",
                  !isReady && "opacity-50 cursor-not-allowed"
                )}
              >
                Generate
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Full Screen Image Preview */}
      {isFullScreenPreviewOpen && referenceImage?.url && (
        <div
          className="fixed inset-0 z-100 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleCloseFullScreenPreview}
        >
          <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={referenceImage.url}
              alt="Reference image full screen"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <button
              onClick={handleCloseFullScreenPreview}
              className="absolute top-4 right-4 bg-background/80 hover:bg-background text-foreground rounded-full p-2 shadow-lg border border-border"
              aria-label="Close full screen preview"
            >
              <X className="size-5" weight="bold" />
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}
