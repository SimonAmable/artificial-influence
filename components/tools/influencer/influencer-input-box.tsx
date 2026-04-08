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
import { Plus, X, FilePlus, Sparkle, FolderOpen } from "@phosphor-icons/react"
import { ImageUpload } from "@/components/shared/upload/photo-upload"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ImagePromptFields } from "./image-prompt-fields"
import { ImageEnhanceSwitch } from "./image-enhance-switch"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Model } from "@/lib/types/models"
import { ModelIcon } from "@/components/shared/icons/model-icon"
import { AspectRatioSelector } from "@/components/shared/selectors/aspect-ratio-selector"
import { getActiveModelMetadata, type ModelMetadata } from "@/lib/constants/model-metadata"
import { AssetSelectionModal } from "@/components/shared/modals/asset-selection-modal"
import type { AttachedRef, SlashCommandUiAction } from "@/lib/commands/types"
import { CreateAssetDialog } from "@/components/canvas/create-asset-dialog"
import { BrandKitNewFlowDialog } from "@/components/brand-kit/brand-kit-new-flow-dialog"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import type { AssetType } from "@/lib/assets/types"
import { toast } from "sonner"
import { buildPromptWithRefs } from "@/lib/commands/build-prompt"
import { extendMentionRangeEnd } from "@/lib/commands/mention-token"
import { brandRefsOnly, getImageAssetUrlsFromRefChips } from "@/lib/commands/ref-image-pipeline"

interface InfluencerInputBoxProps {
  className?: string
  onGenerate?: () => void
  promptValue?: string
  onPromptChange?: (value: string) => void
  referenceImage?: ImageUpload | null
  onReferenceImageChange?: (image: ImageUpload | null) => void
  /** Multiple reference images support */
  referenceImages?: ImageUpload[]
  onReferenceImagesChange?: (images: ImageUpload[]) => void
  enhancePrompt?: boolean
  onEnhancePromptChange?: (enabled: boolean) => void
  isGenerating?: boolean
  forceRowLayout?: boolean
  placeholder?: string
  selectedModel?: string
  onModelChange?: (modelIdentifier: string) => void
  showModelSelector?: boolean
  /** Pass DB models when using /api/models. When provided, overrides getActiveModelMetadata. */
  imageModels?: Model[]
  selectedAspectRatio?: string
  onAspectRatioChange?: (aspectRatio: string) => void
  showAspectRatioSelector?: boolean
  aspectRatio1to1?: boolean
  onAspectRatio1to1Change?: (checked: boolean) => void
  showAspectRatio1to1Checkbox?: boolean
  /** Number of images to generate (1–max_images). Shown when model has max_images > 1. */
  selectedNumImages?: number
  onNumImagesChange?: (n: number) => void
  showNumImagesSelector?: boolean
  customPromptContent?: React.ReactNode
  customControlsStart?: React.ReactNode
  hidePromptInput?: boolean
  showReferenceControls?: boolean
  showGenerateInBottomRow?: boolean
  hideEnhancePrompt?: boolean
  isReadyOverride?: boolean
  uploadMenuItems?: React.ReactNode
  /** When true, Generate button stays enabled during generation so user can send concurrent requests */
  allowConcurrent?: boolean
  /** When true, model selector, aspect ratio, and other options stay enabled during generation */
  allowOptionsDuringGeneration?: boolean
  /** Lift @-reference chips to parent (e.g. merge into generate API prompt) */
  onAttachedRefsChange?: (refs: AttachedRef[]) => void
  /** Restrict @ → assets (e.g. `["image"]` on /image) */
  allowedAssetTypes?: AssetType[]
}

