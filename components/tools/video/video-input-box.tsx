"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CircleNotch, Plus, FilePlus, X, Sparkle } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import type { Model } from "@/lib/types/models"
import { PhotoUpload, ImageUpload } from "@/components/shared/upload/photo-upload"
import { VideoUpload } from "@/components/shared/upload/video-upload"
import { AudioUpload, AudioUploadValue } from "@/components/shared/upload/audio-upload"
import Image from "next/image"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { VideoPromptFields } from "@/components/tools/video/video-prompt-fields"
import { VideoModelParameterControls } from "@/components/tools/video/video-model-parameter-controls"
import { MultiShotEditor, type MultiShotItem } from "@/components/tools/video/multi-shot-editor"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface VideoInputBoxProps {
  videoModels: Model[]
  forceRowLayout?: boolean
  promptValue: string
  onPromptChange: (value: string) => void
  negativePromptValue: string
  onNegativePromptChange: (value: string) => void
  selectedModel: Model
  onModelChange: (model: Model) => void
  inputImage: ImageUpload | null
  onInputImageChange: (image: ImageUpload | null) => void
  lastFrameImage: ImageUpload | null
  onLastFrameChange: (image: ImageUpload | null) => void
  inputVideo: ImageUpload | null
  onInputVideoChange: (video: ImageUpload | null) => void
  inputAudio: AudioUploadValue | null
  onInputAudioChange: (audio: AudioUploadValue | null) => void
  parameters: Record<string, unknown>
  onParametersChange: (params: Record<string, unknown>) => void
  isGenerating: boolean
  onGenerate: () => void
  /** Kling v3 multi-shot: when true, show multi-shot editor */
  multiShotMode?: boolean
  onMultiShotModeChange?: (enabled: boolean) => void
  multiShotShots?: MultiShotItem[]
  onMultiShotShotsChange?: (shots: MultiShotItem[]) => void
  /** Kling v3 Omni: reference images for elements, scenes, or styles (max 7 without video, 4 with video) */
  referenceImages?: ImageUpload[]
  onReferenceImagesChange?: (images: ImageUpload[]) => void
}

