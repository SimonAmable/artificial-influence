"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, FilePlus, X, Check, Waveform, FilmStrip } from "@phosphor-icons/react"
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
import { GenerateShaderButton } from "@/components/tools/influencer/generate-shader-button"
import {
  AnimatedControlItem,
  influencerControlIconButtonClassName,
} from "@/components/tools/influencer/animated-control-item"
import { IconCompactSwitch } from "@/components/tools/influencer/prompt-control-menu"
import { LayoutGroup } from "framer-motion"
import type { AttachedRef, SlashCommandUiAction } from "@/lib/commands/types"
import { usesFalMultimodalVideoInputs } from "@/lib/constants/models"
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
import {
  getVideoReferenceAudioConfig,
  isSupportedVideoReferenceAudioFile,
} from "@/lib/utils/video-reference-audio"
import { toast } from "sonner"
interface VideoInputBoxProps {
  className?: string
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
  estimatedCredits?: number | null
  isGenerating: boolean
  /** Active jobs count for compact shimmer tiles (defaults to 1 while isGenerating when omitted). */
  activeGenerationCount?: number
  onGenerate: () => void
  /** When true, Generate stays enabled while jobs are running (queue concurrent requests). */
  allowConcurrent?: boolean
  /** When true, model and multi-shot controls stay enabled during generation. */
  allowOptionsDuringGeneration?: boolean
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
  className,
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
  estimatedCredits = null,
  isGenerating,
  activeGenerationCount,
  onGenerate,
  allowConcurrent = false,
  allowOptionsDuringGeneration = false,
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
  const isPrunaPVideo = selectedModel.identifier === 'prunaai/p-video'
  const isWan27 = selectedModel.identifier === 'wan-video/wan-2.7'
  const isFalMultimodalVideo = usesFalMultimodalVideoInputs(selectedModel.identifier)
  const isKlingV3OrOmni = isKlingV3 || isKlingV3Omni
  const usesRefImageGallery = isKlingV3Omni || isSeedance2 || isFalMultimodalVideo
  const totalDuration = Number(parameters.duration) || 5
  const maxReferenceImages = isSeedance2 || isFalMultimodalVideo ? 9 : inputVideo ? 4 : 7

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

  const falMultimodalReferenceMode =
    isFalMultimodalVideo &&
    (referenceImages.length > 0 || chipSlotInfo.omniStyleImageChipUrls.length > 0)

