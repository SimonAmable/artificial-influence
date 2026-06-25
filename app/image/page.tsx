"use client"

import * as React from "react"
import { GeneratorLayout } from "@/components/shared/layout/generator-layout"
import { InfluencerInputBox, InfluencerShowcaseCard } from "@/components/tools/influencer"
import { CharacterSwapInputBox } from "@/components/tools/character-swap"
import type { CharacterSwapMode } from "@/components/tools/character-swap/character-swap-input-box"
import { ImageGrid } from "@/components/shared/display/image-grid"
// import { GenerationHistoryColumn } from "@/components/shared/display/generation-history-column" // Temporarily disabled
import { useLayoutMode } from "@/components/shared/layout/layout-mode-context"
import { ImageUpload } from "@/components/shared/upload/photo-upload"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useModels } from "@/hooks/use-models"
import { DEFAULT_IMAGE_MODEL_IDENTIFIER } from "@/lib/constants/models"
import { useRouter, useSearchParams } from "next/navigation"
import { consumeImageGenerationIntent } from "@/lib/image/image-generation-intent"
import { appendImageReferencesToFormData } from "@/lib/image/append-references-to-form-data"
import { CreateAssetDialog } from "@/components/canvas/create-asset-dialog"
import { ImageEditorDialog } from "@/components/image-editor"
import {
  type GenerateImageAcceptedPayload,
  isContentModerationError,
  isContentModerationMessage,
  isInsufficientCreditsError,
  isInsufficientCreditsMessage,
} from "@/lib/generate-image-client"
import { toast } from "sonner"
import {
  getDefaultAspectRatioForModel,
  getSupportedAspectRatios,
  pickRetainedAspectRatio,
  resolveAspectRatioForRequest,
} from "@/lib/utils/aspect-ratios"
import type { AttachedRef } from "@/lib/commands/types"
import { buildPromptWithRefs } from "@/lib/commands/build-prompt"
import {
  brandRefsOnly,
  getImageAssetUrlsFromRefChips,
  hasVideoOrAudioAssetRefs,
} from "@/lib/commands/ref-image-pipeline"
import { stripImageMetadataAndDownload } from "@/lib/images/strip-metadata"
import { showCreditsUpsellToast } from "@/lib/pricing-upsell"
import {
  getParameterDefault,
  parseModelParameters,
  type Model,
  type ModelInputValues,
} from "@/lib/types/models"

interface ImageHistoryItem {
  id?: string
  url: string
  model: string | null
  prompt: string | null
  tool?: string | null
  aspectRatio?: string | null
  type?: string | null
  createdAt?: string | null
  reference_image_urls?: string[]
}

interface PendingImageRequest {
  clientRequestId: string
  startedAt: string
  prompt: string | null
  model: string
  tool: string
  aspectRatio: string | null
  referenceImageUrls: string[]
  /** Batch size for this request (`n` / selectedNumImages); one grid placeholder per image. */
  numImages: number
  generationId?: string | null
  predictionId?: string | null
}

const QUALITY_IMAGE_PARAMETER_NAMES = new Set(["quality", "output_quality"])

function shouldShowImageQualitySelector(modelIdentifier: string | null | undefined) {
  if (!modelIdentifier) return false
  const normalized = modelIdentifier.toLowerCase()
  return normalized.includes("nano-banana") || normalized.includes("gpt-image")
}

function getQualityModelParameters(model: Model | null): ModelInputValues {
  if (!model) return {}

  return parseModelParameters(model.parameters).reduce<ModelInputValues>((acc, param) => {
    if (!QUALITY_IMAGE_PARAMETER_NAMES.has(param.name)) {
      return acc
    }

    if (param.name === "output_quality") {
      acc[param.name] = 100
      return acc
    }

    if (param.name === "quality" && shouldShowImageQualitySelector(model.identifier)) {
      acc[param.name] = getParameterDefault(param)
    }

    return acc
  }, {})
}

function createClientRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function removeSlotByClientId(requests: PendingImageRequest[], clientRequestId: string) {
  return requests.filter((request) => request.clientRequestId !== clientRequestId)
}

function prependUniqueHistoryItems(
  currentItems: ImageHistoryItem[],
  newItems: ImageHistoryItem[]
) {
  const seenUrls = new Set<string>()

  return [...newItems, ...currentItems].filter((item) => {
    if (seenUrls.has(item.url)) {
      return false
    }

    seenUrls.add(item.url)
    return true
  })
}

/** Avoid wiping client-prepended rows when a refetch returns before the DB lists the new URL (queued generations). */
function mergeRemoteHistoryWithLocal(
  previous: ImageHistoryItem[],
  serverRows: ImageHistoryItem[]
): ImageHistoryItem[] {
  const serverByUrl = new Map(serverRows.map((row) => [row.url, row]))
  const seen = new Set<string>()
  const out: ImageHistoryItem[] = []

  // Preserve current UI order so just-completed images stay pinned at the front.
  for (const localRow of previous) {
    if (seen.has(localRow.url)) continue
    seen.add(localRow.url)
    out.push(serverByUrl.get(localRow.url) ?? localRow)
  }

  // Append any server rows that are new to the client.
  for (const serverRow of serverRows) {
    if (seen.has(serverRow.url)) continue
    seen.add(serverRow.url)
    out.push(serverRow)
  }

  return out
}