export function VideoInputBox({
  videoModels,
  forceRowLayout = false,
  promptValue,
  onPromptChange,
  negativePromptValue,
  onNegativePromptChange,
  selectedModel,
  onModelChange,
  inputImage,
  onInputImageChange,
  lastFrameImage,
  onLastFrameChange,
  inputVideo,
  onInputVideoChange,
  inputAudio,
  onInputAudioChange,
  parameters,
  onParametersChange,
  isGenerating,
  onGenerate,
  multiShotMode = false,
  onMultiShotModeChange,
  multiShotShots = [],
  onMultiShotShotsChange,
  referenceImages = [],
  onReferenceImagesChange,
}: VideoInputBoxProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const lastFrameRef = React.useRef<HTMLInputElement>(null)
  const videoRef = React.useRef<HTMLInputElement>(null)
  const referenceImagesRef = React.useRef<HTMLInputElement>(null)
  const promptDragCounter = React.useRef(0)
  const [isPromptDragActive, setIsPromptDragActive] = React.useState(false)
  const [draggedMediaKind, setDraggedMediaKind] = React.useState<"image" | "video" | "unknown" | null>(null)



  // Detect model type
  const isMotionCopyModel = selectedModel.identifier === 'kwaivgi/kling-v2.6-motion-control'
  const isLipsyncModel =
    selectedModel.identifier.includes('lipsync') ||
    selectedModel.identifier.includes('wav2lip') ||
    selectedModel.identifier === 'veed/fabric-1.0'
  const isReferenceVideoSupported =
    selectedModel.supports_reference_video === true ||
    selectedModel.identifier === 'xai/grok-imagine-video' ||
    selectedModel.identifier === 'kwaivgi/kling-v3-omni-video'

  // Check if model supports image/last frame based on parameters
  const modelSupportsImage = React.useMemo(() => {
    return selectedModel.parameters.parameters?.some(
      param =>
        param.name === 'image' ||
        param.name === 'first_frame_image' ||
        param.name === 'start_image'
    ) ?? false
  }, [selectedModel])

  const modelSupportsLastFrame = React.useMemo(() => {
    return selectedModel.parameters.parameters?.some(
      param => param.name === 'last_frame'
    ) ?? false
  }, [selectedModel])

  const modelSupportsNegativePrompt = React.useMemo(() => {
    return selectedModel.parameters.parameters?.some(
      param => param.name === 'negative_prompt'
    ) ?? false
  }, [selectedModel])

  const isKlingV3 = selectedModel.identifier === 'kwaivgi/kling-v3-video'
  const isKlingV3Omni = selectedModel.identifier === 'kwaivgi/kling-v3-omni-video'
  const isKlingV3OrOmni = isKlingV3 || isKlingV3Omni
  const totalDuration = Number(parameters.duration) || 5
  const maxReferenceImages = inputVideo ? 4 : 7
  const canAddReferenceImage = isKlingV3Omni && referenceImages.length < maxReferenceImages

  // Determine if we need prompt
  const needsPrompt = !isMotionCopyModel && !isLipsyncModel

  const handleTextInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (isReady) {
        onGenerate()
      }
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'input' | 'lastFrame') => {
    const file = e.target.files?.[0]
    if (file) {
      const imageUpload: ImageUpload = {
        file,
        url: URL.createObjectURL(file)
      }
      if (type === 'input') {
        onInputImageChange(imageUpload)
      } else {
        onLastFrameChange(imageUpload)
      }
    }
  }

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('video/')) {
      const videoUpload: ImageUpload = {
        file,
        url: URL.createObjectURL(file)
      }
      onInputVideoChange(videoUpload)
    }
    e.target.value = ''
  }

  const handleReferenceImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.match(/^image\/(jpeg|jpg|png)$/i)) return
    if (!onReferenceImagesChange || referenceImages.length >= maxReferenceImages) return
    const next: ImageUpload = { file, url: URL.createObjectURL(file) }
    onReferenceImagesChange([...referenceImages, next])
    e.target.value = ''
  }

  const removeReferenceImage = (index: number) => {
    if (!onReferenceImagesChange) return
    onReferenceImagesChange(referenceImages.filter((_, i) => i !== index))
  }

  const isReady = (() => {
    // Motion copy model needs image + video
    if (isMotionCopyModel) {
      return !!(inputImage && inputVideo)
    }
    // Lipsync model needs image + audio
    if (isLipsyncModel) {
      return !!(inputImage && inputAudio)
    }
    // Kling v3 / Omni multi-shot: ready if shots have prompts and total duration matches
    if (isKlingV3OrOmni && multiShotMode && multiShotShots.length > 0) {
      const sum = multiShotShots.reduce((acc, s) => acc + s.duration, 0)
      const validSum = sum === totalDuration
      const hasPrompts = multiShotShots.every((s) => s.prompt.trim().length > 0)
      return validSum && hasPrompts
    }
    // Kling v3 / Omni single-shot: prompt or start image
    if (isKlingV3OrOmni && !multiShotMode) {
      return promptValue.trim().length > 0 || !!inputImage
    }
    // For models requiring images, check if images are uploaded
    if (modelSupportsImage || modelSupportsLastFrame) {
      if (modelSupportsImage && !inputImage) return false
      if (modelSupportsLastFrame && !lastFrameImage) return false
      return true
    }
    // For text-only models, check prompt
    return promptValue.trim().length > 0
  })()

  const canDropReferenceVideo = React.useMemo(() => {
    if (!isReferenceVideoSupported) return false
    return !inputVideo || !isMotionCopyModel
  }, [inputVideo, isMotionCopyModel, isReferenceVideoSupported])

  const nextImageDropSlot = React.useMemo<"input" | "lastFrame" | null>(() => {
    // Motion copy and lipsync always use an image slot
    if (isMotionCopyModel || isLipsyncModel) {
      return "input"
    }

    if (!modelSupportsImage && !modelSupportsLastFrame) return null

    if (modelSupportsImage && !inputImage) return "input"
    if (modelSupportsLastFrame && !lastFrameImage) return "lastFrame"

    if (modelSupportsImage) return "input"
    if (modelSupportsLastFrame) return "lastFrame"
    return null
  }, [
    inputImage,
    isLipsyncModel,
    isMotionCopyModel,
    lastFrameImage,
    modelSupportsImage,
    modelSupportsLastFrame,
  ])

  const nextImageDropLabel = React.useMemo(() => {
    if (nextImageDropSlot === "lastFrame") return isKlingV3OrOmni ? "End Frame" : "Last Frame"
    if (nextImageDropSlot === "input") {
      if (selectedModel.identifier === "minimax/hailuo-2.3-fast") return "First Frame"
      if (isKlingV3OrOmni) return "Start Frame"
      if (isMotionCopyModel || isLipsyncModel) return "Reference Image"
      return "Input Image"
    }
    return "Reference Image"
  }, [isKlingV3OrOmni, isLipsyncModel, isMotionCopyModel, nextImageDropSlot, selectedModel.identifier])

  const canAcceptImageDrop = nextImageDropSlot !== null
  const canAcceptPromptDrop = needsPrompt && (canAcceptImageDrop || canDropReferenceVideo)

  const getDraggedMediaKind = React.useCallback((dataTransfer: DataTransfer): "image" | "video" | "unknown" => {
    const items = Array.from(dataTransfer.items || [])
    const fileItem = items.find((item) => item.kind === "file")
    const mime = fileItem?.type || ""
    if (mime.startsWith("image/")) return "image"
    if (mime.startsWith("video/")) return "video"
    return "unknown"
  }, [])

  const handlePromptDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    promptDragCounter.current = 0
    setIsPromptDragActive(false)
    setDraggedMediaKind(null)

    if (!canAcceptPromptDrop) return
    const file = e.dataTransfer.files?.[0]
    if (!file) return

    if (file.type.startsWith("video/") && canDropReferenceVideo) {
      const videoUpload: ImageUpload = {
        file,
        url: URL.createObjectURL(file),
      }
      onInputVideoChange(videoUpload)
      return
    }

    if (!file.type.startsWith("image/")) return

    const imageUpload: ImageUpload = {
      file,
      url: URL.createObjectURL(file),
    }

    if (nextImageDropSlot === "lastFrame") {
      onLastFrameChange(imageUpload)
      return
    }

    onInputImageChange(imageUpload)
  }, [canAcceptPromptDrop, canDropReferenceVideo, nextImageDropSlot, onInputImageChange, onInputVideoChange, onLastFrameChange])

  const handlePromptDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canAcceptPromptDrop || !e.dataTransfer.types.includes("Files")) return
    const kind = getDraggedMediaKind(e.dataTransfer)
    setDraggedMediaKind(kind)
  }, [canAcceptPromptDrop, getDraggedMediaKind])

  const handlePromptDragEnter = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canAcceptPromptDrop || !e.dataTransfer.types.includes("Files")) return
    const kind = getDraggedMediaKind(e.dataTransfer)
    setDraggedMediaKind(kind)
    promptDragCounter.current += 1
    setIsPromptDragActive(true)
  }, [canAcceptPromptDrop, getDraggedMediaKind])

  const handlePromptDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    promptDragCounter.current -= 1
    if (promptDragCounter.current <= 0) {
      promptDragCounter.current = 0
      setIsPromptDragActive(false)
      setDraggedMediaKind(null)
    }
  }, [])

  const promptDropLabel = React.useMemo(() => {
    if (draggedMediaKind === "video" && canDropReferenceVideo) {
      return "Reference Video"
    }
    if (draggedMediaKind === "image" && canAcceptImageDrop) {
      return nextImageDropLabel
    }
    if (canAcceptImageDrop) return nextImageDropLabel
    if (canDropReferenceVideo) return "Reference Video"
    return "Reference Media"
  }, [canAcceptImageDrop, canDropReferenceVideo, draggedMediaKind, nextImageDropLabel])

  const promptPlaceholderText = needsPrompt
    ? (
      isPromptDragActive && canAcceptPromptDrop
        ? `Drop file to set ${promptDropLabel}...`
        : `Describe the video you want to generate...${canAcceptPromptDrop ? ` (or drag file anywhere in this box to set ${promptDropLabel})` : ""}`
    )
    : "Describe the video you want to generate..."

  // Unified interface structure
  return (
    <Card
      className={cn("w-full max-w-sm sm:max-w-lg lg:max-w-4xl relative", forceRowLayout && "backdrop-blur-xl bg-background/95 shadow-2xl border-2")}
      onDropCapture={handlePromptDrop}
      onDragOverCapture={handlePromptDragOver}
      onDragEnterCapture={handlePromptDragEnter}
      onDragLeaveCapture={handlePromptDragLeave}
    >
      {isPromptDragActive && canAcceptPromptDrop && (
        <div className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] border-2 border-dashed border-primary bg-primary/20" />
      )}
      <CardContent className="p-2 flex flex-col gap-1.5">
        {/* Image/Video Previews - Show uploaded assets from plus button (only when not using custom upload components) */}
        {!isMotionCopyModel && !isLipsyncModel && (inputImage || lastFrameImage || (isReferenceVideoSupported && inputVideo) || (isKlingV3Omni && referenceImages.length > 0)) && (
          <div className="flex flex-wrap gap-2 px-2 pt-1">
            {inputImage && inputImage.url && (
              <div className="relative inline-block">
                <Image
                  src={inputImage.url}
                  alt="Input preview"
                  width={200}
                  height={150}
                  className="w-auto h-auto max-h-32 rounded-md object-contain border border-border"
                />
                <button
                  onClick={() => onInputImageChange(null)}
                  className="absolute top-1 right-1 bg-background/80 hover:bg-destructive/80 text-destructive-foreground rounded-full p-1 shadow-sm border border-border z-10 backdrop-blur-sm"
                  aria-label="Remove input image"
                >
                  <X className="size-3" weight="bold" />
                </button>
                <div className="absolute bottom-1 left-1 bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-medium border border-border">
                  {selectedModel.identifier === 'minimax/hailuo-2.3-fast' ? 'First Frame' : isKlingV3OrOmni ? 'Start Frame' : 'Input'}
                </div>
              </div>
            )}
            {lastFrameImage && lastFrameImage.url && (
              <div className="relative inline-block">
                <Image
                  src={lastFrameImage.url}
                  alt="Last frame preview"
                  width={200}
                  height={150}
                  className="w-auto h-auto max-h-32 rounded-md object-contain border border-border"
                />
                <button
                  onClick={() => onLastFrameChange(null)}
                  className="absolute top-1 right-1 bg-background/80 hover:bg-destructive/80 text-destructive-foreground rounded-full p-1 shadow-sm border border-border z-10 backdrop-blur-sm"
                  aria-label="Remove last frame"
                >
                  <X className="size-3" weight="bold" />
                </button>
                <div className="absolute bottom-1 left-1 bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-medium border border-border">
                  Last Frame
                </div>
              </div>
            )}
            {isReferenceVideoSupported && inputVideo?.url && (
              <div className="relative inline-block">
                <video
                  src={inputVideo.url}
                  className="w-auto h-auto max-h-32 rounded-md object-contain border border-border"
                  muted
                  playsInline
                  preload="metadata"
                />
                <button
                  onClick={() => onInputVideoChange(null)}
                  className="absolute top-1 right-1 bg-background/80 hover:bg-destructive/80 text-destructive-foreground rounded-full p-1 shadow-sm border border-border z-10 backdrop-blur-sm"
                  aria-label="Remove reference video"
                >
                  <X className="size-3" weight="bold" />
                </button>
                <div className="absolute bottom-1 left-1 bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-medium border border-border">
                  Reference Video
                </div>
              </div>
            )}
            {isKlingV3Omni && referenceImages.map((ref, index) => ref.url && (
              <div key={index} className="relative inline-block">
                <Image
                  src={ref.url}
                  alt={`Reference ${index + 1}`}
                  width={80}
                  height={60}
                  className="w-auto h-auto max-h-20 rounded-md object-cover border border-border"
                />
                <button
                  type="button"
                  onClick={() => removeReferenceImage(index)}
                  className="absolute top-0.5 right-0.5 bg-background/80 hover:bg-destructive/80 text-destructive-foreground rounded-full p-1 shadow-sm border border-border z-10 backdrop-blur-sm"
                  aria-label={`Remove reference image ${index + 1}`}
                >
                  <X className="size-2.5" weight="bold" />
                </button>
                <div className="absolute bottom-0.5 left-0.5 bg-background/80 backdrop-blur-sm px-1 py-0.5 rounded text-[9px] font-medium border border-border">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 1. PROMPT AT TOP (when needed) */}
        {needsPrompt && (
          <div className="flex items-start gap-2 pt-1 px-2">
            <VideoPromptFields
              promptValue={promptValue}
              onPromptChange={onPromptChange}
              negativePromptValue={negativePromptValue}
              onNegativePromptChange={onNegativePromptChange}
              showNegativePrompt={modelSupportsNegativePrompt}
              placeholder={promptPlaceholderText}
              variant="page"
              onPromptKeyDown={handleTextInputKeyDown}
            />
          </div>
        )}

        {/* Kling v3 / Omni: Multishot */}
        {isKlingV3OrOmni && onMultiShotModeChange && onMultiShotShotsChange && (
          <div className="px-2 space-y-2 border-t border-border/50 pt-2 mt-1">
            <div className="flex items-center gap-2">
              <Switch
                id="multi-shot-mode"
                checked={multiShotMode}
                onCheckedChange={onMultiShotModeChange}
                disabled={isGenerating}
              />
              <Label htmlFor="multi-shot-mode" className="text-xs font-medium cursor-pointer">
                Multishot
              </Label>
            </div>
            {multiShotMode && (
              <>
                <p className="text-[11px] text-muted-foreground">
                  (up to 6 scenes; shot durations must total {totalDuration}s)
                </p>
                <MultiShotEditor
                  shots={multiShotShots}
                  onShotsChange={onMultiShotShotsChange}
                  totalDuration={totalDuration}
                  maxShots={6}
                  minDurationPerShot={1}
                  disabled={isGenerating}
                />
              </>
            )}
          </div>
        )}

        {/* Kling v3 Omni: Reference images */}
        {isKlingV3Omni && onReferenceImagesChange && (
          <div className="px-2 space-y-1.5 border-t border-border/50 pt-2 mt-1">
            <p className="text-[11px] text-muted-foreground">
              Reference images for elements, scenes, or styles. Supports .jpg/.jpeg/.png. Max {maxReferenceImages} without video, 4 with video.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {referenceImages.length > 0 && referenceImages.map((ref, index) => ref.url && (
                <div key={index} className="relative">
                  <Image
                    src={ref.url}
                    alt={`Ref ${index + 1}`}
                    width={56}
                    height={56}
                    className="size-12 rounded-md object-cover border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => removeReferenceImage(index)}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow border border-border"
                    aria-label={`Remove reference ${index + 1}`}
                  >
                    <X className="size-2.5" weight="bold" />
                  </button>
                </div>
              ))}
              {canAddReferenceImage && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-12 w-12 rounded-md border-dashed p-0"
                  onClick={() => referenceImagesRef.current?.click()}
                  disabled={isGenerating}
                  aria-label="Add reference image"
                >
                  <Plus className="size-5" weight="bold" />
                </Button>
              )}
            </div>
            <input
              ref={referenceImagesRef}
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              onChange={handleReferenceImageAdd}
              className="hidden"
            />
          </div>
        )}

        {/* 2. CUSTOM UPLOAD COMPONENTS IN MIDDLE (only for motion-copy and lipsync) */}
        {isMotionCopyModel && (
          <div className="flex gap-1.5 sm:gap-2 px-2">
            <div className="flex-1">
              <PhotoUpload
                value={inputImage}
                onChange={onInputImageChange}
                title="Upload Image"
                description="Click to upload"
              />
            </div>
            <div className="flex-1">
              <VideoUpload
                value={inputVideo}
                onChange={onInputVideoChange}
                title="Upload Video"
                description="Click to upload"
              />
            </div>
          </div>
        )}

        {isLipsyncModel && (
          <div className="flex gap-1.5 sm:gap-2 px-2">
            <div className="flex-1">
              <PhotoUpload
                value={inputImage}
                onChange={onInputImageChange}
                title="Upload Image"
                description="Click to upload"
              />
            </div>
            <div className="flex-1">
              <AudioUpload
                value={inputAudio}
                onChange={onInputAudioChange}
                title="Upload Audio"
                description="Click to upload"
              />
            </div>
          </div>
        )}

        {/* 3. BOTTOM ROW: Plus button + Model Selector + Parameters + Generate (for upload models) */}
        <div className="flex flex-wrap items-center gap-1.5 px-2">
          {/* Plus button for first frame / last frame / reference video (only for models that need it, not motion/lipsync) */}
          {(modelSupportsImage || modelSupportsLastFrame || isReferenceVideoSupported) && !isMotionCopyModel && !isLipsyncModel && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-md bg-muted/20 hover:bg-muted/40 border border-border"
                    aria-label="Add image or video"
                  >
                    <Plus className="size-3.5" weight="bold" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {modelSupportsImage && (
                    <DropdownMenuItem onClick={() => inputRef.current?.click()}>
                      <FilePlus className="size-4 mr-2" />
                      {selectedModel.identifier === 'minimax/hailuo-2.3-fast' ? 'Upload First Frame' : 'Upload Input Image'}
                    </DropdownMenuItem>
                  )}
                  {modelSupportsLastFrame && (
                    <DropdownMenuItem onClick={() => lastFrameRef.current?.click()}>
                      <FilePlus className="size-4 mr-2" />
                      Upload Last Frame
                    </DropdownMenuItem>
                  )}
                  {isReferenceVideoSupported && (
                    <DropdownMenuItem onClick={() => videoRef.current?.click()}>
                      <FilePlus className="size-4 mr-2" />
                      Upload Reference Video
                    </DropdownMenuItem>
                  )}
                  {canAddReferenceImage && (
                    <DropdownMenuItem onClick={() => referenceImagesRef.current?.click()}>
                      <FilePlus className="size-4 mr-2" />
                      Add reference image
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Hidden file inputs */}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'input')}
                className="hidden"
              />
              <input
                ref={lastFrameRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'lastFrame')}
                className="hidden"
              />
              <input
                ref={videoRef}
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="hidden"
              />
            </>
          )}

          <VideoModelParameterControls
            videoModels={videoModels}
            selectedModel={selectedModel}
            onModelChange={onModelChange}
            parameters={parameters}
            onParametersChange={onParametersChange}
            disabled={isGenerating}
            variant="page"
            referenceVideoProvided={!!inputVideo}
          />

          <div className="flex-1" />

          {/* Generate Button - always on right */}
          <Button
            onClick={onGenerate}
            disabled={!isReady || isGenerating}
            size="sm"
            className={cn(
              "shrink-0 px-4 text-sm font-semibold h-8",
              !isReady && "opacity-50 cursor-not-allowed"
            )}
          >
            {isGenerating ? (
              <>
                <CircleNotch className="size-3 mr-1.5 animate-spin" />
                Generating...
              </>
            ) : (
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-sm font-semibold">Generate</span>
                <div className="flex items-center gap-0.5">
                  <Sparkle size={8} weight="fill" />
                  <span className="text-[10px]">
                    {selectedModel.model_cost != null
                      ? selectedModel.model_cost
                      : "—"}
                  </span>
                </div>
              </div>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
