"use client"

import * as React from "react"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { GeneratorLayout } from "@/components/shared/layout/generator-layout"
import { VideoInputBox } from "@/components/tools/video/video-input-box"
import { VideoShowcaseCard } from "@/components/tools/video/video-showcase-card"
import { VideoGrid } from "@/components/shared/display/video-grid"
import { useLayoutMode } from "@/components/shared/layout/layout-mode-context"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import { useModels } from "@/hooks/use-models"
import { buildVideoModelParameters } from "@/lib/utils/video-model-parameters"
import type { Model, ParameterDefinition } from "@/lib/types/models"
import type { ImageUpload } from "@/components/shared/upload/photo-upload"
import type { AudioUploadValue } from "@/components/shared/upload/audio-upload"
import type { MultiShotItem } from "@/components/tools/video/multi-shot-editor"
import type { AttachedRef } from "@/lib/commands/types"
import { buildPromptWithRefs } from "@/lib/commands/build-prompt"
import { brandRefsOnly } from "@/lib/commands/ref-image-pipeline"
import { validateVideoAttachedRefs } from "@/lib/commands/validate-video-refs"
import { getVideoChipSlotInfo } from "@/lib/commands/video-chip-slots"
import { generateVideoAndWait } from "@/lib/generate-video-client"
import { isInsufficientCreditsMessage } from "@/lib/generate-image-client"
import { showCreditsUpsellToast } from "@/lib/pricing-upsell"
import { resolveVideoPricingQuote } from "@/lib/video-pricing"
import type { VideoGridItem, VideoHistoryItem } from "@/components/shared/display/video-grid"
import { toast } from "sonner"
import { CreateAssetDialog } from "@/components/canvas/create-asset-dialog"

interface PendingVideoRequest {
  clientRequestId: string
  startedAt: string
  prompt: string | null
  model: string
  modelDisplayName: string
  generationId?: string | null
  predictionId?: string | null
}

function createClientRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function removeSlotByClientId(requests: PendingVideoRequest[], clientRequestId: string) {
  return requests.filter((request) => request.clientRequestId !== clientRequestId)
}

function prependUniqueHistoryItems(currentItems: VideoHistoryItem[], newItems: VideoHistoryItem[]) {
  const seenUrls = new Set<string>()
  return [...newItems, ...currentItems].filter((item) => {
    if (!item.url || seenUrls.has(item.url)) {
      return false
    }
    seenUrls.add(item.url)
    return true
  })
}

function mergeRemoteHistoryWithLocal(
  previous: VideoHistoryItem[],
  serverRows: VideoHistoryItem[],
): VideoHistoryItem[] {
  const serverByUrl = new Map(serverRows.map((row) => [row.url, row]))
  const seen = new Set<string>()
  const out: VideoHistoryItem[] = []

  for (const localRow of previous) {
    if (!localRow.url || seen.has(localRow.url)) continue
    seen.add(localRow.url)
    out.push(serverByUrl.get(localRow.url) ?? localRow)
  }

  for (const serverRow of serverRows) {
    if (!serverRow.url || seen.has(serverRow.url)) continue
    seen.add(serverRow.url)
    out.push(serverRow)
  }

  return out
}

const VIDEO_MODEL_QUERY_ALIASES: Record<string, string> = {
  "grok-imagine-video": "xai/grok-imagine-video",
  "p-video": "prunaai/p-video",
  "pvideo": "prunaai/p-video",
  "pruna-p-video": "prunaai/p-video",
  "soul-cinema": "kwaivgi/kling-v3-video",
  "kling-v3-video": "kwaivgi/kling-v3-video",
  "seedance-2": "bytedance/seedance-2.0",
  "seedance-2.0": "bytedance/seedance-2.0",
  "wan-2.7": "wan-video/wan-2.7",
  "wan2.7": "wan-video/wan-2.7",
  "wan-27": "wan-video/wan-2.7",
  "happy-horse": "alibaba/happy-horse",
  "happyhorse": "alibaba/happy-horse",
  "happy-horse-video": "alibaba/happy-horse",
}