  React.useEffect(() => {
    if (!falMultimodalReferenceMode || !inputImage) return
    onInputImageChange(null)
  }, [falMultimodalReferenceMode, inputImage, onInputImageChange])

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
    if (!isSeedance2 && !isPrunaPVideo && !isWan27) return false
    return !(inputAudio?.file || inputAudio?.url)
  }, [inputAudio, isPrunaPVideo, isSeedance2, isWan27])

  const referenceAudioConfig = React.useMemo(
    () => getVideoReferenceAudioConfig(selectedModel.identifier),
    [selectedModel.identifier],
  )

  const showReferenceAudioCard =
    !!referenceAudioConfig && !!inputAudio?.url && !isMotionCopyModel && !isLipsyncModel

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
    if (isFalMultimodalVideo && inputImage) {
      onInputImageChange(null)
    }
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
    if (!file.type.startsWith("audio/")) {
      toast.error(referenceAudioConfig?.validationMessage ?? "Use a supported audio file.")
      return
    }
    if (referenceAudioConfig && !isSupportedVideoReferenceAudioFile(selectedModel.identifier, file)) {
      toast.error(referenceAudioConfig.validationMessage)
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
    if (isFalMultimodalVideo) {
      if (falMultimodalReferenceMode) {
        return mergedPromptForReady.length > 0
      }
      return mergedPromptForReady.length > 0 || !!inputImage
    }
    if (isPrunaPVideo) {
      return mergedPromptForReady.length > 0
    }
    if (isSeedance2 || isWan27) {
      return (
        mergedPromptForReady.length > 0 ||
        !!inputImage ||
        !!lastFrameImage ||
        (!!inputVideo && isSeedance2) ||
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
    isFalMultimodalVideo,
    falMultimodalReferenceMode,
    isPrunaPVideo,
    isSeedance2,
    isWan27,
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

  const nextImageDropSlot = React.useMemo<"input" | "lastFrame" | "reference" | null>(() => {
    // Motion copy and lipsync always use an image slot
    if (isMotionCopyModel || isLipsyncModel) {
      return "input"
    }

    if (isFalMultimodalVideo) {
      if (falMultimodalReferenceMode) return "reference"
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
    isFalMultimodalVideo,
    falMultimodalReferenceMode,
    isLipsyncModel,
    isMotionCopyModel,
    lastFrameImage,
    modelSupportsImage,
    modelSupportsLastFrame,
  ])

  const nextImageDropLabel = React.useMemo(() => {
    if (nextImageDropSlot === "reference") return "Reference Image"
    if (nextImageDropSlot === "lastFrame") return isKlingV3OrOmni ? "End Frame" : "Last Frame"
    if (nextImageDropSlot === "input") {
      if (selectedModel.identifier === "minimax/hailuo-2.3-fast") return "First Frame"
      if (isFalMultimodalVideo) return "Start Frame"
      if (isKlingV3OrOmni) return "Start Frame"
      if (isMotionCopyModel || isLipsyncModel) return "Reference Image"
      return "Input Image"
    }
    return "Reference Image"
  }, [isFalMultimodalVideo, isKlingV3OrOmni, isLipsyncModel, isMotionCopyModel, nextImageDropSlot, selectedModel.identifier])

  const canAcceptImageDrop = nextImageDropSlot !== null
  const canAcceptPromptDrop = needsPrompt && (canAcceptImageDrop || canDropReferenceVideo)

  const handlePromptImageFile = React.useCallback((file?: File) => {
    if (!file || !file.type.startsWith("image/")) return

    const imageUpload: ImageUpload = {
      file,
      url: URL.createObjectURL(file),
    }

    if (nextImageDropSlot === "reference") {
      if (
        onReferenceImagesChange &&
        referenceImages.length + chipSlotInfo.omniStyleImageChipUrls.length < maxReferenceImages
      ) {
        onReferenceImagesChange([...referenceImages, imageUpload])
      }
      return
    }

    if (nextImageDropSlot === "lastFrame") {
      onLastFrameChange(imageUpload)
      return
    }

    onInputImageChange(imageUpload)
  }, [
    chipSlotInfo.omniStyleImageChipUrls.length,
    maxReferenceImages,
    nextImageDropSlot,
    onInputImageChange,
    onLastFrameChange,
    onReferenceImagesChange,
    referenceImages,
  ])

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

    if (nextImageDropSlot === "reference") {
      if (
        onReferenceImagesChange &&
        referenceImages.length + chipSlotInfo.omniStyleImageChipUrls.length < maxReferenceImages
      ) {
        onReferenceImagesChange([...referenceImages, imageUpload])
      }
      return
    }

    if (nextImageDropSlot === "lastFrame") {
      onLastFrameChange(imageUpload)
      return
    }

    onInputImageChange(imageUpload)
  }, [
    canAcceptPromptDrop,
    canDropReferenceVideo,
    chipSlotInfo.omniStyleImageChipUrls.length,
    maxReferenceImages,
    nextImageDropSlot,
    onInputImageChange,
    onInputVideoChange,
    onLastFrameChange,
    onReferenceImagesChange,
    referenceImages,
  ])

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

  const displayGenerationSlotCount =
    activeGenerationCount ?? (isGenerating ? 1 : 0)

  const generateButtonLayout = needsPrompt ? "compact" : "bar"

  const generateButtonEl = (
    <GenerateShaderButton
      layout={generateButtonLayout}
      isReady={isReady}
      isGenerating={isGenerating}
      allowConcurrent={allowConcurrent}
      onGenerate={onGenerate}
      creditCost={estimatedCredits != null ? estimatedCredits : selectedModel.model_cost ?? "-"}
      activeSlotCount={displayGenerationSlotCount}
    />
  )

  const showMediaPlusMenu =
    (modelSupportsImage || modelSupportsLastFrame || isReferenceVideoSupported) &&
    !isMotionCopyModel &&
    !isLipsyncModel

  const videoToolbarRow = (
    <LayoutGroup id="video-controls">
      <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden scroll-fade-x no-scrollbar px-2 [-webkit-overflow-scrolling:touch]">
        {showMediaPlusMenu ? (
          <AnimatedControlItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={influencerControlIconButtonClassName}
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
                    disabled={!!inputImage || chipSlotInfo.inputSlotFromChip || falMultimodalReferenceMode}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="flex items-center">
                      <FilePlus className="size-4 mr-2 shrink-0" />
                      {selectedModel.identifier === "minimax/hailuo-2.3-fast"
                        ? "Upload First Frame"
                        : isFalMultimodalVideo
                          ? "Upload Start Frame"
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
                        {isSeedance2 || isFalMultimodalVideo ? "Reference image" : "Add reference image"}
                    </span>
                    {isSeedance2 ? (
                      <span className="text-muted-foreground pl-6 text-[10px] leading-snug">
                        JPEG or PNG, up to {maxReferenceImages}. Use [Image1] in your prompt.
                      </span>
                    ) : null}
                  </DropdownMenuItem>
                )}
                {(isSeedance2 || isPrunaPVideo || isWan27) && (
                  <DropdownMenuItem
                    disabled={!canAddSeedanceReferenceAudio}
                    onClick={() => referenceAudioRef.current?.click()}
                    className="flex cursor-pointer flex-col items-start gap-0.5 py-2"
                  >
                    <span className="flex items-center text-sm font-medium">
                      <Waveform className="mr-2 size-4 shrink-0" weight="regular" />
                      {referenceAudioConfig?.title ?? "Optional audio"}
                    </span>
                    <span className="text-muted-foreground pl-6 text-[10px] leading-snug">
                      {referenceAudioConfig?.description ?? (isWan27
                        ? ".wav / .mp3, optional sync audio for Wan 2.7 (3–30s per model docs)."
                        : isPrunaPVideo
                          ? ".wav / .mp3. Conditions motion and timing for P-Video; prompt is still required."
                          : ".wav / .mp3 / .m4a / .aac (~15s). Use [Audio1]; requires a frame or reference video.")}
                    </span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </AnimatedControlItem>
        ) : null}

        {showMediaPlusMenu ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleImageUpload(e, "input")}
              className="hidden"
            />
            <input
              ref={lastFrameRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleImageUpload(e, "lastFrame")}
              className="hidden"
            />
            <input
              ref={videoRef}
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
              className="hidden"
            />
            {isSeedance2 || isPrunaPVideo || isWan27 ? (
              <input
                ref={referenceAudioRef}
                type="file"
                accept={
                  referenceAudioConfig?.accept ??
                  "audio/wav,audio/x-wav,audio/mpeg,audio/mp3,audio/mp4,audio/aac,audio/x-m4a,.wav,.mp3,.m4a,.aac"
                }
                onChange={handleReferenceAudioAdd}
                className="hidden"
                aria-hidden
              />
            ) : null}
          </>
        ) : null}

        <VideoModelParameterControls
          videoModels={videoModels}
        selectedModel={selectedModel}
        onModelChange={onModelChange}
        parameters={parameters}
        onParametersChange={onParametersChange}
        disabled={!allowOptionsDuringGeneration && isGenerating}
        variant="image"
        referenceVideoProvided={!!inputVideo || chipSlotInfo.referenceVideoSlotFromChip}
        />

      </div>
    </LayoutGroup>
  )

  // Unified interface structure
  return (
    <Card
      className={cn(
        "w-full max-w-sm sm:max-w-lg lg:max-w-4xl relative overflow-visible bg-background/95 backdrop-blur-sm",
        className,
        forceRowLayout && "shadow-2xl border-2"
      )}
      onDropCapture={handlePromptDrop}
      onDragOverCapture={handlePromptDragOver}
      onDragEnterCapture={handlePromptDragEnter}
      onDragLeaveCapture={handlePromptDragLeave}
    >
      {isPromptDragActive && canAcceptPromptDrop && (
        <div className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] border-2 border-dashed border-primary bg-primary/20" />
      )}
      <CardContent className="flex min-w-0 flex-col gap-1.5 p-2">
        {/* Image/Video Previews, manual uploads + @ library slots (same API fields) */}
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
          <div className="flex min-w-0 flex-nowrap items-start gap-2 overflow-x-auto overflow-y-hidden px-2 pt-1 [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                      : isFalMultimodalVideo
                        ? "Start Frame"
                      : isKlingV3OrOmni
                        ? "Start Frame"
                        : "Input"
                    : "@ Library · start"}
                </div>
              </div>
            )}
            {modelSupportsLastFrame && (lastFrameImage?.url || chipSlotInfo.lastFrameChipUrl) && !isMotionCopyModel && !isLipsyncModel && (
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
            {!isMotionCopyModel && isReferenceVideoSupported && (inputVideo?.url || chipSlotInfo.referenceVideoChipUrl) && (
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
            {showReferenceAudioCard && referenceAudioConfig && (
              <div className="w-[240px] max-w-full shrink-0">
                <AudioUpload
                  value={inputAudio}
                  onChange={onInputAudioChange}
                  title={referenceAudioConfig.title}
                  description={referenceAudioConfig.description}
                  accept={referenceAudioConfig.accept}
                  minHeight="min-h-[88px]"
                />
              </div>
            )}
          </div>
        )}

        {/* Prompt + Generate (same row as /image); model row below */}
        {needsPrompt && (
          <>
            <div className="flex min-w-0 items-start gap-2 px-2 pt-1">
              <div className="min-w-0 flex-1">
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
              {generateButtonEl}
            </div>
            {videoToolbarRow}
          </>
        )}

        {/* Kling v3 / Omni: Multishot */}
        {isKlingV3OrOmni && onMultiShotModeChange && onMultiShotShotsChange ? (
          <div className="mt-1 space-y-2 border-t border-border/50 px-2 pt-2">
            <IconCompactSwitch
              id="multi-shot-mode"
              checked={multiShotMode}
              onCheckedChange={onMultiShotModeChange}
              disabled={!allowOptionsDuringGeneration && isGenerating}
              ariaLabel="Multishot"
              icon={
                <FilmStrip
                  className="size-3.5"
                  weight={multiShotMode ? "fill" : "regular"}
                />
              }
            />
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
                  disabled={!allowOptionsDuringGeneration && isGenerating}
                />
              </>
            )}
          </div>
        ) : null}

        {usesRefImageGallery && onReferenceImagesChange ? (
          <input
            ref={referenceImagesRef}
            type="file"
            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            onChange={handleReferenceImageAdd}
            className="hidden"
            aria-hidden
          />
        ) : null}
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

        {/* Motion / lipsync: full-width generate, then model toolbar */}
        {!needsPrompt ? (
          <div className="px-2 pt-1">
            {generateButtonEl}
          </div>
        ) : null}
        {!needsPrompt && videoToolbarRow}

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
