"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, X, FilePlus } from "@phosphor-icons/react"
import { ImageUpload } from "@/components/shared/upload/photo-upload"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { CircleNotch } from "@phosphor-icons/react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Model } from "@/lib/types/models"
import { createClient } from "@/lib/supabase/client"
import { ModelIcon } from "@/components/shared/icons/model-icon"
import { AspectRatioSelector } from "@/components/shared/selectors/aspect-ratio-selector"

interface InfluencerInputBoxProps {
  className?: string
  onGenerate?: () => void
  promptValue?: string
  onPromptChange?: (value: string) => void
  referenceImage?: ImageUpload | null
  onReferenceImageChange?: (image: ImageUpload | null) => void
  enhancePrompt?: boolean
  onEnhancePromptChange?: (enabled: boolean) => void
  isGenerating?: boolean
  forceRowLayout?: boolean
  placeholder?: string
  selectedModel?: string
  onModelChange?: (modelIdentifier: string) => void
  showModelSelector?: boolean
  selectedAspectRatio?: string
  onAspectRatioChange?: (aspectRatio: string) => void
  showAspectRatioSelector?: boolean
  aspectRatio1to1?: boolean
  onAspectRatio1to1Change?: (checked: boolean) => void
  showAspectRatio1to1Checkbox?: boolean
}