function VideoPageContent() {
  const layoutModeContext = useLayoutMode()
  const searchParams = useSearchParams()
  
  if (!layoutModeContext) {
    throw new Error("VideoPage must be used within LayoutModeProvider")
  }
  
  const { layoutMode } = layoutModeContext

  const { models: videoModels, isLoading: modelsLoading } = useModels("video")

  // State management
  const [selectedModel, setSelectedModel] = React.useState<Model | null>(null)
  const [inputVideoDurationSeconds, setInputVideoDurationSeconds] = React.useState<number | null>(null)
  const [inputAudioDurationSeconds, setInputAudioDurationSeconds] = React.useState<number | null>(null)

  // Set default model when models load
  React.useEffect(() => {
    if (videoModels.length > 0 && !selectedModel) {
      const first = videoModels[0]
      setSelectedModel({
        ...first,
        parameters: { parameters: buildVideoModelParameters(first) },
      })
    }
  }, [videoModels, selectedModel])

  const lastLoadedModelParam = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (videoModels.length === 0) return

    const rawModelParam = searchParams.get("model")
    if (!rawModelParam) return
    
    if (rawModelParam === lastLoadedModelParam.current) return

    const modelParam = rawModelParam.trim().toLowerCase()
    const targetIdentifier = VIDEO_MODEL_QUERY_ALIASES[modelParam] ?? rawModelParam.trim()
    const resolvedModel = videoModels.find(
      (model) => model.identifier.toLowerCase() === targetIdentifier.toLowerCase()
    )

    if (!resolvedModel) return

    setSelectedModel({
      ...resolvedModel,
      parameters: { parameters: buildVideoModelParameters(resolvedModel) },
    })
    
    lastLoadedModelParam.current = rawModelParam
  }, [searchParams, videoModels])
  const [prompt, setPrompt] = React.useState("")
  const [negativePrompt, setNegativePrompt] = React.useState("")
  const [inputImage, setInputImage] = React.useState<ImageUpload | null>(null)
  const [lastFrameImage, setLastFrameImage] = React.useState<ImageUpload | null>(null)
  const [inputVideo, setInputVideo] = React.useState<ImageUpload | null>(null)
  const [inputAudio, setInputAudio] = React.useState<AudioUploadValue | null>(null)
  const [parameters, setParameters] = React.useState<Record<string, unknown>>({})
  const [multiShotMode, setMultiShotMode] = React.useState(false)
  const [multiShotShots, setMultiShotShots] = React.useState<MultiShotItem[]>([])
  const [referenceImages, setReferenceImages] = React.useState<ImageUpload[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [historyVideos, setHistoryVideos] = React.useState<VideoHistoryItem[]>([])
  const [pendingRequests, setPendingRequests] = React.useState<PendingVideoRequest[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = React.useState(false)
  const [, setHistoryError] = React.useState<string | null>(null)
  const [attachedCommandRefs, setAttachedCommandRefs] = React.useState<AttachedRef[]>([])
  const [createAssetDialogOpen, setCreateAssetDialogOpen] = React.useState(false)
  const [selectedVideoForAsset, setSelectedVideoForAsset] = React.useState<{ url: string; index: number } | null>(
    null,
  )
  const historyAbortRef = React.useRef<AbortController | null>(null)
  const historyRequestIdRef = React.useRef(0)
  const isGenerating = pendingRequests.length > 0

  // Handle pre-loaded start frame from URL parameter (only load once)
  const hasLoadedFromUrl = React.useRef(false)
  React.useEffect(() => {
    if (hasLoadedFromUrl.current) return
    
    const startFrameUrl = searchParams.get('startFrame')
    if (startFrameUrl) {
      try {
        const decodedUrl = decodeURIComponent(startFrameUrl)
        setInputImage({ url: decodedUrl })
        hasLoadedFromUrl.current = true
      } catch (err) {
        console.error('Failed to load start frame from URL:', err)
      }
    }
  }, [searchParams])

  // Initialize parameters when model changes
  React.useEffect(() => {
    if (!selectedModel) return
    const defaultParams: Record<string, unknown> = {}
    selectedModel.parameters.parameters.forEach((param: ParameterDefinition) => {
      defaultParams[param.name] = param.default
    })
    setParameters(defaultParams)
  }, [selectedModel])

  // Kling Omni / Seedance: when reference video is added, cap extra reference images
  React.useEffect(() => {
    const id = selectedModel?.identifier
    if (id !== 'kwaivgi/kling-v3-omni-video' && id !== 'bytedance/seedance-2.0') return
    const maxWithVideo = id === 'bytedance/seedance-2.0' ? 9 : 4
    if (inputVideo && referenceImages.length > maxWithVideo) {
      setReferenceImages((prev) => prev.slice(0, maxWithVideo))
    }
  }, [inputVideo, referenceImages.length, selectedModel?.identifier])

  // When switching to Kling v3 or Omni multi-shot, init one shot if empty
  React.useEffect(() => {
    const isKlingV3OrOmni =
      selectedModel?.identifier === 'kwaivgi/kling-v3-video' ||
      selectedModel?.identifier === 'kwaivgi/kling-v3-omni-video'
    if (isKlingV3OrOmni && multiShotMode && multiShotShots.length === 0) {
      const d = Number(parameters.duration) || 5
      setMultiShotShots([{ prompt: '', duration: d }])
    }
  }, [selectedModel?.identifier, multiShotMode, multiShotShots.length, parameters.duration])

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src)
        resolve(video.duration)
      }
      video.onerror = () => {
        window.URL.revokeObjectURL(video.src)
        reject(new Error('Failed to load video metadata'))
      }
      video.src = URL.createObjectURL(file)
    })
  }

  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = document.createElement("audio")
      audio.preload = "metadata"
      audio.onloadedmetadata = () => {
        window.URL.revokeObjectURL(audio.src)
        resolve(audio.duration)
      }
      audio.onerror = () => {
        window.URL.revokeObjectURL(audio.src)
        reject(new Error("Failed to load audio metadata"))
      }
      audio.src = URL.createObjectURL(file)
    })
  }

  React.useEffect(() => {
    let cancelled = false
    if (!inputVideo?.file) {
      setInputVideoDurationSeconds(null)
      return
    }

    void getVideoDuration(inputVideo.file)
      .then((duration) => {
        if (!cancelled) setInputVideoDurationSeconds(duration)
      })
      .catch(() => {
        if (!cancelled) setInputVideoDurationSeconds(null)
      })

    return () => {
      cancelled = true
    }
  }, [inputVideo])

  React.useEffect(() => {
    let cancelled = false
    if (!inputAudio?.file) {
      setInputAudioDurationSeconds(null)
      return
    }

    void getAudioDuration(inputAudio.file)
      .then((duration) => {
        if (!cancelled) setInputAudioDurationSeconds(duration)
      })
      .catch(() => {
        if (!cancelled) setInputAudioDurationSeconds(null)
      })

    return () => {
      cancelled = true
    }
  }, [inputAudio])

  const estimatedVideoCredits = React.useMemo(() => {
    if (!selectedModel) return null

    const sourceDurationSeconds = inputVideoDurationSeconds ?? inputAudioDurationSeconds ?? null
    return resolveVideoPricingQuote({
      modelIdentifier: selectedModel.identifier,
      modelCost: selectedModel.model_cost,
      modelCostPerSecond: selectedModel.model_cost_per_second,
      duration: parameters.duration as number | string | null | undefined,
      resolution: typeof parameters.resolution === "string" ? parameters.resolution : null,
      draft: typeof parameters.draft === "boolean" ? parameters.draft : null,
      mode: typeof parameters.mode === "string" ? parameters.mode : null,
      generateAudio:
        typeof parameters.generate_audio === "boolean" ? parameters.generate_audio : null,
      characterOrientation:
        typeof parameters.character_orientation === "string"
          ? parameters.character_orientation
          : null,
      hasInputVideo: Boolean(inputVideo?.file || inputVideo?.url),
      hasReferenceVideo: Boolean(inputVideo?.file || inputVideo?.url),
      sourceDurationSeconds,
    }).quotedCredits
  }, [inputAudioDurationSeconds, inputVideo?.file, inputVideo?.url, inputVideoDurationSeconds, parameters, selectedModel])

  // Upload image to Supabase
  const uploadImageToSupabase = async (
    file: File,
    userId: string,
    prefix: string
  ): Promise<{ url: string; storagePath: string }> => {
    void userId
    const uploaded = await uploadFileToSupabase(file, prefix)
    if (!uploaded) {
      throw new Error("Failed to upload file")
    }

    return { url: uploaded.url, storagePath: uploaded.storagePath }
  }

  /** Replicate requires http(s) URLs; blob/data previews must be uploaded first. */
  const resolveBlobOrDataImageUrlForReplicate = async (
    url: string,
    file: File | undefined,
    userId: string,
    prefix: string,
  ): Promise<string> => {
    const u = url.trim()
    if (!u.startsWith("blob:") && !u.startsWith("data:")) {
      return u
    }
    if (file) {
      const r = await uploadImageToSupabase(file, userId, prefix)
      return r.url
    }
    const res = await fetch(u)
    const blob = await res.blob()
    const f = new File([blob], "last-frame.png", { type: blob.type || "image/png" })
    const r = await uploadImageToSupabase(f, userId, prefix)
    return r.url
  }

  type FetchHistoryOptions = { silent?: boolean; replace?: boolean }

  const fetchVideoHistory = React.useCallback(async (limit = 20, opts?: FetchHistoryOptions) => {
    const silent = opts?.silent === true
    const replace = opts?.replace !== false

    historyAbortRef.current?.abort()
    const controller = new AbortController()
    historyAbortRef.current = controller
    const requestId = ++historyRequestIdRef.current

    if (!silent) {
      setIsHistoryLoading(true)
      setHistoryError(null)
    }

    try {
      const response = await fetch(`/api/generations?type=video&limit=${limit}`, {
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error("Failed to fetch video history")
      }

      const data = await response.json()
      const generations = Array.isArray(data.generations)
        ? (data.generations as Array<{
            url?: string | null
            model?: string | null
            prompt?: string | null
            id?: string
            tool?: string | null
            created_at?: string | null
          }>)
        : []

      const rows = generations.reduce<VideoHistoryItem[]>((items, generation) => {
        if (typeof generation.url !== "string" || generation.url.length === 0) {
          return items
        }
        items.push({
          id: generation.id,
          url: generation.url,
          model: generation.model ?? null,
          prompt: generation.prompt ?? null,
          tool: generation.tool ?? null,
          createdAt: generation.created_at ?? null,
        })
        return items
      }, [])

      if (requestId === historyRequestIdRef.current) {
        if (replace) {
          setHistoryVideos(rows)
        } else {
          setHistoryVideos((prev) => mergeRemoteHistoryWithLocal(prev, rows))
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        return
      }
      console.error("Error fetching video history:", err)
      if (requestId === historyRequestIdRef.current && !silent) {
        setHistoryError(err instanceof Error ? err.message : "Failed to fetch video history")
      }
    } finally {
      if (requestId === historyRequestIdRef.current && !silent) {
        setIsHistoryLoading(false)
      }
    }
  }, [])

  React.useEffect(() => {
    void fetchVideoHistory(20)
    return () => {
      historyAbortRef.current?.abort()
    }
  }, [fetchVideoHistory])

  const gridItems = React.useMemo((): VideoGridItem[] => {
    const generating = pendingRequests.map((request) => ({
      type: "generating" as const,
      id: `slot-${request.clientRequestId}`,
    }))
    const completed = historyVideos
      .filter((v) => v.url)
      .map((v) => ({ type: "video" as const, data: v }))
    return [...generating, ...completed]
  }, [historyVideos, pendingRequests])

  // Handle generation
  const handleGenerate = async () => {
    if (!selectedModel) {
      setError("Please select a model")
      return
    }

    const isMotionCopy = selectedModel.identifier === 'kwaivgi/kling-v2.6-motion-control' || selectedModel.identifier === 'kwaivgi/kling-v3-motion-control'
    const isKlingV3 = selectedModel.identifier === 'kwaivgi/kling-v3-video'
    const isKlingV3Omni = selectedModel.identifier === 'kwaivgi/kling-v3-omni-video'
    const isSeedance2 = selectedModel.identifier === 'bytedance/seedance-2.0'
    const isPrunaPVideo = selectedModel.identifier === 'prunaai/p-video'
    const isWan27 = selectedModel.identifier === 'wan-video/wan-2.7'
    const isHappyHorse = selectedModel.identifier === 'alibaba/happy-horse'
    const isLipsync =
      selectedModel.identifier.includes('lipsync') ||
      selectedModel.identifier.includes('wav2lip') ||
      selectedModel.identifier === 'veed/fabric-1.0'

    if ((isKlingV3 || isKlingV3Omni) && multiShotMode && multiShotShots.length > 0) {
      const totalDuration = Number(parameters.duration) || 5
      const sum = multiShotShots.reduce((acc, s) => acc + s.duration, 0)
      if (sum !== totalDuration) {
        setError(`Multi-shot total (${sum}s) must equal duration (${totalDuration}s)`)
        return
      }
      const hasEmptyPrompt = multiShotShots.some((s) => !s.prompt.trim())
      if (hasEmptyPrompt) {
        setError("Each multi-shot must have a prompt")
        return
      }
    }

    const mergedPrompt = buildPromptWithRefs(prompt, brandRefsOnly(attachedCommandRefs)).trim()
    const chipSlots = getVideoChipSlotInfo(selectedModel, attachedCommandRefs, {
      hasInputImage: !!(inputImage?.file || inputImage?.url),
      hasLastFrame: !!(lastFrameImage?.file || lastFrameImage?.url),
      hasReferenceVideo: !!(inputVideo?.file || inputVideo?.url),
    })
    const happyHorseReferenceMode =
      isHappyHorse && (referenceImages.length > 0 || chipSlots.omniStyleImageChipUrls.length > 0)

    const refErr = validateVideoAttachedRefs(attachedCommandRefs, selectedModel)
    if (refErr) {
      setError(refErr)
      return
    }

    // Validation based on model type
    if (isMotionCopy) {
      if (!inputImage?.file) {
        setError("Please upload an image")
        return
      }
      if (!inputVideo?.file) {
        setError("Please upload a video")
        return
      }
      // Video duration: image orientation = max 10s, video orientation = max 30s
      try {
        const videoDuration = await getVideoDuration(inputVideo.file)
        const characterOrientation = (parameters.character_orientation as string) || 'video'
        const maxDuration = characterOrientation === 'video' ? 30 : 10
        if (videoDuration > maxDuration) {
          setError(`Video must be ${maxDuration} seconds or less for ${characterOrientation} orientation. Your video is ${videoDuration.toFixed(1)} seconds.`)
          return
        }
      } catch (err) {
        console.error('Error validating video duration:', err)
        setError('Failed to validate video duration. Please try again.')
        return
      }
    } else if (isLipsync) {
      if (!inputImage?.file) {
        setError("Please upload an image or video")
        return
      }
      const refIsImage = inputImage.file.type.startsWith("image/")
      const refIsVideo = inputImage.file.type.startsWith("video/")
      if (!refIsImage && !refIsVideo) {
        setError("Please upload a valid image or video file")
        return
      }
      if (!inputAudio?.file) {
        setError("Please upload an audio file")
        return
      }
    } else if (!mergedPrompt.trim()) {
      const allowNoPrompt =
        ((isKlingV3 || isKlingV3Omni) &&
          ((multiShotMode && multiShotShots.length > 0) ||
            !!inputImage ||
            !!chipSlots.startImageChipUrl ||
            !!chipSlots.lastFrameChipUrl ||
            !!chipSlots.referenceVideoChipUrl ||
            chipSlots.omniStyleImageChipUrls.length > 0)) ||
        (isSeedance2 &&
          (!!inputImage ||
            !!lastFrameImage ||
            !!inputVideo ||
            !!inputAudio ||
            referenceImages.length > 0 ||
            !!chipSlots.startImageChipUrl ||
            !!chipSlots.lastFrameChipUrl ||
            !!chipSlots.referenceVideoChipUrl ||
            chipSlots.omniStyleImageChipUrls.length > 0)) ||
        (isWan27 &&
          (!!inputImage ||
            !!lastFrameImage ||
            !!inputAudio ||
            !!chipSlots.startImageChipUrl ||
            !!chipSlots.lastFrameChipUrl)) ||
        (isHappyHorse &&
          !happyHorseReferenceMode &&
          (!!inputImage || !!chipSlots.startImageChipUrl))
      if (!allowNoPrompt) {
        setError("Please enter a prompt")
        return
      }
    }

    const clientRequestId = createClientRequestId()
    const capture = {
      model: selectedModel,
      mergedPrompt,
      parameters: { ...parameters },
      negativePrompt,
      inputImage,
      lastFrameImage,
      inputVideo,
      inputAudio,
      referenceImages: [...referenceImages],
      attachedCommandRefs: [...attachedCommandRefs],
      chipSlots,
      multiShotMode,
      multiShotShots: multiShotShots.map((s) => ({ ...s })),
      promptForMultiShot: prompt,
      isMotionCopy,
      isKlingV3,
      isKlingV3Omni,
      isSeedance2,
      isPrunaPVideo,
      isWan27,
      isHappyHorse,
      happyHorseReferenceMode,
      isLipsync,
    }

    setPendingRequests((prev) => [
      {
        clientRequestId,
        startedAt: new Date().toISOString(),
        prompt: mergedPrompt || null,
        model: selectedModel.identifier,
        modelDisplayName: selectedModel.name,
      },
      ...prev,
    ])
    setError(null)

    void (async () => {
      const selectedModel = capture.model
      const mergedPrompt = capture.mergedPrompt
      const parameters = capture.parameters
      const negativePrompt = capture.negativePrompt
      const inputImage = capture.inputImage
      const lastFrameImage = capture.lastFrameImage
      const inputVideo = capture.inputVideo
      const inputAudio = capture.inputAudio
      const referenceImages = capture.referenceImages
      const attachedCommandRefs = capture.attachedCommandRefs
      const chipSlots = capture.chipSlots
      const multiShotMode = capture.multiShotMode
      const multiShotShots = capture.multiShotShots
      const prompt = capture.promptForMultiShot
      const isMotionCopy = capture.isMotionCopy
      const isKlingV3 = capture.isKlingV3
      const isKlingV3Omni = capture.isKlingV3Omni
      const isSeedance2 = capture.isSeedance2
      const isPrunaPVideo = capture.isPrunaPVideo
      const isWan27 = capture.isWan27
      const isHappyHorse = capture.isHappyHorse
      const happyHorseReferenceMode = capture.happyHorseReferenceMode
      const isLipsync = capture.isLipsync

      try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        throw new Error("Please log in to generate videos")
      }

      // Build request body based on model
      // Exclude prompt, image, video from parameters since they're managed separately
      const otherParameters = { ...parameters }
      delete otherParameters.prompt
      delete otherParameters.image
      delete otherParameters.video
      const requestBody: Record<string, unknown> = {
        model: selectedModel.identifier,
        prompt: mergedPrompt,
        ...otherParameters,
      }
      const sourceDurationSeconds =
        inputVideo?.file
          ? await getVideoDuration(inputVideo.file)
          : inputAudio?.file
            ? await getAudioDuration(inputAudio.file)
            : null
      if (sourceDurationSeconds != null && Number.isFinite(sourceDurationSeconds)) {
        requestBody.sourceDurationSeconds = sourceDurationSeconds
      }

      // Handle motion copy uploads
      if (isMotionCopy && inputImage?.file && inputVideo?.file) {
        const imageUpload = await uploadImageToSupabase(inputImage.file, user.id, 'motion-copy-images')
        const videoUpload = await uploadImageToSupabase(inputVideo.file, user.id, 'motion-copy-videos')
        requestBody.imagePublicUrl = imageUpload.url
        requestBody.videoPublicUrl = videoUpload.url
      }
      
      // Handle lipsync uploads (image → veed/fabric; video → pixverse/lipsync)
      else if (isLipsync && inputImage?.file && inputAudio?.file) {
        const audioUpload = await uploadImageToSupabase(inputAudio.file, user.id, 'lipsync-audio')
        requestBody.audioUrl = audioUpload.url
        requestBody.audioStoragePath = audioUpload.storagePath

        if (inputImage.file.type.startsWith('video/')) {
          const videoUpload = await uploadImageToSupabase(inputImage.file, user.id, 'lipsync-videos')
          requestBody.videoUrl = videoUpload.url
          requestBody.videoStoragePath = videoUpload.storagePath
        } else {
          const imageUpload = await uploadImageToSupabase(inputImage.file, user.id, 'lipsync-images')
          requestBody.imageUrl = imageUpload.url
          requestBody.imageStoragePath = imageUpload.storagePath
          requestBody.resolution = (parameters.resolution as string) || '720p'
        }
      }
      
      // Handle other models with image uploads
      else if (inputImage?.file && !(isHappyHorse && happyHorseReferenceMode)) {
        const imageUpload = await uploadImageToSupabase(inputImage.file, user.id, 'video-gen-input-images')
        if (selectedModel.identifier === 'kwaivgi/kling-v2.6') {
          requestBody.start_image = imageUpload.url
        } else if (isKlingV3 || isKlingV3Omni) {
          requestBody.start_image = imageUpload.url
        } else {
          requestBody.image = imageUpload.url
        }
        // For first_frame_image parameter (Hailuo)
        if (selectedModel.identifier === 'minimax/hailuo-2.3-fast') {
          requestBody.first_frame_image = imageUpload.url
        }
      }
      // Handle pre-loaded images from URL (no file to upload)
      else if (inputImage?.url && !(isHappyHorse && happyHorseReferenceMode)) {
        const firstUrl =
          isWan27
            ? await resolveBlobOrDataImageUrlForReplicate(
                inputImage.url,
                inputImage.file,
                user.id,
                "video-gen-input-images",
              )
            : inputImage.url
        if (selectedModel.identifier === 'kwaivgi/kling-v2.6') {
          requestBody.start_image = firstUrl
        } else if (isKlingV3 || isKlingV3Omni) {
          requestBody.start_image = firstUrl
        } else {
          requestBody.image = firstUrl
        }
        // For first_frame_image parameter (Hailuo)
        if (selectedModel.identifier === 'minimax/hailuo-2.3-fast') {
          requestBody.first_frame_image = firstUrl
        }
      }

      if (
        !requestBody.start_image &&
        !requestBody.image &&
        !requestBody.first_frame_image &&
        chipSlots.startImageChipUrl
      ) {
        const u = chipSlots.startImageChipUrl
        if (selectedModel.identifier === 'kwaivgi/kling-v2.6' || isKlingV3 || isKlingV3Omni) {
          requestBody.start_image = u
        } else if (selectedModel.identifier === 'minimax/hailuo-2.3-fast') {
          requestBody.first_frame_image = u
        } else {
          requestBody.image = u
        }
      }

      if (
        lastFrameImage?.file &&
        (selectedModel.identifier === 'google/veo-3.1-fast' ||
          isKlingV3 ||
          isKlingV3Omni ||
          isSeedance2 ||
          isPrunaPVideo ||
          isWan27)
      ) {
        const lastFrameUpload = await uploadImageToSupabase(lastFrameImage.file, user.id, 'video-gen-last-frames')
        requestBody.last_frame = lastFrameUpload.url
        if (isSeedance2 || isPrunaPVideo) requestBody.last_frame_image = lastFrameUpload.url
        if (isKlingV3 || isKlingV3Omni) requestBody.end_image = lastFrameUpload.url
      }
      if (!lastFrameImage?.file && lastFrameImage?.url && (isKlingV3 || isKlingV3Omni)) {
        requestBody.end_image = lastFrameImage.url
      }
      if (!lastFrameImage?.file && lastFrameImage?.url && (isSeedance2 || isPrunaPVideo)) {
        requestBody.last_frame_image = lastFrameImage.url
      }
      if (lastFrameImage?.url && isWan27 && !requestBody.last_frame) {
        requestBody.last_frame = await resolveBlobOrDataImageUrlForReplicate(
          lastFrameImage.url,
          lastFrameImage.file,
          user.id,
          "video-gen-last-frames",
        )
      }
      if (
        !requestBody.last_frame &&
        chipSlots.lastFrameChipUrl &&
        (selectedModel.identifier === 'google/veo-3.1-fast' ||
          isKlingV3 ||
          isKlingV3Omni ||
          isSeedance2 ||
          isPrunaPVideo ||
          isWan27)
      ) {
        requestBody.last_frame = chipSlots.lastFrameChipUrl
        if (isSeedance2 || isPrunaPVideo) requestBody.last_frame_image = chipSlots.lastFrameChipUrl
        if (isKlingV3 || isKlingV3Omni) requestBody.end_image = chipSlots.lastFrameChipUrl
      }

      if (negativePrompt && (selectedModel.identifier === 'google/veo-3.1-fast' || isKlingV3 || isKlingV3Omni || isWan27)) {
        requestBody.negative_prompt = negativePrompt
      }

      if ((isKlingV3 || isKlingV3Omni) && multiShotMode && multiShotShots.length > 0) {
        requestBody.multi_prompt = JSON.stringify(multiShotShots)
        const first = multiShotShots[0]?.prompt ?? prompt
        requestBody.prompt = buildPromptWithRefs(first, brandRefsOnly(attachedCommandRefs)).trim()
      }

      // Kling v3 Omni: reference video (editing or style reference)
      if (isKlingV3Omni && inputVideo?.file) {
        const videoUpload = await uploadImageToSupabase(inputVideo.file, user.id, 'video-gen-reference-videos')
        requestBody.reference_video = videoUpload.url
      }
      if (!inputVideo?.file && isKlingV3Omni && inputVideo?.url) {
        requestBody.reference_video = inputVideo.url
      }
      if (isKlingV3Omni && !requestBody.reference_video && chipSlots.referenceVideoChipUrl) {
        requestBody.reference_video = chipSlots.referenceVideoChipUrl
      }

      if (isSeedance2 && inputVideo?.file) {
        const videoUpload = await uploadImageToSupabase(inputVideo.file, user.id, 'video-gen-reference-videos')
        requestBody.reference_videos = [videoUpload.url]
      }
      if (!inputVideo?.file && isSeedance2 && inputVideo?.url) {
        requestBody.reference_videos = [inputVideo.url]
      }
      if (isSeedance2 && !requestBody.reference_videos && chipSlots.referenceVideoChipUrl) {
        requestBody.reference_videos = [chipSlots.referenceVideoChipUrl]
      }

      if (isSeedance2 && inputAudio?.file) {
        const audioUpload = await uploadImageToSupabase(inputAudio.file, user.id, 'video-gen-reference-audios')
        requestBody.reference_audios = [audioUpload.url]
      }
      if (!inputAudio?.file && isSeedance2 && inputAudio?.url) {
        requestBody.reference_audios = [inputAudio.url]
      }

      if (isPrunaPVideo && inputAudio?.file) {
        const audioUpload = await uploadImageToSupabase(inputAudio.file, user.id, 'video-gen-pruna-audio')
        requestBody.audio = audioUpload.url
      }
      if (!inputAudio?.file && isPrunaPVideo && inputAudio?.url) {
        requestBody.audio = inputAudio.url
      }

      if (isWan27 && inputAudio?.file) {
        const audioUpload = await uploadImageToSupabase(inputAudio.file, user.id, 'video-gen-wan-audio')
        requestBody.audio = audioUpload.url
      }
      if (!inputAudio?.file && isWan27 && inputAudio?.url) {
        requestBody.audio = inputAudio.url
      }

      // Kling v3 Omni / Seedance 2.0: extra reference images
      if ((isKlingV3Omni || isSeedance2 || isHappyHorse) && referenceImages.length > 0) {
        const refUrls: string[] = []
        for (const ref of referenceImages) {
          if (ref.file) {
            const up = await uploadImageToSupabase(ref.file, user.id, 'video-gen-reference-images')
            refUrls.push(up.url)
          } else if (ref.url) {
            refUrls.push(ref.url)
          }
        }
        if (refUrls.length > 0) requestBody.reference_images = refUrls
      }
      if ((isKlingV3Omni || isSeedance2 || isHappyHorse) && chipSlots.omniStyleImageChipUrls.length > 0) {
        const existing = Array.isArray(requestBody.reference_images)
          ? (requestBody.reference_images as string[])
          : []
        requestBody.reference_images = [...new Set([...existing, ...chipSlots.omniStyleImageChipUrls])]
      }

      // Grok Imagine Video: reference video for video editing mode
      if (inputVideo?.file && selectedModel.identifier === 'xai/grok-imagine-video') {
        const videoUpload = await uploadImageToSupabase(inputVideo.file, user.id, 'video-gen-reference-videos')
        requestBody.video = videoUpload.url
      }
      if (
        selectedModel.identifier === "xai/grok-imagine-video" &&
        !requestBody.video &&
        chipSlots.referenceVideoChipUrl
      ) {
        requestBody.video = chipSlots.referenceVideoChipUrl
      }

      requestBody.tool = isLipsync ? 'lipsync' : 'video'

      console.log('Sending video generation request:', requestBody)

      const endpoint = isLipsync ? '/api/generate-lipsync' : '/api/generate-video-any-model'

      const data = isLipsync
        ? await (async () => {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            })

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}))
              throw new Error(errorData.error || errorData.message || 'Failed to generate video')
            }

            return response.json()
          })()
        : await generateVideoAndWait(endpoint, requestBody, {
            onAccepted: ({ generationId, predictionId }) => {
              setPendingRequests((prev) =>
                prev.map((request) =>
                  request.clientRequestId === clientRequestId
                    ? {
                        ...request,
                        generationId: generationId ?? request.generationId ?? null,
                        predictionId: predictionId ?? request.predictionId ?? null,
                      }
                    : request,
                ),
              )
            },
          })

      const resultVideoUrl =
        typeof data.video?.url === "string"
          ? data.video.url
          : undefined

      if (resultVideoUrl) {
        const newItem: VideoHistoryItem = {
          url: resultVideoUrl,
          model: selectedModel.name,
          prompt: mergedPrompt || null,
          tool: isLipsync ? "lipsync" : "video",
          createdAt: new Date().toISOString(),
          timestamp: Date.now(),
          parameters: { ...parameters, prompt: mergedPrompt },
        }
        setPendingRequests((current) => removeSlotByClientId(current, clientRequestId))
        setHistoryVideos((current) => prependUniqueHistoryItems(current, [newItem]))
        void fetchVideoHistory(20, { silent: true, replace: false })
      } else {
        setPendingRequests((current) => removeSlotByClientId(current, clientRequestId))
        setError("No video URL returned")
      }
      } catch (err) {
        const message = err instanceof Error ? err.message : "An error occurred"
        console.error("Generation error:", err)
        setPendingRequests((current) => removeSlotByClientId(current, clientRequestId))
        if (isInsufficientCreditsMessage(message)) {
          showCreditsUpsellToast({
            message,
            description: "Upgrade your plan to continue generating videos",
            toastId: "video-credits-upsell",
          })
        } else if (message.includes("Concurrency limit reached")) {
          toast.error("Too many active generations", {
            description: `${message} Wait for one to finish, then try again.`,
          })
        } else {
          setError(message)
        }
        void fetchVideoHistory(20, { silent: true, replace: false })
      }
    })()
  }

  const handleUseVideoAsReference = React.useCallback((videoUrl: string) => {
    setInputVideo({ url: videoUrl })
    setError(null)
    toast.success("Reference video set")
  }, [])

  const handleSaveVideoAsAsset = React.useCallback((videoUrl: string, index: number) => {
    setSelectedVideoForAsset({ url: videoUrl, index })
    setCreateAssetDialogOpen(true)
  }, [])

  const handleDeleteVideo = React.useCallback(async (id: string, _videoUrl: string, _index: number) => {
    void _videoUrl
    void _index
    try {
      const response = await fetch(`/api/generations/${id}`, {
        method: "DELETE",
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to delete video")
      }

      setHistoryVideos((prev) => prev.filter((video) => video.id !== id))
      toast.success("Video deleted")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete video")
      throw err
    }
  }, [])

  // Render showcase
  const renderShowcase = () => {
    const hasItems = gridItems.length > 0

    if (hasItems || isHistoryLoading) {
      return (
        <VideoGrid
          items={gridItems}
          isLoadingSkeleton={
            isHistoryLoading && historyVideos.length === 0 && pendingRequests.length === 0
          }
          showNativeControlsOnHoverOnly
          onUseVideoAsReference={handleUseVideoAsReference}
          onSaveVideoAsAsset={handleSaveVideoAsAsset}
          onDelete={handleDeleteVideo}
        />
      )
    }

    if (error) {
      return (
        <Card className="w-full h-full flex flex-col">
          <CardContent className="flex flex-col items-center justify-center flex-1 p-8">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={handleGenerate} variant="default">
              Try Again
            </Button>
          </CardContent>
        </Card>
      )
    }

    return (
      <VideoShowcaseCard
        tool_title=""
        title=""
        highlightedTitle="Video Generation"
        description="Create stunning AI-generated videos with state-of-the-art models."
        steps={[
          {
            mediaPath: "/motion_copy/motion_copy_with_overlay.mp4",
            title: "",
            description: "",
            mediaType: "video",
          },
        ]}
      />
    )
  }

  const isRowLayout = layoutMode === "row"

  if (modelsLoading || !selectedModel) {
    if (!modelsLoading && videoModels.length === 0) {
      return (
        <div className="flex h-screen items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">No video models available.</p>
        </div>
      )
    }
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading models...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "h-screen bg-background overflow-hidden flex flex-col",
      isRowLayout ? "p-0" : "p-4 sm:p-6 md:p-12"
    )}>
      <div className={cn(
        "mx-auto overflow-hidden flex-1 min-h-0 flex flex-col",
        isRowLayout ? "w-full pt-20" : "max-w-7xl pt-12"
      )}>
        <GeneratorLayout layoutMode={layoutMode} className="h-full flex-1 min-h-0">
          {isRowLayout ? (
            // Row layout: Full-screen grid fills entire screen excluding header
            <>
              {/* Main Content - Full-screen grid */}
              <div className="flex-1 w-full h-full overflow-auto pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {renderShowcase()}
              </div>

              {/* Fixed Bottom Panel - Input Box */}
              <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6">
                <div className="max-w-7xl mx-auto flex justify-center">
                  <VideoInputBox
                    videoModels={videoModels}
                    forceRowLayout={true}
                    promptValue={prompt}
                    onPromptChange={setPrompt}
                    negativePromptValue={negativePrompt}
                    onNegativePromptChange={setNegativePrompt}
                    selectedModel={selectedModel!}
                    onModelChange={setSelectedModel}
                    inputImage={inputImage}
                    onInputImageChange={setInputImage}
                    lastFrameImage={lastFrameImage}
                    onLastFrameChange={setLastFrameImage}
                    inputVideo={inputVideo}
                    onInputVideoChange={setInputVideo}
                    inputAudio={inputAudio}
                    onInputAudioChange={setInputAudio}
                    parameters={parameters}
                    onParametersChange={setParameters}
                    estimatedCredits={estimatedVideoCredits}
                    isGenerating={isGenerating}
                    onGenerate={handleGenerate}
                    allowConcurrent={true}
                    allowOptionsDuringGeneration={true}
                    multiShotMode={multiShotMode}
                    onMultiShotModeChange={setMultiShotMode}
                    multiShotShots={multiShotShots}
                    onMultiShotShotsChange={setMultiShotShots}
                    referenceImages={referenceImages}
                    onReferenceImagesChange={setReferenceImages}
                    attachedRefs={attachedCommandRefs}
                    onAttachedRefsChange={setAttachedCommandRefs}
                  />
                </div>
              </div>
            </>
          ) : (
            // Column layout: Side by side on desktop, stacked on mobile
            <>
              {/* Main Content */}
              <div className="w-full flex-1 min-h-0 lg:pb-0">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 sm:gap-6 lg:gap-12 h-full">
                  {/* Left Panel - Input Box (hidden on mobile, shown on desktop) */}
                  <div className="hidden lg:block lg:sticky lg:top-0 h-fit">
                    <div className="flex justify-center">
                      <VideoInputBox
                        videoModels={videoModels}
                        forceRowLayout={false}
                        promptValue={prompt}
                        onPromptChange={setPrompt}
                        negativePromptValue={negativePrompt}
                        onNegativePromptChange={setNegativePrompt}
                        selectedModel={selectedModel!}
                        onModelChange={setSelectedModel}
                        inputImage={inputImage}
                        onInputImageChange={setInputImage}
                        lastFrameImage={lastFrameImage}
                        onLastFrameChange={setLastFrameImage}
                        inputVideo={inputVideo}
                        onInputVideoChange={setInputVideo}
                        inputAudio={inputAudio}
                        onInputAudioChange={setInputAudio}
                        parameters={parameters}
                        onParametersChange={setParameters}
                        estimatedCredits={estimatedVideoCredits}
                        isGenerating={isGenerating}
                        onGenerate={handleGenerate}
                        allowConcurrent={true}
                        allowOptionsDuringGeneration={true}
                        multiShotMode={multiShotMode}
                        onMultiShotModeChange={setMultiShotMode}
                        multiShotShots={multiShotShots}
                        onMultiShotShotsChange={setMultiShotShots}
                        referenceImages={referenceImages}
                        onReferenceImagesChange={setReferenceImages}
                        attachedRefs={attachedCommandRefs}
                        onAttachedRefsChange={setAttachedCommandRefs}
                      />
                    </div>
                  </div>

                  {/* Right Panel - Showcase (full-screen grid) */}
                  <div className="w-full h-full overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {renderShowcase()}
                  </div>
                </div>
              </div>

              {/* Fixed Bottom Panel - Input Box (mobile only) */}
              <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 lg:hidden">
                <div className="max-w-7xl mx-auto flex justify-center">
                  <VideoInputBox
                    videoModels={videoModels}
                    forceRowLayout={false}
                    promptValue={prompt}
                    onPromptChange={setPrompt}
                    negativePromptValue={negativePrompt}
                    onNegativePromptChange={setNegativePrompt}
                    selectedModel={selectedModel!}
                    onModelChange={setSelectedModel}
                    inputImage={inputImage}
                    onInputImageChange={setInputImage}
                    lastFrameImage={lastFrameImage}
                    onLastFrameChange={setLastFrameImage}
                    inputVideo={inputVideo}
                    onInputVideoChange={setInputVideo}
                    inputAudio={inputAudio}
                    onInputAudioChange={setInputAudio}
                    parameters={parameters}
                    onParametersChange={setParameters}
                    estimatedCredits={estimatedVideoCredits}
                    isGenerating={isGenerating}
                    onGenerate={handleGenerate}
                    allowConcurrent={true}
                    allowOptionsDuringGeneration={true}
                    multiShotMode={multiShotMode}
                    onMultiShotModeChange={setMultiShotMode}
                    multiShotShots={multiShotShots}
                    onMultiShotShotsChange={setMultiShotShots}
                    referenceImages={referenceImages}
                    onReferenceImagesChange={setReferenceImages}
                    attachedRefs={attachedCommandRefs}
                    onAttachedRefsChange={setAttachedCommandRefs}
                  />
                </div>
              </div>
            </>
          )}
        </GeneratorLayout>
      </div>

      {selectedVideoForAsset && (
        <CreateAssetDialog
          open={createAssetDialogOpen}
          onOpenChange={(open) => {
            setCreateAssetDialogOpen(open)
            if (!open) {
              setSelectedVideoForAsset(null)
            }
          }}
          initial={{
            title: `Generated Video ${selectedVideoForAsset.index + 1}`,
            url: selectedVideoForAsset.url,
            assetType: "video",
          }}
          onSaved={() => {
            setSelectedVideoForAsset(null)
          }}
        />
      )}
    </div>
  )
}

export default function VideoPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <VideoPageContent />
    </Suspense>
  )
}
