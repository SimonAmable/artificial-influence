"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { CircleNotch, Plus, FilePlus, X } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { VIDEO_MODELS_ALL } from "@/lib/constants/models"
import type { Model, ParameterDefinition } from "@/lib/types/models"
import { ModelIcon } from "@/components/shared/icons/model-icon"
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

interface VideoInputBoxProps {
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
}

export function VideoInputBox({
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
}: VideoInputBoxProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const lastFrameRef = React.useRef<HTMLInputElement>(null)

  // Detect model type
  const isMotionCopyModel = selectedModel.identifier === 'kwaivgi/kling-v2.6-motion-control'
  const isLipsyncModel = selectedModel.identifier.includes('lipsync') || selectedModel.identifier.includes('wav2lip')
  
  // Check if model supports image/last frame based on parameters
  const modelSupportsImage = React.useMemo(() => {
    return selectedModel.parameters.parameters?.some(
      param => param.name === 'image' || param.name === 'first_frame_image'
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

  // Determine if we need prompt
  const needsPrompt = !isMotionCopyModel && !isLipsyncModel

  // Format model name for display
  const formatModelName = (identifier: string, name: string): string => {
    if (name && !name.includes('/')) {
      return name
    }
    const parts = identifier.split('/')
    const shortIdentifier = parts[parts.length - 1]
    return shortIdentifier
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

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

  const renderParameterInput = (param: ParameterDefinition) => {
    const value = parameters[param.name]

    if (param.ui_type === 'select' && 'enum' in param && param.enum) {
      return (
        <Select
          key={param.name}
          value={String(value)}
          onValueChange={(val) => onParametersChange({ ...parameters, [param.name]: val })}
        >
          <SelectTrigger id={param.name} className="h-7 text-xs w-fit min-w-[80px] px-2">
            <SelectValue placeholder={param.label} />
          </SelectTrigger>
          <SelectContent side="top">
            {param.enum.map((option: string) => (
              <SelectItem key={option} value={option} className="text-xs">
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    if (param.ui_type === 'switch' && param.type === 'boolean') {
      return (
        <div key={param.name} className="h-7 flex items-center gap-1.5 px-2 rounded-md border border-border bg-muted/20">
          <Switch
            id={param.name}
            checked={Boolean(value)}
            onCheckedChange={(checked) => onParametersChange({ ...parameters, [param.name]: checked })}
            className="scale-75"
          />
          <Label htmlFor={param.name} className="text-xs cursor-pointer whitespace-nowrap leading-none">
            {param.label}
          </Label>
        </div>
      )
    }

    if (param.ui_type === 'slider' && param.type === 'number') {
      const unit = param.name.includes('duration') ? 's' : ''
      return (
        <div key={param.name} className="h-7 flex items-center gap-1.5 px-2 rounded-md border border-border bg-muted/20 min-w-[100px]">
          <Slider
            id={param.name}
            min={param.min}
            max={param.max}
            step={param.step || 1}
            value={[Number(value)]}
            onValueChange={(vals) => onParametersChange({ ...parameters, [param.name]: vals[0] })}
            className="flex-1"
          />
          <span className="text-xs font-medium text-foreground tabular-nums">{String(value)}{unit}</span>
        </div>
      )
    }

    if (param.ui_type === 'number' && param.type === 'number') {
      const unit = param.name.includes('duration') ? 's' : ''
      return (
        <div key={param.name} className="h-7 flex items-center gap-1.5 px-2 rounded-md border border-border bg-muted/20">
          <Input
            id={param.name}
            type="number"
            min={param.min}
            max={param.max}
            step={param.step || 1}
            value={Number(value)}
            onChange={(e) => onParametersChange({ ...parameters, [param.name]: Number(e.target.value) })}
            className="h-5 text-xs w-12 px-1 border-0 bg-transparent"
          />
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
      )
    }

    return null
  }

  const isReady = React.useMemo(() => {
    // Motion copy model needs image + video
    if (isMotionCopyModel) {
      return !!(inputImage && inputVideo)
    }
    // Lipsync model needs image + audio
    if (isLipsyncModel) {
      return !!(inputImage && inputAudio)
    }
    // For models requiring images, check if images are uploaded
    if (modelSupportsImage || modelSupportsLastFrame) {
      if (modelSupportsImage && !inputImage) return false
      if (modelSupportsLastFrame && !lastFrameImage) return false
      return true
    }
    // For text-only models, check prompt
    return promptValue.trim().length > 0
  }, [promptValue, isMotionCopyModel, isLipsyncModel, modelSupportsImage, modelSupportsLastFrame, inputImage, lastFrameImage, inputVideo, inputAudio])

  // Unified interface structure
  return (
    <Card className={cn("w-full max-w-sm sm:max-w-lg lg:max-w-4xl relative", forceRowLayout && "backdrop-blur-xl bg-background/95 shadow-2xl border-2")}>
      <CardContent className="p-2 flex flex-col gap-1.5">
        {/* Image Previews - Show uploaded images from plus button (only when not using custom upload components) */}
        {!isMotionCopyModel && !isLipsyncModel && (inputImage || lastFrameImage) && (
          <div className="flex gap-2 px-2 pt-1">
            {inputImage && inputImage.url && (
              <div className="relative flex-1 max-w-[200px]">
                <Image
                  src={inputImage.url}
                  alt="Input preview"
                  width={200}
                  height={150}
                  className="w-full h-auto max-h-32 rounded-md object-cover border border-border"
                />
                <button
                  onClick={() => onInputImageChange(null)}
                  className="absolute top-1 right-1 bg-background/80 hover:bg-destructive/80 text-destructive-foreground rounded-full p-1 shadow-sm border border-border z-10 backdrop-blur-sm"
                  aria-label="Remove input image"
                >
                  <X className="size-3" weight="bold" />
                </button>
                <div className="absolute bottom-1 left-1 bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-medium border border-border">
                  {selectedModel.identifier === 'minimax/hailuo-2.3-fast' ? 'First Frame' : 'Input'}
                </div>
              </div>
            )}
            {lastFrameImage && lastFrameImage.url && (
              <div className="relative flex-1 max-w-[200px]">
                <Image
                  src={lastFrameImage.url}
                  alt="Last frame preview"
                  width={200}
                  height={150}
                  className="w-full h-auto max-h-32 rounded-md object-cover border border-border"
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
          </div>
        )}

        {/* 1. PROMPT AT TOP (when needed) */}
        {needsPrompt && (
          <div className="flex items-start gap-2 pt-1 px-2">
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={promptValue}
                onChange={(e) => onPromptChange(e.target.value)}
                onKeyDown={handleTextInputKeyDown}
                placeholder="Describe the video you want to generate..."
                className="w-full border-none outline-none resize-none bg-transparent text-sm min-h-[60px] max-h-[120px] overflow-y-auto"
                rows={3}
              />
              {/* Negative Prompt */}
              {modelSupportsNegativePrompt && (
                <textarea
                  value={negativePromptValue}
                  onChange={(e) => onNegativePromptChange(e.target.value)}
                  placeholder="What to exclude from the video..."
                  className="w-full border-none outline-none resize-none bg-transparent text-xs text-muted-foreground min-h-[40px] max-h-[80px] overflow-y-auto mt-1"
                  rows={2}
                />
              )}
            </div>

            {/* Generate Button */}
            <div className="shrink-0">
              <div
                className={cn(
                  "relative inline-block transition-all duration-300",
                  isReady && "before:content-[''] before:absolute before:inset-[-12px] before:bg-primary before:rounded-full before:blur-[15px] before:opacity-50 before:-z-10"
                )}
              >
                <Button
                  onClick={onGenerate}
                  disabled={!isReady || isGenerating}
                  className={cn(
                    "bg-primary hover:bg-primary/80 text-primary-foreground font-semibold h-10 min-w-[100px] text-sm px-4 py-6 transition-all duration-300 relative z-0",
                    !isReady && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isGenerating ? (
                    <>
                      <CircleNotch className="size-3 mr-1.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate"
                  )}
                </Button>
              </div>
            </div>
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
          {/* Plus button for first frame/last frame (only for models that need it, not motion/lipsync) */}
          {(modelSupportsImage || modelSupportsLastFrame) && !isMotionCopyModel && !isLipsyncModel && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md bg-muted/20 hover:bg-muted/40 border border-border"
                    aria-label="Add image"
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
            </>
          )}

          {/* Model Selector */}
          <Select
            value={selectedModel.identifier}
            onValueChange={(val) => {
              const model = VIDEO_MODELS_ALL.find(m => m.identifier === val)
              if (model) onModelChange(model)
            }}
            disabled={isGenerating}
          >
            <SelectTrigger className="h-7 text-xs w-fit min-w-[140px]">
              <SelectValue placeholder="Select model">
                {selectedModel && (
                  <div className="flex items-center gap-2">
                    <ModelIcon identifier={selectedModel.identifier} size={16} />
                    <span>{formatModelName(selectedModel.identifier, selectedModel.name)}</span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent position="popper" side="top" sideOffset={4}>
              {VIDEO_MODELS_ALL.map((model) => (
                <SelectItem key={model.identifier} value={model.identifier}>
                  <div className="flex items-center gap-3">
                    <div className="rounded-md border border-border bg-muted/30 p-1.5 shrink-0">
                      <ModelIcon identifier={model.identifier} size={20} />
                    </div>
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <span className="font-semibold text-sm">
                        {formatModelName(model.identifier, model.name)}
                      </span>
                      {model.description && (
                        <span className="text-xs text-muted-foreground line-clamp-2">
                          {model.description}
                        </span>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Parameters */}
          {selectedModel.parameters.parameters && selectedModel.parameters.parameters.map((param) => renderParameterInput(param))}

          {/* Generate Button for motion/lipsync models */}
          {(isMotionCopyModel || isLipsyncModel) && (
            <Button
              onClick={onGenerate}
              disabled={!isReady || isGenerating}
              className={cn(
                "ml-auto px-8 py-2 text-sm font-semibold h-7",
                !isReady && "opacity-50 cursor-not-allowed"
              )}
            >
              {isGenerating ? (
                <>
                  <CircleNotch className="size-3 mr-1.5 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate"
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