export function InfluencerInputBox({
  className,
  onGenerate,
  promptValue = "",
  onPromptChange,
  referenceImage,
  onReferenceImageChange,
  enhancePrompt = false,
  onEnhancePromptChange,
  isGenerating = false,
  forceRowLayout: _forceRowLayout = false,
  placeholder = "Enter your prompt...",
  selectedModel,
  onModelChange,
  showModelSelector = false,
  selectedAspectRatio,
  onAspectRatioChange,
  showAspectRatioSelector = false,
  aspectRatio1to1 = false,
  onAspectRatio1to1Change,
  showAspectRatio1to1Checkbox = false,
}: InfluencerInputBoxProps) {
  const [localPrompt, setLocalPrompt] = React.useState(promptValue)
  const [localReferenceImage, setLocalReferenceImage] = React.useState<ImageUpload | null>(referenceImage || null)
  const [isFullScreenPreviewOpen, setIsFullScreenPreviewOpen] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [models, setModels] = React.useState<Model[]>([])
  const [loadingModels, setLoadingModels] = React.useState(false)

  // Sync with external changes
  React.useEffect(() => {
    if (promptValue !== undefined) {
      setLocalPrompt(promptValue)
    }
  }, [promptValue])

  React.useEffect(() => {
    if (referenceImage !== undefined) {
      setLocalReferenceImage(referenceImage)
    }
  }, [referenceImage])

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setLocalPrompt(value)
    onPromptChange?.(value)
  }

  const handleTextInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // If Enter is pressed without Shift, trigger generate
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (localPrompt.trim().length > 0 && onGenerate) {
        onGenerate()
      }
    }
  }

  const handleReferenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      const newImage = { file, url }
      setLocalReferenceImage(newImage)
      onReferenceImageChange?.(newImage)
    }
  }

  const handleReferenceImageRemove = () => {
    if (localReferenceImage?.url) {
      URL.revokeObjectURL(localReferenceImage.url)
    }
    setLocalReferenceImage(null)
    onReferenceImageChange?.(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
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

  // Helper function to format model name (remove prefix, show short form)
  const formatModelName = (identifier: string, name: string): string => {
    // Use the name from database if it exists and doesn't contain "/"
    // The database names are already formatted without prefixes
    if (name && !name.includes('/')) {
      return name
    }
    
    // Fallback: Extract the part after the last "/" from identifier
    const parts = identifier.split('/')
    const shortIdentifier = parts[parts.length - 1]
    
    // Replace hyphens with spaces and capitalize words
    return shortIdentifier
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Fetch models if model selector is enabled
  React.useEffect(() => {
    if (showModelSelector) {
      setLoadingModels(true)
      const supabase = createClient()
      
      const fetchModels = async () => {
        try {
          const { data: modelsData, error } = await supabase
            .from('models')
            .select('*')
            .eq('type', 'image')
            .eq('is_active', true)
            .order('name', { ascending: true })
          
          if (error) {
            console.error('Error fetching models:', error)
            return
          }
          
          if (modelsData) {
            setModels(modelsData as Model[])
            // Set default model if none selected
            if (!selectedModel && modelsData.length > 0 && onModelChange) {
              onModelChange(modelsData[0].identifier)
            }
          }
        } catch (err) {
          console.error('Error fetching models:', err)
        } finally {
          setLoadingModels(false)
        }
      }
      
      fetchModels()
    }
  }, [showModelSelector, selectedModel, onModelChange])

  // Find the selected model object
  const selectedModelObject = React.useMemo(() => {
    if (!selectedModel) return null
    return models.find(m => m.identifier === selectedModel) || null
  }, [selectedModel, models])

  // Determine if button is ready (prompt must not be empty)
  const isReady = React.useMemo(() => {
    return localPrompt.trim().length > 0
  }, [localPrompt])

  return (
    <Card className={cn("w-full max-w-sm sm:max-w-lg lg:max-w-4xl relative", className)}>
      <CardContent className="p-2 flex flex-col gap-1.5">
        {/* Image Preview - Above Text Input */}
        {localReferenceImage?.url && (
          <div className="relative w-full">
            <img
              src={localReferenceImage.url}
              alt="Reference image preview"
              className="w-full max-h-48 rounded object-contain border border-border cursor-pointer hover:opacity-80 transition-opacity"
              onClick={handleImagePreviewClick}
            />
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleReferenceImageRemove()
              }}
              className="absolute top-1.5 right-1.5 bg-background hover:bg-destructive text-destructive-foreground rounded-full p-1 shadow-sm border border-border z-10"
              aria-label="Remove reference image"
            >
              <X className="size-3" weight="bold" />
            </button>
          </div>
        )}

        {/* Textarea and Generate Button - Side by Side */}
        <div className="flex items-start gap-2 pt-1 px-2">
          {/* Textarea */}
          <div className="flex-1">
            <textarea
              value={localPrompt}
              onChange={handlePromptChange}
              onKeyDown={handleTextInputKeyDown}
              placeholder={placeholder}
              className="w-full border-none outline-none resize-none bg-transparent text-sm min-h-[60px] max-h-[120px] overflow-y-auto"
              rows={3}
            />
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

        {/* Controls: Add Reference Image, Model Selector, Enhance Prompt */}
        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full bg-muted hover:bg-muted/80"
                aria-label="Add reference image"
              >
                <Plus className="size-3.5" weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={handleUploadReferenceImage}>
                <FilePlus className="size-4 mr-2" />
                Upload Reference Image
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Model Selector (if enabled) */}
          {showModelSelector && (
            <Select
              value={selectedModel || ""}
              onValueChange={(value) => onModelChange?.(value)}
              disabled={loadingModels || isGenerating}
            >
              <SelectTrigger id="model-select" className="h-7 text-xs w-fit min-w-[120px]">
                <SelectValue placeholder={loadingModels ? "Loading..." : "Select model"}>
                  {selectedModel && (() => {
                    const model = models.find(m => m.identifier === selectedModel)
                    return (
                      <div className="flex items-center gap-2">
                        <ModelIcon identifier={selectedModel} size={16} />
                        <span>{model ? formatModelName(model.identifier, model.name) : selectedModel}</span>
                      </div>
                    )
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent position="popper" side="top" sideOffset={4}>
                {models.map((model) => (
                  <SelectItem key={model.identifier} value={model.identifier}>
                    <div className="flex items-center gap-3">
                      {/* Icon in small card */}
                      <div className="rounded-md border border-border bg-muted/30 p-1.5 shrink-0">
                        <ModelIcon identifier={model.identifier} size={20} />
                      </div>
                      {/* Text content */}
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <span className="font-semibold text-sm">
                          {formatModelName(model.identifier, model.name)}
                        </span>
                        {model.description && (
                          <span className="text-xs text-muted-foreground">
                            {model.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Aspect Ratio Selector (if enabled) */}
          {showAspectRatioSelector && (
            <AspectRatioSelector
              model={selectedModelObject}
              value={selectedAspectRatio}
              onValueChange={onAspectRatioChange}
              disabled={isGenerating || loadingModels}
            />
          )}

          {/* Aspect Ratio 1:1 Checkbox (if enabled) */}
          {showAspectRatio1to1Checkbox && (
            <div className="h-7 flex items-center gap-1.5 px-2 rounded-[28px] border border-border bg-muted/30">
              <Checkbox
                id="aspect-ratio-1to1"
                checked={aspectRatio1to1}
                onCheckedChange={onAspectRatio1to1Change}
              />
              <Label
                htmlFor="aspect-ratio-1to1"
                className="text-xs cursor-pointer"
              >
                1:1
              </Label>
            </div>
          )}
          
          {/* Enhance Prompt section wrapped in container */}
          <div className="h-7 flex items-center gap-1.5 px-2 py-[18px] rounded-[28px] border border-border bg-muted/30">
            <Switch
              id="enhance-prompt"
              checked={enhancePrompt}
              onCheckedChange={onEnhancePromptChange}
              className="scale-90"
            />
            <Label
              htmlFor="enhance-prompt"
              className="text-xs cursor-pointer"
            >
              Enhance Prompt
            </Label>
          </div>
        </div>

        {/* Hidden file input for reference image */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleReferenceImageUpload}
          className="hidden"
        />
      </CardContent>

      {/* Full Screen Image Preview */}
      {isFullScreenPreviewOpen && localReferenceImage?.url && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleCloseFullScreenPreview}
        >
          <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={localReferenceImage.url}
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