function normalizeModerationFailureMessage(message: string) {
  const trimmed = message.trim()
  if (!trimmed) {
    return "The AI model flagged this request. Try adjusting your prompt or reference images."
  }

  if (/try\s+/i.test(trimmed)) {
    return trimmed
  }

  return `${trimmed} Try adjusting your prompt or reference images.`
}

function showImageModerationToast(message: string) {
  toast.error("Generation blocked by moderation", {
    id: "image-moderation-error",
    description: `${normalizeModerationFailureMessage(message)} You were not charged, and if any credits were temporarily held they'll be refunded automatically.`,
  })
}

function showImageGenerationErrorToast(message: string, err: unknown) {
  if (isContentModerationError(err) || isContentModerationMessage(message)) {
    showImageModerationToast(message)
    return
  }

  toast.error("Image generation failed", {
    id: "image-generation-error",
    description: message,
  })
}

const CHARACTER_SWAP_UI_MODEL_IDENTIFIER = "custom/character-swap"
const CHARACTER_SWAP_BASE_MODEL_IDENTIFIER = "google/nano-banana-pro"
const IMAGE_MODEL_QUERY_ALIASES: Record<string, string> = {
  "nano-banana": "google/nano-banana-2",
  flux2: "prunaai/flux-kontext-fast",
  "gpt-image": "openai/gpt-image-2",
  "gpt-image-2": "openai/gpt-image-2",
  "grok-imagine": "xai/grok-imagine-image",
  wan: "fal-ai/wan/v2.7",
  "wan-2.7": "fal-ai/wan/v2.7",
  "wan-pro": "fal-ai/wan/v2.7/pro",
  "wan-2.7-pro": "fal-ai/wan/v2.7/pro",
  "wan-2.7-pro-image": "fal-ai/wan/v2.7/pro",
  "qwen-edit": "qwen/qwen-image-edit-plus-lora",
  "qwen-image-edit-plus": "qwen/qwen-image-edit-plus-lora",
}
const FAL_IMAGE_MODELS_WITH_SAFETY_CHECKER_FORCED_OFF = new Set([
  "fal-ai/qwen-image-2",
  "fal-ai/wan/v2.7",
  "fal-ai/wan/v2.7/pro",
  "openai/gpt-image-2",
  "bytedance/seedream-4.5",
  "bytedance/seedream-5-lite",
])
const CHARACTER_SWAP_PROMPTS: Record<CharacterSwapMode, string> = {
  full_character:
    "Character swap task using two reference images. First image is the reference character. " +
    "Second image is the reference scene and pose. Place the character from the first image into the scene from the second image. " +
    "Preserve the character's facial identity, hairstyle, body shape, skin tone, clothing, outfit, and accessories from the first image. " +
    "Strictly preserve the exact pose, body positioning, limb placement, gesture, and overall stance from the second image. " +
    "Preserve scene composition, camera angle, environment layout, and lighting mood from the second image. " +
    "Blend naturally with correct perspective, realistic scale, contact shadows, reflections, and occlusion.",
  identity_only:
    "Identity-only face transfer using two reference images. First image is the identity source (face to transfer). " +
    "Second image is the reference person/scene (clothes, pose, body, and setting to keep). " +
    "Transfer ONLY the facial identity from the first image onto the person in the second image. " +
    "From the first image preserve ONLY: face shape, eyes, nose, mouth, bone structure, and facial features; nothing else. " +
    "From the second image preserve: the exact clothing, outfit, and accessories; body proportions and pose; hairstyle and hair; skin tone; scene composition; camera angle; environment; and lighting. " +
    "The result must show the person from image two wearing their own clothes in their own pose and setting, but with the face from image one. " +
    "Adjust the transferred face to match the reference's lighting direction, color temperature, perspective, and scale. Blend seamlessly with no visible seams.",
}

