"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CircleNotch, Plus, FilePlus, X, Sparkle, Check, Waveform } from "@phosphor-icons/react"
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
import type { AttachedRef, SlashCommandUiAction } from "@/lib/commands/types"
import { buildPromptWithRefs } from "@/lib/commands/build-prompt"
import { brandRefsOnly, getImageAssetUrlsFromRefChips, getVideoAssetUrlsFromRefChips } from "@/lib/commands/ref-image-pipeline"
import { allowedAssetTypesForVideoModel } from "@/lib/commands/allowed-asset-types"
import { VIDEO_PRESET_COMMANDS } from "@/lib/commands/presets-video"
import { getVideoChipSlotInfo } from "@/lib/commands/video-chip-slots"
import { extendMentionRangeEnd } from "@/lib/commands/mention-token"
import { CreateAssetDialog } from "@/components/canvas/create-asset-dialog"
import { BrandKitNewFlowDialog } from "@/components/brand-kit/brand-kit-new-flow-dialog"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import type { AssetType } from "@/lib/assets/types"
import { toast } from "sonner"

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
  /** Lift @ / command refs to parent for generate merge */
  attachedRefs?: AttachedRef[]
  onAttachedRefsChange?: (refs: AttachedRef[]) => void
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
  attachedRefs: attachedRefsProp,
  onAttachedRefsChange,
}: VideoInputBoxProps) {
  const [attachedRefsLocal, setAttachedRefsLocal] = React.useState<AttachedRef[]>([])
  const attachedRefs = attachedRefsProp ?? attachedRefsLocal
  const setAttachedRefs = React.useCallback(
    (next: AttachedRef[]) => {
      if (attachedRefsProp === undefined) {
        setAttachedRefsLocal(next)
      }
      onAttachedRefsChange?.(next)
    },
    [attachedRefsProp, onAttachedRefsChange]
  )

  const slashCreateAssetFileRef = React.useRef<HTMLInputElement>(null)
  const [slashCreateAssetOpen, setSlashCreateAssetOpen] = React.useState(false)
  const [brandKitNewFlowOpen, setBrandKitNewFlowOpen] = React.useState(false)
  const [slashCreateAssetInitial, setSlashCreateAssetInitial] = React.useState<{
    url: string
    assetType: AssetType
    title?: string
  } | null>(null)
  const [slashCreateAssetUploading, setSlashCreateAssetUploading] = React.useState(false)

  const inputRef = React.useRef<HTMLInputElement>(null)
  const lastFrameRef = React.useRef<HTMLInputElement>(null)
  const videoRef = React.useRef<HTMLInputElement>(null)
  const referenceImagesRef = React.useRef<HTMLInputElement>(null)
  const referenceAudioRef = React.useRef<HTMLInputElement>(null)
  const promptDragCounter = React.useRef(0)
  const [isPromptDragActive, setIsPromptDragActive] = React.useState(false)
  const [draggedMediaKind, setDraggedMediaKind] = React.useState<"image" | "video" | "unknown" | null>(null)



  // Detect model type
  const isMotionCopyModel = selectedModel.identifier === 'kwaivgi/kling-v2.6-motion-control' || selectedModel.identifier === 'kwaivgi/kling-v3-motion-control'
  const isLipsyncModel =
    selectedModel.identifier.includes('lipsync') ||
    selectedModel.identifier.includes('wav2lip') ||
    selectedModel.identifier === 'veed/fabric-1.0'
  const isReferenceVideoSupported =
    selectedModel.supports_reference_video === true ||
    selectedModel.identifier === 'xai/grok-imagine-video' ||
    selectedModel.identifier === 'kwaivgi/kling-v3-omni-video' ||
    selectedModel.identifier === 'bytedance/seedance-2.0'

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
      (param) => param.name === 'last_frame' || param.name === 'last_frame_image'
    ) ?? false
  }, [selectedModel])

  const modelSupportsNegativePrompt = React.useMemo(() => {
    return selectedModel.parameters.parameters?.some(
      param => param.name === 'negative_prompt'
    ) ?? false
  }, [selectedModel])

  const isKlingV3 = selectedModel.identifier === 'kwaivgi/kling-v3-video'
  const isKlingV3Omni = selectedModel.identifier === 'kwaivgi/kling-v3-omni-video'
  const isSeedance2 = selectedModel.identifier === 'bytedance/seedance-2.0'
  const isKlingV3OrOmni = isKlingV3 || isKlingV3Omni
  const usesRefImageGallery = isKlingV3Omni || isSeedance2
  const totalDuration = Number(parameters.duration) || 5
  const maxReferenceImages = isSeedance2 ? 9 : inputVideo ? 4 : 7

  // Determine if we need prompt
  const needsPrompt = !isMotionCopyModel && !isLipsyncModel

  const allowedAssetTypes = React.useMemo(
    () => allowedAssetTypesForVideoModel(selectedModel),
    [selectedModel]
  )

  const mergedPromptForReady = React.useMemo(
    () => buildPromptWithRefs(promptValue, brandRefsOnly(attachedRefs)).trim(),
    [promptValue, attachedRefs]
  )

  const hasRefChips = React.useMemo(() => {
    return (
      getImageAssetUrlsFromRefChips(attachedRefs).length > 0 ||
      getVideoAssetUrlsFromRefChips(attachedRefs).length > 0
    )
  }, [attachedRefs])

  const chipSlotInfo = React.useMemo(
    () =>
      getVideoChipSlotInfo(selectedModel, attachedRefs, {
        hasInputImage: !!(inputImage?.file || inputImage?.url),
        hasLastFrame: !!(lastFrameImage?.file || lastFrameImage?.url),
        hasReferenceVideo: !!(inputVideo?.file || inputVideo?.url),
      }),
    [selectedModel, attachedRefs, inputImage, lastFrameImage, inputVideo]
  )

  const removeAttachedRef = React.useCallback(
    (ref: AttachedRef) => {
      const without = attachedRefs.filter((r) => r.chipId !== ref.chipId)
      let next = promptValue
      const token = ref.mentionToken
      if (token) {
        const start = promptValue.indexOf(token)
        if (start !== -1) {
          const end = extendMentionRangeEnd(promptValue, start, token.length)
          next = promptValue.slice(0, start) + promptValue.slice(end)
        }
      }
      const pruned = without.filter((r) => !r.mentionToken || next.includes(r.mentionToken))
      onPromptChange(next)
      setAttachedRefs(pruned)
    },
    [attachedRefs, onPromptChange, promptValue, setAttachedRefs]
  )

  const canAddReferenceImage = React.useMemo(() => {
    if (!usesRefImageGallery) return false
    const nChipStyle = chipSlotInfo.omniStyleImageChipUrls.length
    return referenceImages.length + nChipStyle < maxReferenceImages
  }, [
    usesRefImageGallery,
    referenceImages.length,
    chipSlotInfo.omniStyleImageChipUrls.length,
    maxReferenceImages,
  ])

  const canAddSeedanceReferenceAudio = React.useMemo(() => {
    if (!isSeedance2) return false
    return !(inputAudio?.file || inputAudio?.url)
  }, [isSeedance2, inputAudio])

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
    if (
      !onReferenceImagesChange ||
      referenceImages.length + chipSlotInfo.omniStyleImageChipUrls.length >= maxReferenceImages
    )
      return
    const next: ImageUpload = { file, url: URL.createObjectURL(file) }
    onReferenceImagesChange([...referenceImages, next])
    e.target.value = ''
  }

  const removeReferenceImage = (index: number) => {
    if (!onReferenceImagesChange) return
    onReferenceImagesChange(referenceImages.filter((_, i) => i !== index))
  }

  const handleReferenceAudioAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const byMime = file.type.startsWith("audio/")
    const byName = /\.(wav|mp3|mpeg|m4a|aac)$/i.test(file.name)
    if (!byMime && !byName) {
      toast.error("Use a supported audio file (.wav, .mp3, .m4a, or .aac).")
      return
    }
    onInputAudioChange({ file, url: URL.createObjectURL(file) })
  }

  const isReady = React.useMemo(() => {
    if (isMotionCopyModel) {
      return !!(inputImage && inputVideo)
    }
    if (isLipsyncModel) {
      return !!(inputImage && inputAudio)
    }
    if (isKlingV3OrOmni && multiShotMode && multiShotShots.length > 0) {
      const sum = multiShotShots.reduce((acc, s) => acc + s.duration, 0)
      const validSum = sum === totalDuration
      const hasPrompts = multiShotShots.every((s) => s.prompt.trim().length > 0)
      return validSum && hasPrompts
    }
    if (isKlingV3OrOmni && !multiShotMode) {
      return mergedPromptForReady.length > 0 || !!inputImage || hasRefChips
    }
    if (isSeedance2) {
      return (
        mergedPromptForReady.length > 0 ||
        !!inputImage ||
        !!lastFrameImage ||
        !!inputVideo ||
        !!inputAudio ||
        referenceImages.length > 0 ||
        hasRefChips
      )
    }
    if (modelSupportsImage || modelSupportsLastFrame) {
      if (modelSupportsImage && !inputImage) return false
      if (modelSupportsLastFrame && !lastFrameImage) return false
      return true
    }
    return mergedPromptForReady.length > 0 || hasRefChips
  }, [
    isMotionCopyModel,
    isLipsyncModel,
    inputImage,
    inputVideo,
    inputAudio,
    isKlingV3OrOmni,
    multiShotMode,
    multiShotShots,
    totalDuration,
    mergedPromptForReady,
    hasRefChips,
    modelSupportsImage,
    modelSupportsLastFrame,
    lastFrameImage,
    isSeedance2,
    inputVideo,
    referenceImages.length,
  ])

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

  const handleTextInputKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        if (isReady) {
          onGenerate()
        }
      }
    },
    [isReady, onGenerate]
  )

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

  const handlePromptImageFile = React.useCallback((file?: File) => {
    if (!file || !file.type.startsWith("image/")) return

    const imageUpload: ImageUpload = {
      file,
      url: URL.createObjectURL(file),
    }

    if (nextImageDropSlot === "lastFrame") {
      onLastFrameChange(imageUpload)
      return
    }

    onInputImageChange(imageUpload)
  }, [nextImageDropSlot, onInputImageChange, onLastFrameChange])

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
      return isMotionCopyModel ? "Background source" : "Reference Video"
    }
    if (draggedMediaKind === "image" && canAcceptImageDrop) {
      return nextImageDropLabel
    }
    if (canAcceptImageDrop) return nextImageDropLabel
    if (canDropReferenceVideo) return isMotionCopyModel ? "Background source" : "Reference Video"
    return "Reference Media"
  }, [canAcceptImageDrop, canDropReferenceVideo, draggedMediaKind, isMotionCopyModel, nextImageDropLabel])

  const promptPlaceholderText = needsPrompt
    ? (
      isPromptDragActive && canAcceptPromptDrop
        ? `Drop file to set ${promptDropLabel}...`
        : `Describe the video you want to generate...${canAcceptPromptDrop ? ` (or paste an image / drag a file anywhere in this box to set ${promptDropLabel})` : ""}`
    )
    : "Describe the video you want to generate..."

  // Unified interface structure
  return (
    <Card
      className={cn(
        "w-full max-w-sm sm:max-w-lg lg:max-w-4xl relative overflow-visible",
        forceRowLayout && "backdrop-blur-xl bg-background/95 shadow-2xl border-2"
      )}
      onDropCapture={handlePromptDrop}
      onDragOverCapture={handlePromptDragOver}
      onDragEnterCapture={handlePromptDragEnter}
      onDragLeaveCapture={handlePromptDragLeave}
    >
      {isPromptDragActive && canAcceptPromptDrop && (
        <div className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] border-2 border-dashed border-primary bg-primary/20" />
      )}
      <CardContent className="p-2 flex flex-col gap-1.5">
        {/* Image/Video Previews — manual uploads + @ library slots (same API fields) */}
        {((!isMotionCopyModel &&
          !isLipsyncModel &&
          (inputImage ||
            lastFrameImage ||
            (isReferenceVideoSupported && inputVideo) ||
            (usesRefImageGallery && referenceImages.length > 0) ||
            chipSlotInfo.inputSlotFromChip ||
            chipSlotInfo.lastFrameSlotFromChip ||
            chipSlotInfo.referenceVideoSlotFromChip ||
            (usesRefImageGallery && chipSlotInfo.omniStyleImageChipUrls.length > 0))) ||
          (isMotionCopyModel && (inputImage || inputVideo))) && (
          <div className="flex flex-wrap gap-2 px-2 pt-1">
            {(inputImage?.url || chipSlotInfo.startImageChipUrl) && !isMotionCopyModel && !isLipsyncModel && (
              <div className="relative inline-block">
                <Image
                  src={inputImage?.url ?? chipSlotInfo.startImageChipUrl!}
                  alt="Input preview"
                  width={200}
                  height={150}
                  className="w-auto h-auto max-h-32 rounded-md object-contain border border-border"
                />
                <button
                  onClick={() => {
                    if (inputImage) onInputImageChange(null)
                    else if (chipSlotInfo.startImageRef) removeAttachedRef(chipSlotInfo.startImageRef)
                  }}
                  className="absolute top-1 right-1 bg-background/80 hover:bg-destructive/80 text-destructive-foreground rounded-full p-1 shadow-sm border border-border z-10 backdrop-blur-sm"
                  aria-label="Remove input image"
                  type="button"
                >
                  <X className="size-3" weight="bold" />
                </button>
                <div className="absolute bottom-1 left-1 bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-medium border border-border">
                  {inputImage?.url
                    ? selectedModel.identifier === "minimax/hailuo-2.3-fast"
                      ? "First Frame"
                      : isKlingV3OrOmni
                        ? "Start Frame"
                        : "Input"
                    : "@ Library · start"}
                </div>
              </div>
            )}
            {(lastFrameImage?.url || chipSlotInfo.lastFrameChipUrl) && !isMotionCopyModel && !isLipsyncModel && (
              <div className="relative inline-block">
                <Image
                  src={lastFrameImage?.url ?? chipSlotInfo.lastFrameChipUrl!}
                  alt="Last frame preview"
                  width={200}
                  height={150}
                  className="w-auto h-auto max-h-32 rounded-md object-contain border border-border"
                />
                <button
                  onClick={() => {
                    if (lastFrameImage) onLastFrameChange(null)
                    else if (chipSlotInfo.lastFrameRef) removeAttachedRef(chipSlotInfo.lastFrameRef)
                  }}
                  className="absolute top-1 right-1 bg-background/80 hover:bg-destructive/80 text-destructive-foreground rounded-full p-1 shadow-sm border border-border z-10 backdrop-blur-sm"
                  aria-label="Remove last frame"
                  type="button"
                >
                  <X className="size-3" weight="bold" />
                </button>
                <div className="absolute bottom-1 left-1 bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-medium border border-border">
                  {lastFrameImage?.url ? "Last Frame" : "@ Library · last"}
                </div>
              </div>
            )}
            {isReferenceVideoSupported && (inputVideo?.url || chipSlotInfo.referenceVideoChipUrl) && (
              <div className="relative inline-block">
                <video
                  src={inputVideo?.url ?? chipSlotInfo.referenceVideoChipUrl!}
                  className="w-auto h-auto max-h-32 rounded-md object-contain border border-border"
                  muted
                  playsInline
                  preload="metadata"
                />
                <button
                  onClick={() => {
                    if (inputVideo) onInputVideoChange(null)
                    else if (chipSlotInfo.referenceVideoRef) removeAttachedRef(chipSlotInfo.referenceVideoRef)
                  }}
                  className="absolute top-1 right-1 bg-background/80 hover:bg-destructive/80 text-destructive-foreground rounded-full p-1 shadow-sm border border-border z-10 backdrop-blur-sm"
                  aria-label={isMotionCopyModel ? "Remove background source" : "Remove reference video"}
                  type="button"
                >
                  <X className="size-3" weight="bold" />
                </button>
                <div className="absolute bottom-1 left-1 bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-medium border border-border">
                  {inputVideo?.url
                    ? isMotionCopyModel
                      ? "Background source"
                      : "Reference Video"
                    : "@ Library · video"}
                </div>
              </div>
            )}
            {usesRefImageGallery &&
              referenceImages.map((ref, index) =>
                ref.url ? (
                  <div key={`upload-ref-${index}`} className="relative inline-block">
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
                      Ref {index + 1}
                    </div>
                  </div>
                ) : null
              )}
            {usesRefImageGallery &&
              chipSlotInfo.omniStyleImageRefs.map((ref, i) => (
                <div key={`chip-style-${ref.chipId}`} className="relative inline-block">
                  <Image
                    src={ref.assetUrl ?? ref.previewUrl ?? ""}
                    alt={ref.label || "Style reference"}
                    width={80}
                    height={60}
                    className="w-auto h-auto max-h-20 rounded-md object-cover border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => removeAttachedRef(ref)}
                    className="absolute top-0.5 right-0.5 bg-background/80 hover:bg-destructive/80 text-destructive-foreground rounded-full p-1 shadow-sm border border-border z-10 backdrop-blur-sm"
                    aria-label="Remove style reference from prompt"
                  >
                    <X className="size-2.5" weight="bold" />
                  </button>
                  <div className="absolute bottom-0.5 left-0.5 bg-background/80 backdrop-blur-sm px-1 py-0.5 rounded text-[9px] font-medium border border-border">
                    @ Style {i + 1}
                  </div>
                </div>
              ))}
            {isMotionCopyModel && inputImage?.url && (
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
                  type="button"
                >
                  <X className="size-3" weight="bold" />
                </button>
                <div className="absolute bottom-1 left-1 bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-medium border border-border">
                  Reference Image
                </div>
              </div>
            )}
            {isMotionCopyModel && inputVideo?.url && (
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
                  aria-label="Remove background source"
                  type="button"
                >
                  <X className="size-3" weight="bold" />
                </button>
                <div className="absolute bottom-1 left-1 bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-medium border border-border">
                  Background source
                </div>
              </div>
            )}
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
              onPasteImage={canAcceptImageDrop ? handlePromptImageFile : undefined}
              attachedRefs={attachedRefs}
              onRefsChange={setAttachedRefs}
              allowedAssetTypes={allowedAssetTypes}
              slashCommands={VIDEO_PRESET_COMMANDS}
              onSlashUiAction={handleSlashUiAction}
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
        {usesRefImageGallery && onReferenceImagesChange && (
          <div className="px-2 space-y-1.5 border-t border-border/50 pt-2 mt-1">
            <p className="text-[11px] text-muted-foreground">
              {isSeedance2
                ? `Seedance multimodal references — This row: extra stills as .jpg / .jpeg / .png (up to ${maxReferenceImages}; use [Image1], … in the prompt). Reference audio: add via either + as .wav / .mp3 / .m4a / .aac (~15s combined with other media; use [Audio1], …). Frames & reference video: use the bottom + for input/start image, last frame, or reference video (e.g. .mp4, .webm, .mov). Reference audio needs at least one of those image or video references.`
                : `Reference images for elements, scenes, or styles. Supports .jpg/.jpeg/.png. Max ${maxReferenceImages} without video, 4 with video.`}
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
              {isSeedance2 && (inputAudio?.url || inputAudio?.file) && (
                  <div className="relative flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/25">
                    <Waveform className="size-5 text-primary" weight="duotone" aria-hidden />
                    <button
                      type="button"
                      onClick={() => onInputAudioChange(null)}
                      className="absolute -top-1 -right-1 rounded-full border border-border bg-destructive p-0.5 text-destructive-foreground shadow"
                      aria-label="Remove reference audio"
                    >
                      <X className="size-2.5" weight="bold" />
                    </button>
                    <span className="pointer-events-none absolute bottom-0.5 left-1/2 -translate-x-1/2 rounded bg-background/90 px-1 py-0.5 text-[8px] font-medium text-muted-foreground">
                      Audio
                    </span>
                  </div>
              )}
              {isSeedance2 && (canAddReferenceImage || canAddSeedanceReferenceAudio) ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-12 w-12 rounded-md border-dashed p-0"
                      disabled={isGenerating}
                      aria-label="Add reference image or audio"
                    >
                      <Plus className="size-5" weight="bold" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      disabled={!canAddReferenceImage}
                      onClick={() => referenceImagesRef.current?.click()}
                      className="flex cursor-pointer flex-col items-start gap-0.5 py-2"
                    >
                      <span className="flex items-center text-sm font-medium">
                        <FilePlus className="mr-2 size-4 shrink-0" />
                        Reference image
                      </span>
                      <span className="text-muted-foreground pl-6 text-[10px] leading-snug">
                        JPEG or PNG, up to {maxReferenceImages}. Use [Image1] in your prompt.
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!canAddSeedanceReferenceAudio}
                      onClick={() => referenceAudioRef.current?.click()}
                      className="flex cursor-pointer flex-col items-start gap-0.5 py-2"
                    >
                      <span className="flex items-center text-sm font-medium">
                        <Waveform className="mr-2 size-4 shrink-0" weight="duotone" />
                        Reference audio
                      </span>
                      <span className="text-muted-foreground pl-6 text-[10px] leading-snug">
                        .wav / .mp3 / .m4a / .aac (~15s). Use [Audio1]; requires a start/end frame, input image, or reference video.
                      </span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : !isSeedance2 && canAddReferenceImage ? (
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
              ) : null}
            </div>
            <input
              ref={referenceImagesRef}
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              onChange={handleReferenceImageAdd}
              className="hidden"
            />
            {isSeedance2 ? (
              <input
                ref={referenceAudioRef}
                type="file"
                accept="audio/wav,audio/x-wav,audio/mpeg,audio/mp3,audio/mp4,audio/aac,audio/x-m4a,.wav,.mp3,.m4a,.aac"
                onChange={handleReferenceAudioAdd}
                className="hidden"
                aria-hidden
              />
            ) : null}
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
                title={isMotionCopyModel ? "Background source" : "Upload Video"}
                description="Click to upload"
                maxDurationSeconds={parameters?.character_orientation === 'video' ? 30 : 10}
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
                allowVideo
                title="Image or video"
                description="Portrait or talking-head clip"
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
                    aria-label={
                      isSeedance2
                        ? "Add image, video, or reference (image/audio)"
                        : "Add image or video"
                    }
                  >
                    <Plus className="size-3.5" weight="bold" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {modelSupportsImage && (
                    <DropdownMenuItem
                      onClick={() => inputRef.current?.click()}
                      disabled={!!inputImage || chipSlotInfo.inputSlotFromChip}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="flex items-center">
                        <FilePlus className="size-4 mr-2 shrink-0" />
                        {selectedModel.identifier === "minimax/hailuo-2.3-fast"
                          ? "Upload First Frame"
                          : "Upload Input Image"}
                      </span>
                      {(chipSlotInfo.inputSlotFromChip || inputImage) && (
                        <Check className="size-4 text-primary shrink-0" weight="bold" aria-hidden />
                      )}
                    </DropdownMenuItem>
                  )}
                  {modelSupportsLastFrame && (
                    <DropdownMenuItem
                      onClick={() => lastFrameRef.current?.click()}
                      disabled={!!lastFrameImage || chipSlotInfo.lastFrameSlotFromChip}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="flex items-center">
                        <FilePlus className="size-4 mr-2 shrink-0" />
                        Upload Last Frame
                      </span>
                      {(chipSlotInfo.lastFrameSlotFromChip || lastFrameImage) && (
                        <Check className="size-4 text-primary shrink-0" weight="bold" aria-hidden />
                      )}
                    </DropdownMenuItem>
                  )}
                  {isReferenceVideoSupported && (
                    <DropdownMenuItem
                      onClick={() => videoRef.current?.click()}
                      disabled={!!inputVideo || chipSlotInfo.referenceVideoSlotFromChip}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="flex items-center">
                        <FilePlus className="size-4 mr-2 shrink-0" />
                        Upload Reference Video
                      </span>
                      {(chipSlotInfo.referenceVideoSlotFromChip || inputVideo) && (
                        <Check className="size-4 text-primary shrink-0" weight="bold" aria-hidden />
                      )}
                    </DropdownMenuItem>
                  )}
                  {usesRefImageGallery && onReferenceImagesChange && (
                    <DropdownMenuItem
                      disabled={!canAddReferenceImage}
                      onClick={() => referenceImagesRef.current?.click()}
                      className="flex cursor-pointer flex-col items-start gap-0.5 py-2"
                    >
                      <span className="flex items-center text-sm font-medium">
                        <FilePlus className="mr-2 size-4 shrink-0" />
                        {isSeedance2 ? "Reference image" : "Add reference image"}
                      </span>
                      {isSeedance2 ? (
                        <span className="text-muted-foreground pl-6 text-[10px] leading-snug">
                          JPEG or PNG, up to {maxReferenceImages}. Use [Image1] in your prompt.
                        </span>
                      ) : null}
                    </DropdownMenuItem>
                  )}
                  {isSeedance2 && (
                    <DropdownMenuItem
                      disabled={!canAddSeedanceReferenceAudio}
                      onClick={() => referenceAudioRef.current?.click()}
                      className="flex cursor-pointer flex-col items-start gap-0.5 py-2"
                    >
                      <span className="flex items-center text-sm font-medium">
                        <Waveform className="mr-2 size-4 shrink-0" weight="duotone" />
                        Reference audio
                      </span>
                      <span className="text-muted-foreground pl-6 text-[10px] leading-snug">
                        .wav / .mp3 / .m4a / .aac (~15s). Use [Audio1]; requires a frame or reference video.
                      </span>
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
            referenceVideoProvided={!!inputVideo || chipSlotInfo.referenceVideoSlotFromChip}
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