export function InfluencerInputBox({
  className,
  onGenerate,
  promptValue = "",
  onPromptChange,
  referenceImage,
  onReferenceImageChange,
  referenceImages,
  onReferenceImagesChange,
  enhancePrompt = false,
  onEnhancePromptChange,
  isGenerating = false,
  forceRowLayout: _forceRowLayout = false,
  placeholder = "Describe your image — use / for presets and @ for brand kits & assets.",
  selectedModel,
  onModelChange,
  showModelSelector = false,
  imageModels,
  selectedAspectRatio,
  onAspectRatioChange,
  showAspectRatioSelector = false,
  aspectRatio1to1 = false,
  onAspectRatio1to1Change,
  showAspectRatio1to1Checkbox = false,
  selectedNumImages = 1,
  onNumImagesChange,
  showNumImagesSelector = false,
  customPromptContent,
  customControlsStart,
  hidePromptInput = false,
  showReferenceControls = true,
  showGenerateInBottomRow = false,
  hideEnhancePrompt = false,
  isReadyOverride,
  uploadMenuItems,
  allowConcurrent = false,
  allowOptionsDuringGeneration = false,
  onAttachedRefsChange,
  allowedAssetTypes,
}: InfluencerInputBoxProps) {
  const [localPrompt, setLocalPrompt] = React.useState(promptValue)
  const [attachedRefs, setAttachedRefs] = React.useState<AttachedRef[]>([])
  const [localReferenceImage, setLocalReferenceImage] = React.useState<ImageUpload | null>(referenceImage || null)
  const [localReferenceImages, setLocalReferenceImages] = React.useState<ImageUpload[]>(referenceImages || [])
  const [isPromptDragActive, setIsPromptDragActive] = React.useState(false)
  const [isFullScreenPreviewOpen, setIsFullScreenPreviewOpen] = React.useState(false)
  const [fullScreenImageIndex, setFullScreenImageIndex] = React.useState(0)
  const [assetModalOpen, setAssetModalOpen] = React.useState(false)
  const [brandKitNewFlowOpen, setBrandKitNewFlowOpen] = React.useState(false)
  const [slashCreateAssetOpen, setSlashCreateAssetOpen] = React.useState(false)
  const [slashCreateAssetInitial, setSlashCreateAssetInitial] = React.useState<{
    url: string
    assetType: AssetType
    title?: string
  } | null>(null)
  const [slashCreateAssetUploading, setSlashCreateAssetUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const slashCreateAssetFileRef = React.useRef<HTMLInputElement>(null)
  const promptDragCounter = React.useRef(0)
  
  // Use DB models when provided, else fallback to constants
  const metadataModels = React.useMemo(() => getActiveModelMetadata('image'), [])
  const models: Model[] = imageModels ?? metadataModels.map((m: ModelMetadata): Model => ({
    id: m.id,
    identifier: m.identifier,
    name: m.name,
    description: m.description,
    type: m.type,
    provider: m.provider,
    is_active: m.is_active,
    model_cost: m.model_cost,
    parameters: { parameters: [] },
    created_at: '',
    updated_at: '',
    aspect_ratios: m.aspect_ratios,
    default_aspect_ratio: m.aspect_ratios[0],
  }))
  const toolModels = React.useMemo(() => models.filter((m) => m.identifier.startsWith("custom/")), [models])
  const imageModelsOnly = React.useMemo(() => models.filter((m) => !m.identifier.startsWith("custom/")), [models])
  const showModelGroups = toolModels.length > 0 && imageModelsOnly.length > 0

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

  React.useEffect(() => {
    if (referenceImages !== undefined) {
      setLocalReferenceImages(referenceImages)
    }
  }, [referenceImages])

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setLocalPrompt(value)
    onPromptChange?.(value)
  }

  const canAcceptPromptDrop = showReferenceControls && Boolean(onReferenceImagesChange || onReferenceImageChange)

  const handlePromptImageFile = React.useCallback((file?: File) => {
    if (!file || !file.type.startsWith("image/")) return

    const url = URL.createObjectURL(file)
    const newImage: ImageUpload = { file, url }

    if (onReferenceImagesChange) {
      const updatedImages = [...localReferenceImages, newImage]
      setLocalReferenceImages(updatedImages)
      onReferenceImagesChange(updatedImages)
      return
    }

    setLocalReferenceImage(newImage)
    onReferenceImageChange?.(newImage)
  }, [localReferenceImages, onReferenceImageChange, onReferenceImagesChange])

  const handlePromptDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    promptDragCounter.current = 0
    setIsPromptDragActive(false)
    if (!canAcceptPromptDrop) return
    handlePromptImageFile(e.dataTransfer.files?.[0])
  }, [canAcceptPromptDrop, handlePromptImageFile])

  const handlePromptDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handlePromptDragEnter = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canAcceptPromptDrop || !e.dataTransfer.types.includes("Files")) return
    promptDragCounter.current += 1
    setIsPromptDragActive(true)
  }, [canAcceptPromptDrop])

  const handlePromptDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    promptDragCounter.current -= 1
    if (promptDragCounter.current <= 0) {
      promptDragCounter.current = 0
      setIsPromptDragActive(false)
    }
  }, [])

  const handleCardPaste = React.useCallback(
    (e: React.ClipboardEvent) => {
      if (!canAcceptPromptDrop) return
      const items = e.clipboardData?.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            e.stopPropagation()
            handlePromptImageFile(file)
            return
          }
        }
      }
    },
    [canAcceptPromptDrop, handlePromptImageFile]
  )

  const handleRefsChange = React.useCallback(
    (refs: AttachedRef[]) => {
      setAttachedRefs(refs)
      onAttachedRefsChange?.(refs)
    },
    [onAttachedRefsChange]
  )

  const handleSlashUiAction = React.useCallback((action: SlashCommandUiAction) => {
    if (action === "create-asset") {
      slashCreateAssetFileRef.current?.click()
    } else if (action === "create-brand-kit") {
      setBrandKitNewFlowOpen(true)
    }
  }, [])

  const handleSlashCreateAssetFile = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ""
      if (!file) return
      const type = file.type
      const isImage = type.startsWith("image/")
      const isVideo = type.startsWith("video/")
      const isAudio = type.startsWith("audio/")
      if (!isImage && !isVideo && !isAudio) {
        toast.error("Please select an image, video, or audio file")
        return
      }
      setSlashCreateAssetUploading(true)
      try {
        const result = await uploadFileToSupabase(file, "asset-library")
        if (!result) return
        if (result.fileType === "other") {
          toast.error("Unsupported file type. Use image, video, or audio.")
          return
        }
        setSlashCreateAssetInitial({
          url: result.url,
          assetType: result.fileType,
          title: result.fileName,
        })
        setSlashCreateAssetOpen(true)
      } finally {
        setSlashCreateAssetUploading(false)
      }
    },
    []
  )

  const handleTextInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // If Enter is pressed without Shift, trigger generate
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (
        (buildPromptWithRefs(localPrompt, brandRefsOnly(attachedRefs)).trim().length > 0 ||
          getImageAssetUrlsFromRefChips(attachedRefs).length > 0) &&
        onGenerate
      ) {
        onGenerate()
      }
    }
  }

  const handleReferenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      const newImage = { file, url }
      
      // Support both single and multiple reference images
      if (onReferenceImagesChange) {
        const updatedImages = [...localReferenceImages, newImage]
        setLocalReferenceImages(updatedImages)
        onReferenceImagesChange(updatedImages)
      } else {
        setLocalReferenceImage(newImage)
        onReferenceImageChange?.(newImage)
      }
    }
  }

  const removeAttachedAssetImageRef = React.useCallback(
    (ref: AttachedRef) => {
      const without = attachedRefs.filter((r) => r.chipId !== ref.chipId)
      let next = localPrompt
      const token = ref.mentionToken
      if (token) {
        const start = localPrompt.indexOf(token)
        if (start !== -1) {
          const end = extendMentionRangeEnd(localPrompt, start, token.length)
          next = localPrompt.slice(0, start) + localPrompt.slice(end)
        }
      }
      const pruned = without.filter((r) => !r.mentionToken || next.includes(r.mentionToken))
      setLocalPrompt(next)
      onPromptChange?.(next)
      handleRefsChange(pruned)
    },
    [attachedRefs, localPrompt, onPromptChange, handleRefsChange]
  )

  const handleReferenceImageRemove = (index?: number) => {
    // Support both single and multiple reference images
    if (onReferenceImagesChange && index !== undefined) {
      const imageToRemove = localReferenceImages[index]
      if (imageToRemove?.url && imageToRemove.file) {
        URL.revokeObjectURL(imageToRemove.url)
      }
      const updatedImages = localReferenceImages.filter((_, i) => i !== index)
      setLocalReferenceImages(updatedImages)
      onReferenceImagesChange(updatedImages)
    } else {
      if (localReferenceImage?.url) {
        URL.revokeObjectURL(localReferenceImage.url)
      }
      setLocalReferenceImage(null)
      onReferenceImageChange?.(null)
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleUploadReferenceImage = () => {
    fileInputRef.current?.click()
  }

  const handleImagePreviewClick = (index: number = 0) => {
    setFullScreenImageIndex(index)
    setIsFullScreenPreviewOpen(true)
  }

  const handleAssetSelect = (imageUrl: string) => {
    const newImage = { url: imageUrl }
    
    // Support both single and multiple reference images
    if (onReferenceImagesChange) {
      const updatedImages = [...localReferenceImages, newImage]
      setLocalReferenceImages(updatedImages)
      onReferenceImagesChange(updatedImages)
    } else {
      setLocalReferenceImage(newImage)
      onReferenceImageChange?.(newImage)
    }
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

  // Set default model if none selected
  React.useEffect(() => {
    if (showModelSelector && !selectedModel && models.length > 0 && onModelChange) {
      onModelChange(models[0].identifier)
    }
  }, [showModelSelector, selectedModel, models, onModelChange])

  // Find the selected model object (Model from DB or converted from metadata)
  const selectedModelObject = React.useMemo(() => {
    if (!selectedModel) return null
    return models.find(m => m.identifier === selectedModel) || null
  }, [selectedModel, models])

  // Determine if button is ready (prompt must not be empty)
  const isReady = React.useMemo(() => {
    if (typeof isReadyOverride === "boolean") {
      return isReadyOverride
    }
    return (
      buildPromptWithRefs(localPrompt, brandRefsOnly(attachedRefs)).trim().length > 0 ||
      getImageAssetUrlsFromRefChips(attachedRefs).length > 0
    )
  }, [isReadyOverride, localPrompt, attachedRefs])

  // Manually uploaded reference(s) — same row as @-attached image assets below
  const manualDisplayImages = onReferenceImagesChange
    ? localReferenceImages
    : localReferenceImage
      ? [localReferenceImage]
      : []

  /** Image library assets tagged in the prompt with a usable preview URL */
  const attachedImageAssetsWithPreview = React.useMemo(
    () =>
      attachedRefs.filter((r) => {
        if (r.category !== "asset" || r.assetType !== "image") return false
        const url = (r.assetUrl || r.previewUrl || "").trim()
        return Boolean(url)
      }),
    [attachedRefs]
  )

  const previewRowCount = manualDisplayImages.length + attachedImageAssetsWithPreview.length

  const allPreviewImageUrls = React.useMemo(
    () => [
      ...manualDisplayImages.map((img) => img.url),
      ...attachedImageAssetsWithPreview.map((r) => (r.assetUrl || r.previewUrl || "").trim()),
    ],
    [manualDisplayImages, attachedImageAssetsWithPreview]
  )

  const promptPlaceholderText =
    canAcceptPromptDrop && isPromptDragActive
      ? "Drop image to set Reference Image..."
      : canAcceptPromptDrop
        ? `${placeholder} (or paste / drag an image anywhere in this box to set Reference Image)`
        : placeholder

  return (
    <Card
      className={cn(
        "w-full max-w-sm sm:max-w-lg lg:max-w-4xl relative transition-colors",
        className,
        /* Card defaults to overflow-hidden; allow slash/@ palette to extend above the prompt */
        "overflow-visible"
      )}
      onDrop={handlePromptDrop}
      onDragOver={handlePromptDragOver}
      onDragEnter={handlePromptDragEnter}
      onDragLeave={handlePromptDragLeave}
      onPaste={handleCardPaste}
    >
      {isPromptDragActive && canAcceptPromptDrop && (
        <div className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] border-2 border-dashed border-primary bg-primary/20" />
      )}
      <CardContent className="p-2 flex flex-col gap-1.5">
        {/* Image Preview - Above Text Input */}
        {showReferenceControls && previewRowCount > 0 && (
          <div className="relative w-full flex gap-2 flex-wrap">
            {manualDisplayImages.map((image, index) => (
              <div key={`upload-${index}`} className="relative">
                <img
                  src={image.url}
                  alt={`Reference image ${index + 1}`}
                  className="h-[60px] w-auto max-w-full rounded object-contain border border-border cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => handleImagePreviewClick(index)}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleReferenceImageRemove(onReferenceImagesChange ? index : undefined)
                  }}
                  className="absolute -top-1 -right-1 bg-background hover:bg-destructive text-destructive-foreground rounded-full p-1 shadow-sm border border-border z-10"
                  aria-label={`Remove reference image ${index + 1}`}
                >
                  <X className="size-3" weight="bold" />
                </button>
              </div>
            ))}
            {attachedImageAssetsWithPreview.map((ref, assetIdx) => {
              const url = (ref.assetUrl || ref.previewUrl || "").trim()
              const globalIndex = manualDisplayImages.length + assetIdx
              return (
                <div key={`asset-${ref.chipId}`} className="relative">
                  <img
                    src={url}
                    alt={ref.label ? `Asset reference: ${ref.label}` : "Attached asset reference"}
                    className="h-[60px] w-auto max-w-full rounded object-contain border border-border cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => handleImagePreviewClick(globalIndex)}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeAttachedAssetImageRef(ref)
                    }}
                    className="absolute -top-1 -right-1 bg-background hover:bg-destructive text-destructive-foreground rounded-full p-1 shadow-sm border border-border z-10"
                    aria-label={`Remove ${ref.label || "attached asset"} from prompt`}
                  >
                    <X className="size-3" weight="bold" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Textarea and Generate Button - Side by Side */}
        <div className="flex items-start gap-2 pt-1 px-2">
          <div className="flex-1">
            <ImagePromptFields
              promptValue={localPrompt}
              onPromptChange={(value) => {
                setLocalPrompt(value)
                onPromptChange?.(value)
              }}
              attachedRefs={attachedRefs}
              onRefsChange={handleRefsChange}
              placeholder={promptPlaceholderText}
              variant="page"
              onPromptKeyDown={handleTextInputKeyDown}
              onPasteImage={canAcceptPromptDrop ? (file) => handlePromptImageFile(file) : undefined}
              allowedAssetTypes={allowedAssetTypes}
              onSlashUiAction={handleSlashUiAction}
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
                disabled={!isReady || (isGenerating && !allowConcurrent)}
                className={cn(
                  "bg-primary hover:bg-primary/80 text-primary-foreground font-semibold h-10 min-w-[100px] text-sm px-4 py-6 transition-all duration-300 relative z-0",
                  !isReady && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="flex flex-col items-center gap-0.5">
                    <span className="text-sm font-semibold">Generate</span>
                    <div className="flex items-center gap-0.5">
                      <Sparkle size={8} weight="fill" />
                      <span className="text-[10px]">
                        {selectedModelObject?.model_cost != null
                          ? selectedModelObject.model_cost * selectedNumImages
                          : "—"}
                      </span>
                    </div>
                  </div>
                </Button>
            </div>
          </div>
        </div>

        {/* Controls: Add Reference Image, Model Selector, Enhance Prompt */}
        <div className="flex items-center gap-1 flex-wrap">
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
              <DropdownMenuItem onClick={() => setAssetModalOpen(true)}>
                <FolderOpen className="size-4 mr-2" />
                Select Asset
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Model Selector (if enabled) */}
          {showModelSelector && (
            <Select
              value={selectedModel || ""}
              onValueChange={(value) => onModelChange?.(value)}
              disabled={!allowOptionsDuringGeneration && isGenerating}
            >
              <SelectTrigger id="model-select" className="h-7 text-xs w-fit min-w-0 px-2">
                <SelectValue placeholder="Select model">
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
                {showModelGroups ? (
                  <>
                    <SelectGroup>
                      <SelectLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Tools
                      </SelectLabel>
                      {toolModels.map((model) => (
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
                                <span className="text-xs text-muted-foreground">{model.description}</span>
                              )}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Models
                      </SelectLabel>
                      {imageModelsOnly.map((model) => (
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
                                <span className="text-xs text-muted-foreground">{model.description}</span>
                              )}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </>
                ) : (
                  models.map((model) => (
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
                            <span className="text-xs text-muted-foreground">{model.description}</span>
                          )}
                        </div>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}

          {/* Aspect Ratio Selector (if enabled) */}
          {showAspectRatioSelector && (
            <AspectRatioSelector
              model={selectedModelObject}
              value={selectedAspectRatio}
              onValueChange={onAspectRatioChange}
              disabled={!allowOptionsDuringGeneration && isGenerating}
            />
          )}

          {/* Number of Images Selector (when model supports max_images > 1) */}
          {showNumImagesSelector && selectedModelObject && (selectedModelObject.max_images ?? 1) > 1 && (
            <Select
              value={String(selectedNumImages)}
              onValueChange={(v) => onNumImagesChange?.(parseInt(v, 10))}
              disabled={!allowOptionsDuringGeneration && isGenerating}
            >
              <SelectTrigger id="num-images-select" className="h-7 text-xs w-fit min-w-[2.25rem] px-2">
                <SelectValue>{selectedNumImages}</SelectValue>
              </SelectTrigger>
              <SelectContent position="popper" side="top" sideOffset={4}>
                {Array.from({ length: selectedModelObject.max_images ?? 1 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          
          {/* Enhance Prompt */}
          {!hideEnhancePrompt && onEnhancePromptChange && (
            <ImageEnhanceSwitch
              checked={enhancePrompt}
              onCheckedChange={onEnhancePromptChange}
              variant="page"
              id="enhance-prompt"
            />
          )}
        </div>

        {/* Hidden file input for reference image */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleReferenceImageUpload}
          className="hidden"
        />
        <input
          ref={slashCreateAssetFileRef}
          type="file"
          accept="image/*,video/*,audio/*"
          onChange={handleSlashCreateAssetFile}
          className="hidden"
          aria-hidden
          disabled={slashCreateAssetUploading}
        />
      </CardContent>

      {/* Full Screen Image Preview */}
      {isFullScreenPreviewOpen && allPreviewImageUrls[fullScreenImageIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleCloseFullScreenPreview}
        >
          <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={allPreviewImageUrls[fullScreenImageIndex]}
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

      {/* Asset Selection Modal */}
      <AssetSelectionModal
        open={assetModalOpen}
        onOpenChange={setAssetModalOpen}
        onSelect={handleAssetSelect}
      />

      {slashCreateAssetInitial ? (
        <CreateAssetDialog
          open={slashCreateAssetOpen}
          onOpenChange={(open) => {
            setSlashCreateAssetOpen(open)
            if (!open) setSlashCreateAssetInitial(null)
          }}
          initial={{
            url: slashCreateAssetInitial.url,
            assetType: slashCreateAssetInitial.assetType,
            title: slashCreateAssetInitial.title,
          }}
        />
      ) : null}

      <BrandKitNewFlowDialog open={brandKitNewFlowOpen} onOpenChange={setBrandKitNewFlowOpen} />
    </Card>
  )
}