function ImagePageContent() {
  const layoutModeContext = useLayoutMode()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  if (!layoutModeContext) {
    throw new Error("ImagePage must be used within LayoutModeProvider")
  }
  
  const { layoutMode } = layoutModeContext

  // State management
  const [prompt, setPrompt] = React.useState("")
  const [attachedCommandRefs, setAttachedCommandRefs] = React.useState<AttachedRef[]>([])
  const [referenceImage, setReferenceImage] = React.useState<ImageUpload | null>(null)
  const [referenceImages, setReferenceImages] = React.useState<ImageUpload[]>([])
  const [characterSwapCharacterImage, setCharacterSwapCharacterImage] = React.useState<ImageUpload | null>(null)
  const [characterSwapSceneImage, setCharacterSwapSceneImage] = React.useState<ImageUpload | null>(null)
  const [characterSwapMode, setCharacterSwapMode] = React.useState<CharacterSwapMode>("full_character")
  const [historyImages, setHistoryImages] = React.useState<ImageHistoryItem[]>([])
  const [pendingRequests, setPendingRequests] = React.useState<PendingImageRequest[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const reportImageInputError = React.useCallback((message: string) => {
    setError(message)
    toast.error(message, { id: "image-input-error" })
  }, [])
  const [historyError, setHistoryError] = React.useState<string | null>(null)
  const [enhancePrompt, setEnhancePrompt] = React.useState(false)
  const historyAbortRef = React.useRef<AbortController | null>(null)
  const historyRequestIdRef = React.useRef(0)
  const isGenerating = pendingRequests.length > 0

  const { models: imageModels, isLoading: modelsLoading } = useModels('image')
  const effectiveImageModels = React.useMemo(() => {
    if (imageModels.length === 0) return imageModels

    if (imageModels.some((model) => model.identifier === CHARACTER_SWAP_UI_MODEL_IDENTIFIER)) {
      return imageModels
    }

    const baseModel = imageModels.find((model) => model.identifier === CHARACTER_SWAP_BASE_MODEL_IDENTIFIER)
    if (!baseModel) return imageModels

    return [
      ...imageModels,
      {
        ...baseModel,
        id: `ui-${CHARACTER_SWAP_UI_MODEL_IDENTIFIER}`,
        identifier: CHARACTER_SWAP_UI_MODEL_IDENTIFIER,
        name: "Character Swap",
        description: "Swap a character into a scene using two references.",
      },
    ]
  }, [imageModels])
  
  const [selectedModel, setSelectedModel] = React.useState<string>("")
  const [selectedAspectRatio, setSelectedAspectRatio] = React.useState<string>("match_input_image")
  const [selectedNumImages, setSelectedNumImages] = React.useState<number>(1)
  const [selectedModelParameters, setSelectedModelParameters] = React.useState<ModelInputValues>({})
  const prevModelForAspectRef = React.useRef<string | null>(null)
  const isCharacterSwapModel = selectedModel === CHARACTER_SWAP_UI_MODEL_IDENTIFIER
  const selectedModelObject = React.useMemo(
    () => effectiveImageModels.find((model) => model.identifier === selectedModel) ?? null,
    [effectiveImageModels, selectedModel]
  )
  
  // Create asset dialog state
  const [createAssetDialogOpen, setCreateAssetDialogOpen] = React.useState(false)
  const [selectedImageForAsset, setSelectedImageForAsset] = React.useState<{ url: string; index: number } | null>(null)
  const [imageEditorOpen, setImageEditorOpen] = React.useState(false)
  const [imageEditorUrl, setImageEditorUrl] = React.useState<string | null>(null)

  // Upscale: which image is currently upscaling (by URL)
  const [upscalingImageUrl, setUpscalingImageUrl] = React.useState<string | null>(null)
  const [removingBackgroundImageUrl, setRemovingBackgroundImageUrl] = React.useState<string | null>(null)
  const [removingMetadataImageUrl, setRemovingMetadataImageUrl] = React.useState<string | null>(null)
  const [shouldAutoGenerate, setShouldAutoGenerate] = React.useState(false)
  const autoGenerateHandoffConsumedRef = React.useRef(false)
  const pendingAutoGenerateModelRef = React.useRef<string | null>(null)

  // Set default model when models load.
  React.useEffect(() => {
    if (effectiveImageModels.length > 0 && !selectedModel) {
      const defaultModel = effectiveImageModels.find((m) => m.identifier === DEFAULT_IMAGE_MODEL_IDENTIFIER) ?? effectiveImageModels[0]
      setSelectedModel(defaultModel.identifier)
      setSelectedAspectRatio(getDefaultAspectRatioForModel(defaultModel))
    }
  }, [effectiveImageModels, selectedModel])

  const lastLoadedModelParam = React.useRef<string | null>(null)

  // Apply `?model=` from the URL when the param or catalog changes, not when the user
  // changes the selector (including `selectedModel` here re-ran the effect and reset
  // the choice back to the URL on every pick).
  React.useEffect(() => {
    if (effectiveImageModels.length === 0) return

    const rawModelParam = searchParams.get("model")
    if (!rawModelParam) return
    
    if (rawModelParam === lastLoadedModelParam.current) return

    const normalized = rawModelParam.trim().toLowerCase()
    const targetIdentifier = IMAGE_MODEL_QUERY_ALIASES[normalized] ?? rawModelParam.trim()
    const resolvedModel = effectiveImageModels.find(
      (model) => model.identifier.toLowerCase() === targetIdentifier.toLowerCase()
    )

    if (!resolvedModel) return

    setSelectedModel((prev) =>
      prev === resolvedModel.identifier ? prev : resolvedModel.identifier
    )
    
    lastLoadedModelParam.current = rawModelParam
  }, [searchParams, effectiveImageModels])

  // Dashboard hero (or other routes) can hand off intent via sessionStorage + ?generate=1.
  React.useEffect(() => {
    if (autoGenerateHandoffConsumedRef.current) return
    if (searchParams.get("generate") !== "1") return
    if (effectiveImageModels.length === 0) return

    autoGenerateHandoffConsumedRef.current = true

    const intent = consumeImageGenerationIntent()
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete("generate")
    const nextQuery = nextParams.toString()
    router.replace(nextQuery ? `/image?${nextQuery}` : "/image", { scroll: false })

    if (!intent) return

    setPrompt(intent.prompt)
    setAttachedCommandRefs(intent.attachedRefs)
    setReferenceImages(intent.referenceImageUrls.map((url) => ({ url })))
    setReferenceImage(null)
    setEnhancePrompt(intent.enhancePrompt)
    setSelectedModel(intent.model)
    setSelectedAspectRatio(intent.aspectRatio)
    setSelectedNumImages(intent.numImages)
    pendingAutoGenerateModelRef.current = intent.model
    setShouldAutoGenerate(true)
  }, [effectiveImageModels.length, router, searchParams])

  // When the model (or catalog) changes: keep aspect ratio if the new model supports it; else default.
  // First time we bind to a model, always apply that model's default (don't "retain" initial state).
  React.useEffect(() => {
    if (!selectedModel || effectiveImageModels.length === 0) return

    const model = effectiveImageModels.find((m) => m.identifier === selectedModel)
    if (!model) return

    const prevModel = prevModelForAspectRef.current
    prevModelForAspectRef.current = selectedModel

    if (prevModel === null) {
      setSelectedAspectRatio(getDefaultAspectRatioForModel(model))
    } else {
      setSelectedAspectRatio((current) => {
        const supported = getSupportedAspectRatios(model)
        return pickRetainedAspectRatio(current, supported) ?? getDefaultAspectRatioForModel(model)
      })
    }

    const maxImages = model.max_images ?? 1
    setSelectedNumImages((prev) => (maxImages >= 1 ? Math.min(prev, maxImages) : 1))
  }, [selectedModel, effectiveImageModels])

  React.useEffect(() => {
    setSelectedModelParameters(getQualityModelParameters(selectedModelObject))
  }, [selectedModelObject])

  type FetchHistoryOptions = { silent?: boolean; replace?: boolean }

  const fetchImageHistory = React.useCallback(async (limit = 20, opts?: FetchHistoryOptions) => {
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
      const response = await fetch(`/api/generations?type=image&limit=${limit}`, {
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error("Failed to fetch image history")
      }

      const data = await response.json()
      const generations = Array.isArray(data.generations)
        ? data.generations as Array<{
            url?: string
            model?: string | null
            prompt?: string | null
            id?: string
            tool?: string | null
            aspect_ratio?: string | null
            type?: string | null
            created_at?: string | null
            reference_image_urls?: string[]
          }>
        : []

      const imageRows = generations.reduce<ImageHistoryItem[]>((items, generation) => {
        if (typeof generation.url !== "string" || generation.url.length === 0) {
          return items
        }

        items.push({
          id: generation.id,
          url: generation.url,
          model: generation.model ?? null,
          prompt: generation.prompt ?? null,
          tool: generation.tool ?? null,
          aspectRatio: generation.aspect_ratio ?? null,
          type: generation.type ?? null,
          createdAt: generation.created_at ?? null,
          reference_image_urls: generation.reference_image_urls ?? [],
        })

        return items
      }, [])

      if (requestId === historyRequestIdRef.current) {
        if (replace) {
          setHistoryImages(imageRows)
        } else {
          setHistoryImages((prev) => mergeRemoteHistoryWithLocal(prev, imageRows))
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        return
      }

      console.error("Error fetching image history:", err)

      if (requestId === historyRequestIdRef.current && !silent) {
        setHistoryError(err instanceof Error ? err.message : "Failed to fetch image history")
      }
    } finally {
      if (requestId === historyRequestIdRef.current && !silent) {
        setIsHistoryLoading(false)
      }
    }
  }, [])

  React.useEffect(() => {
    void fetchImageHistory(20)

    return () => {
      historyAbortRef.current?.abort()
    }
  }, [fetchImageHistory])

  // Handle image generation
  const handleGenerate = async () => {
    if (!isCharacterSwapModel && hasVideoOrAudioAssetRefs(attachedCommandRefs)) {
      toast.error("Video and audio assets can't be used as references for image generation.", {
        description: "Remove those @ chips or use image assets only.",
      })
      return
    }

    const mergedPrompt = buildPromptWithRefs(prompt, brandRefsOnly(attachedCommandRefs))
    const chipImageUrls = getImageAssetUrlsFromRefChips(attachedCommandRefs)
    if (
      !isCharacterSwapModel &&
      !mergedPrompt.trim() &&
      chipImageUrls.length === 0 &&
      referenceImages.length === 0 &&
      !referenceImage
    ) {
      reportImageInputError("Please enter a prompt")
      return
    }

    if (isCharacterSwapModel) {
      if (!characterSwapCharacterImage?.file) {
        reportImageInputError("Please upload a reference character image")
        return
      }

      if (!characterSwapSceneImage?.file) {
        reportImageInputError("Please upload a reference scene image")
        return
      }
    }

    setError(null)

    // Validate reference images if present
    const imagesToValidate = referenceImages.length > 0 ? referenceImages : (referenceImage ? [referenceImage] : [])
    
    for (const refImage of imagesToValidate) {
      if (refImage.file) {
        // Validate file type
        if (!refImage.file.type.startsWith('image/')) {
          reportImageInputError('Reference images must be valid image files')
          return
        }
        
        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024 // 10MB
        if (refImage.file.size > maxSize) {
          reportImageInputError('Reference images are too large. Maximum size is 10MB per image.')
          return
        }
      }
    }

    // Capture form state for append (avoids stale closure when concurrent requests complete out of order)
    const capturedPrompt = isCharacterSwapModel
      ? CHARACTER_SWAP_PROMPTS[characterSwapMode]
      : mergedPrompt.trim()
    const capturedModel = selectedModel
    const capturedTool = isCharacterSwapModel ? "character_swap" : "image"
    const manualRefUrls = isCharacterSwapModel
      ? ([characterSwapCharacterImage?.url, characterSwapSceneImage?.url].filter(Boolean) as string[])
      : (referenceImages.length > 0 ? referenceImages : referenceImage ? [referenceImage] : [])
          .map((image) => image.url)
          .filter(Boolean) as string[]
    const capturedRefUrls = isCharacterSwapModel
      ? manualRefUrls
      : [...new Set([...manualRefUrls, ...chipImageUrls])]
    const capturedAspectRatio = isCharacterSwapModel
      ? "match_input_image"
      : resolveAspectRatioForRequest({
          model: selectedModelObject,
          selectedAspectRatio,
          hasReferenceImages: capturedRefUrls.length > 0,
        })
    const clientRequestId = createClientRequestId()
    const optimisticPendingRequest: PendingImageRequest = {
      clientRequestId,
      startedAt: new Date().toISOString(),
      prompt: capturedPrompt || null,
      model: capturedModel,
      tool: capturedTool,
      aspectRatio: capturedAspectRatio,
      referenceImageUrls: capturedRefUrls,
      numImages: isCharacterSwapModel ? 1 : Math.max(1, selectedNumImages),
    }
    const capturedModelParameters = { ...selectedModelParameters }

    setPendingRequests((prev) => [optimisticPendingRequest, ...prev])

    try {

      // Create FormData for the request
      const formData = new FormData()
      formData.append(
        "prompt",
        isCharacterSwapModel ? CHARACTER_SWAP_PROMPTS[characterSwapMode] : mergedPrompt.trim()
      )
      formData.append('enhancePrompt', enhancePrompt.toString())
      
      // Add model identifier if selected
      if (selectedModel) {
        const modelForRequest =
          selectedModel === CHARACTER_SWAP_UI_MODEL_IDENTIFIER
            ? CHARACTER_SWAP_BASE_MODEL_IDENTIFIER
            : selectedModel
        formData.append('model', modelForRequest)
      }
      
      // Add aspect ratio if selected
      if (isCharacterSwapModel) {
        formData.append('aspect_ratio', 'match_input_image')
      } else if (capturedAspectRatio) {
        formData.append('aspectRatio', capturedAspectRatio)
        formData.append('aspect_ratio', capturedAspectRatio)
      }

      for (const [key, value] of Object.entries(capturedModelParameters)) {
        if (value == null || value === "") continue
        formData.append(key, String(value))
      }
      if (
        capturedModel &&
        FAL_IMAGE_MODELS_WITH_SAFETY_CHECKER_FORCED_OFF.has(capturedModel)
      ) {
        formData.set("enable_safety_checker", "false")
      }
      
      // Add reference image files if present (supports both single and multiple)
      const baseRefImages = isCharacterSwapModel
        ? [characterSwapCharacterImage, characterSwapSceneImage].filter(
            (img): img is ImageUpload => Boolean(img)
          )
        : referenceImages.length > 0
          ? referenceImages
          : referenceImage
            ? [referenceImage]
            : []
      const manualUrlSet = new Set(
        baseRefImages.map((i) => i.url).filter((u): u is string => Boolean(u))
      )
      const extraFromAssetChips: ImageUpload[] = chipImageUrls
        .filter((u) => !manualUrlSet.has(u))
        .map((url) => ({ url }))
      const imagesToUpload = [...baseRefImages, ...extraFromAssetChips]
      appendImageReferencesToFormData(formData, imagesToUpload)
      
      // Add number of images when > 1
      if (!isCharacterSwapModel && selectedNumImages > 1) {
        formData.append('n', String(selectedNumImages))
      }

      const selectedTool = isCharacterSwapModel ? 'character_swap' : 'image'
      formData.append('tool', selectedTool)

      const totalRefImages = imagesToUpload.length
      console.log('Sending request with reference images:', totalRefImages, 'numImages:', selectedNumImages)
      
      const { generateImageAndWait } = await import('@/lib/generate-image-client')
      const result = await generateImageAndWait(
        formData,
        undefined,
        ({ generationId, predictionId }: GenerateImageAcceptedPayload) => {
          setPendingRequests((prev) =>
            prev.map((request) =>
              request.clientRequestId === clientRequestId
                ? {
                    ...request,
                    generationId: generationId ?? request.generationId ?? null,
                    predictionId,
                  }
                : request
            )
          )
        }
      )

      const newItems: ImageHistoryItem[] = result.image
        ? [{ url: result.image.url, model: capturedModel, prompt: capturedPrompt || null, tool: capturedTool, aspectRatio: capturedAspectRatio, reference_image_urls: capturedRefUrls }]
        : (result.images ?? []).map((img) => ({
            url: img.url,
            model: capturedModel,
            prompt: capturedPrompt || null,
            tool: capturedTool,
            aspectRatio: capturedAspectRatio,
            reference_image_urls: capturedRefUrls,
          }))
      setPendingRequests((currentRequests) => removeSlotByClientId(currentRequests, clientRequestId))
      setHistoryImages((currentImages) => prependUniqueHistoryItems(currentImages, newItems))
      void fetchImageHistory(20, { silent: true, replace: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate image'
      const isCredits =
        isInsufficientCreditsError(err) || isInsufficientCreditsMessage(message)
      const isModeration = isContentModerationError(err)
      if (!isCredits) {
        console.error('Error generating image:', err)
      }
      setPendingRequests((currentRequests) => removeSlotByClientId(currentRequests, clientRequestId))
      if (isCredits) {
        showCreditsUpsellToast({
          message,
          description: "Upgrade your plan to continue generating images",
          toastId: "image-credits-upsell",
        })
      } else if (message.includes('Concurrency limit reached')) {
        toast.error('Too many active generations', {
          description: `${message} Wait for one to finish, then try again.`,
        })
      } else {
        const normalizedMessage = isModeration
          ? normalizeModerationFailureMessage(message)
          : message
        showImageGenerationErrorToast(message, err)
        setError(normalizedMessage)
      }
      void fetchImageHistory(20, { silent: true, replace: false })
    }
  }

  React.useEffect(() => {
    if (!shouldAutoGenerate) return
    if (!selectedModel) return
    if (pendingAutoGenerateModelRef.current && selectedModel !== pendingAutoGenerateModelRef.current) {
      return
    }

    pendingAutoGenerateModelRef.current = null
    setShouldAutoGenerate(false)
    void handleGenerate()
  }, [shouldAutoGenerate, selectedModel])

  const handleUseAsReference = React.useCallback(async (imageUrl: string) => {
    try {
      setReferenceImages((prev) => [...prev, { url: imageUrl }])
      setError(null)
      toast.success("Reference image added")
    } catch (err) {
      console.error("Error setting reference image:", err)
      setError("Could not set this image as reference. Please try another image.")
      toast.error("Could not add reference image")
    }
  }, [])

  const activeGenerationSlotCount = React.useMemo(
    () => pendingRequests.reduce((total, request) => total + request.numImages, 0),
    [pendingRequests],
  )

  const renderInputBox = React.useCallback((forceRowLayout: boolean) => {
    if (!isCharacterSwapModel) {
      return (
        <InfluencerInputBox
          forceRowLayout={forceRowLayout}
          promptValue={prompt}
          onPromptChange={setPrompt}
          onAttachedRefsChange={setAttachedCommandRefs}
          referenceImage={referenceImage}
          onReferenceImageChange={setReferenceImage}
          referenceImages={referenceImages}
          onReferenceImagesChange={setReferenceImages}
          enhancePrompt={enhancePrompt}
          onEnhancePromptChange={setEnhancePrompt}
          isGenerating={isGenerating}
          activeGenerationSlotCount={activeGenerationSlotCount}
          onGenerate={handleGenerate}
          allowConcurrent={true}
          allowOptionsDuringGeneration={true}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          showModelSelector={true}
          imageModels={effectiveImageModels}
          selectedAspectRatio={selectedAspectRatio}
          onAspectRatioChange={setSelectedAspectRatio}
          showAspectRatioSelector={true}
          selectedNumImages={selectedNumImages}
          onNumImagesChange={setSelectedNumImages}
          showNumImagesSelector={true}
          modelParameters={selectedModelParameters}
          onModelParametersChange={setSelectedModelParameters}
          allowedAssetTypes={["image"]}
        />
      )
    }

    return (
      <CharacterSwapInputBox
        characterImage={characterSwapCharacterImage}
        sceneImage={characterSwapSceneImage}
        onCharacterImageChange={setCharacterSwapCharacterImage}
        onSceneImageChange={setCharacterSwapSceneImage}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
        allowConcurrent={true}
        allowOptionsDuringGeneration={true}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        models={effectiveImageModels}
        showModelSelector={true}
        selectedSwapMode={characterSwapMode}
        onSwapModeChange={setCharacterSwapMode}
      />
    )
  }, [
    activeGenerationSlotCount,
    characterSwapMode,
    characterSwapCharacterImage,
    characterSwapSceneImage,
    effectiveImageModels,
    enhancePrompt,
    handleGenerate,
    isCharacterSwapModel,
    isGenerating,
    prompt,
    referenceImage,
    referenceImages,
    selectedAspectRatio,
    selectedModel,
    selectedModelParameters,
    selectedNumImages,
  ])

  const handleRecreate = React.useCallback((image: { prompt?: string | null; url: string; referenceImageUrls?: string[] }) => {
    if (image.prompt?.trim()) {
      setPrompt(image.prompt)
      setAttachedCommandRefs([])
    }
    // Use referenceImageUrls from the generation; if none, use the main image as reference
    const refUrls = image.referenceImageUrls && image.referenceImageUrls.length > 0
      ? image.referenceImageUrls
      : [image.url]
    setReferenceImages(refUrls.map((url) => ({ url })))
    toast.success("Prompt and references copied to input")
  }, [])

  const handleCreateAsset = React.useCallback((imageUrl: string, index: number) => {
    setSelectedImageForAsset({ url: imageUrl, index })
    setCreateAssetDialogOpen(true)
  }, [])

  const handleUpscale = React.useCallback(async (imageUrl: string, _index: number) => {
    setUpscalingImageUrl(imageUrl)
    try {
      const res = await fetch('/api/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media: imageUrl }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = data.error ?? data.message ?? 'Upscale failed'
        if (res.status === 402) {
          showCreditsUpsellToast({
            message: msg,
            description: "Get more credits to continue",
            toastId: "image-credits-upsell",
          })
        } else {
          toast.error(msg)
        }
        return
      }
      const outputUrl = data.imageUrl
      const sourceImageUrl =
        typeof data.sourceImageUrl === "string" && data.sourceImageUrl.length > 0
          ? data.sourceImageUrl
          : imageUrl
      if (outputUrl) {
        setHistoryImages((prev) =>
          prependUniqueHistoryItems(prev, [
            {
              id: typeof data.generationId === 'string' ? data.generationId : undefined,
              url: outputUrl,
              model: 'P-Image Upscale',
              prompt: null,
              tool: 'upscale',
              reference_image_urls: [sourceImageUrl],
            },
          ])
        )
      }
      toast.success('Upscale complete', {
        action: outputUrl
          ? { label: 'Open', onClick: () => window.open(outputUrl, '_blank') }
          : undefined,
      })
    } catch (err) {
      console.error('Upscale error:', err)
      toast.error(err instanceof Error ? err.message : 'Upscale failed')
    } finally {
      setUpscalingImageUrl(null)
    }
  }, [])

  const handleRemoveBackground = React.useCallback(async (imageUrl: string, _index: number) => {
    setRemovingBackgroundImageUrl(imageUrl)
    try {
      const response = await fetch('/api/remove-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const msg = data.error ?? data.message ?? 'Remove background failed'
        if (response.status === 402) {
          showCreditsUpsellToast({
            message: msg,
            description: "Remove background costs 1 credit.",
            toastId: "image-credits-upsell",
          })
        } else {
          toast.error(msg)
        }
        return
      }

      const outputUrl = data.imageUrl as string | undefined
      if (!outputUrl) {
        toast.error('Remove background failed')
        return
      }

      setHistoryImages((prev) =>
        prependUniqueHistoryItems(prev, [
          {
            url: outputUrl,
            model: 'remove-background',
            prompt: 'Background removed',
            tool: 'remove-background',
            type: 'image',
            reference_image_urls: [imageUrl],
          },
        ])
      )
      void fetchImageHistory(20, { silent: true, replace: false })

      toast.success('Background removed', {
        action: { label: 'Open', onClick: () => window.open(outputUrl, '_blank') },
      })
    } catch (err) {
      console.error('Remove background error:', err)
      toast.error(err instanceof Error ? err.message : 'Remove background failed')
    } finally {
      setRemovingBackgroundImageUrl(null)
    }
  }, [fetchImageHistory])

  const handleRemoveMetadata = React.useCallback(async (imageUrl: string, _index: number) => {
    setRemovingMetadataImageUrl(imageUrl)
    try {
      await stripImageMetadataAndDownload(imageUrl)
      toast.success("Metadata removed", {
        description: "Clean image downloaded.",
      })
    } catch (err) {
      console.error("Metadata removal error:", err)
      toast.error(err instanceof Error ? err.message : "Could not remove metadata")
    } finally {
      setRemovingMetadataImageUrl(null)
    }
  }, [])

  const handleDeleteImage = React.useCallback(async (id: string, _imageUrl: string, _index: number) => {
    try {
      const response = await fetch(`/api/generations/${id}`, {
        method: "DELETE",
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to delete image")
      }

      setHistoryImages((prev) => prev.filter((image) => image.id !== id))
      toast.success("Image deleted")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete image")
      throw err
    }
  }, [])

  // Grid order: generating (at front) → filled (newest) → older
  // Grid order: pending requests (newest first) followed by completed history.
  const gridItems = React.useMemo(() => {
    const toImageData = (img: ImageHistoryItem) => ({
      ...img,
      referenceImageUrls: img.reference_image_urls ?? (img as { referenceImageUrls?: string[] }).referenceImageUrls ?? [],
    })
    const generating = pendingRequests.flatMap((request) =>
      Array.from({ length: request.numImages }, (_, i) => ({
        type: "generating" as const,
        id: `slot-${request.clientRequestId}-${i}`,
      }))
    )
    const completed = historyImages.map((img) => ({ type: "image" as const, data: toImageData(img) }))
    return [...generating, ...completed]
  }, [historyImages, pendingRequests])

  // Render generated image or showcase card
  const renderShowcase = () => {
    const hasImages = historyImages.length > 0
    const hasItems = gridItems.length > 0

    // Always show grid if we have images OR are generating OR are loading
    // Grid will show skeleton when loading, generating card when generating
    if (hasItems || isHistoryLoading) {
      return (
        <ImageGrid
          items={gridItems}
          isLoadingSkeleton={isHistoryLoading && !hasImages && !isGenerating}
          onUseAsReference={(imageUrl) => {
            void handleUseAsReference(imageUrl)
          }}
          onEdit={(imageUrl) => {
            setImageEditorUrl(imageUrl)
            setImageEditorOpen(true)
          }}
          onRecreate={handleRecreate}
          onCreateAsset={handleCreateAsset}
          onUpscale={handleUpscale}
          onRemoveBackground={handleRemoveBackground}
          onRemoveMetadata={handleRemoveMetadata}
          onDelete={handleDeleteImage}
          upscalingImageUrl={upscalingImageUrl}
          removingBackgroundImageUrl={removingBackgroundImageUrl}
          removingMetadataImageUrl={removingMetadataImageUrl}
        />
      )
    }

    // Show error state only for generation errors; history-only errors (e.g. not logged in) show showcase
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

    // Show empty state (InfluencerShowcaseCard) when no images and not generating
    return (
      <InfluencerShowcaseCard
        tool_title=""
        title=""
        highlightedTitle="Image Generation"
        description="Create stunning images using state-of-the-art AI models."
        steps={[
          {
            mediaPath: "/hero_showcase_images/image_generation.png",
            title: "CHOOSE REFERENCE IMAGE (OPTIONAL)",
            description: "Use a reference image to guide the generation process.",
          },
          {
            mediaPath: "/hero_showcase_images/image_generation.png",
            title: "GENERATE PERSONALIZED INFLUENCER",
            description: "Get your personalized influencer content and captions",
          },
        ]}
      />
    )
  }

  const isRowLayout = layoutMode === "row"

  return (
    <div className={cn(
      "h-screen bg-background overflow-hidden flex flex-col pt-[60px]",
      isRowLayout ? "px-0 pb-0" : "pb-4 px-4 sm:pb-6 sm:px-6 md:pb-12 md:px-12"
    )}>
      <div className={cn(
        "mx-auto overflow-hidden flex-1 min-h-0 flex flex-col",
        isRowLayout ? "w-full pt-0" : "max-w-7xl pt-0"
      )}>
        <GeneratorLayout layoutMode={layoutMode} className="h-full flex-1 min-h-0">
          {isRowLayout ? (
            // Row layout: Full-screen grid fills entire screen excluding header with left history column
            <>
              <div className="flex h-full w-full">
                {/* Left History Column - Centered vertically */}
                {/* Temporarily disabled
                <div className="w-32 h-full flex items-center justify-center p-4">
                  <GenerationHistoryColumn
                    images={historyImages}
                    isGenerating={isGenerating}
                    generatingCount={selectedNumImages}
                    isLoadingSkeleton={isHistoryLoading && historyImages.length === 0}
                    maxItems={20}
                    className="w-full"
                  />
                </div>
                */}

                {/* Main Content - Full-screen grid fills entire screen excluding header and history column */}
                <div className="flex-1 w-full h-full overflow-auto pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {renderShowcase()}
                </div>
              </div>

              {/* Fixed Bottom Panel - Prompt Box (always visible) */}
              <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6">
                <div className="pointer-events-none max-w-7xl mx-auto flex justify-center">
                  <div className="pointer-events-auto w-full max-w-sm sm:max-w-lg lg:max-w-4xl">
                    {renderInputBox(true)}
                  </div>
                </div>
              </div>
            </>
          ) : (
            // Column layout: Side by side on desktop, stacked on mobile with left history column
            <>
              <div className="flex h-full w-full gap-4">
                {/* Left History Column - Hidden on mobile, Centered vertically */}
                {/* Temporarily disabled
                <div className="hidden lg:flex w-32 h-full items-center">
                  <GenerationHistoryColumn
                    images={historyImages}
                    isGenerating={isGenerating}
                    generatingCount={selectedNumImages}
                    isLoadingSkeleton={isHistoryLoading && historyImages.length === 0}
                    maxItems={20}
                    className="w-full"
                  />
                </div>
                */}

                {/* Main Content */}
                <div className="w-full flex-1 min-h-0 lg:pb-0">
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 sm:gap-6 lg:gap-12 h-full">
                    {/* Left Panel - Prompt Box (hidden on mobile, shown on desktop) */}
                    <div className="hidden lg:block lg:sticky lg:top-0 h-fit">
                      <div className="flex justify-center">
                        {renderInputBox(false)}
                      </div>
                    </div>

                    {/* Right Panel - Showcase (full-screen grid) */}
                    <div className="w-full h-full overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      {renderShowcase()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fixed Bottom Panel - Prompt Box (mobile only) */}
              <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 lg:hidden">
                <div className="pointer-events-none max-w-7xl mx-auto flex justify-center">
                  <div className="pointer-events-auto w-full max-w-sm sm:max-w-lg lg:max-w-4xl">
                    {renderInputBox(false)}
                  </div>
                </div>
              </div>
            </>
          )}
        </GeneratorLayout>
      </div>

      {/* Create Asset Dialog */}
      {selectedImageForAsset && (
        <CreateAssetDialog
          open={createAssetDialogOpen}
          onOpenChange={(open) => {
            setCreateAssetDialogOpen(open)
            if (!open) {
              setSelectedImageForAsset(null)
            }
          }}
          initial={{
            title: `Generated Image ${selectedImageForAsset.index + 1}`,
            url: selectedImageForAsset.url,
            assetType: "image",
          }}
          onSaved={() => {
            setSelectedImageForAsset(null)
          }}
        />
      )}

      <ImageEditorDialog
        open={imageEditorOpen}
        onOpenChange={(open) => {
          setImageEditorOpen(open)
          if (!open) {
            setImageEditorUrl(null)
          }
        }}
        initialImage={imageEditorUrl ?? undefined}
        onSave={() => {
          toast.success("Image saved", {
            description: "Your edited image has been saved.",
          })
        }}
      />
    </div>
  )
}

export default function ImagePage() {
  return (
    <React.Suspense fallback={null}>
      <ImagePageContent />
    </React.Suspense>
  )
}
