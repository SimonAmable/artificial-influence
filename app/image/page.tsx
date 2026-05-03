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
import { useSearchParams } from "next/navigation"
import { CreateAssetDialog } from "@/components/canvas/create-asset-dialog"
import {
  type GenerateImageAcceptedPayload,
  isInsufficientCreditsError,
  isInsufficientCreditsMessage,
} from "@/lib/generate-image-client"
import { toast } from "sonner"
import {
  getDefaultAspectRatioForModel,
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
  generationId?: string | null
  predictionId?: string | null
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
}
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
  const isCharacterSwapModel = selectedModel === CHARACTER_SWAP_UI_MODEL_IDENTIFIER
  
  // Create asset dialog state
  const [createAssetDialogOpen, setCreateAssetDialogOpen] = React.useState(false)
  const [selectedImageForAsset, setSelectedImageForAsset] = React.useState<{ url: string; index: number } | null>(null)

  // Upscale: which image is currently upscaling (by URL)
  const [upscalingImageUrl, setUpscalingImageUrl] = React.useState<string | null>(null)
  const [removingMetadataImageUrl, setRemovingMetadataImageUrl] = React.useState<string | null>(null)

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

  // Update aspect ratio and clamp numImages when model changes
  React.useEffect(() => {
    if (selectedModel && effectiveImageModels.length > 0) {
      const model = effectiveImageModels.find(m => m.identifier === selectedModel)
      if (model) {
        setSelectedAspectRatio(getDefaultAspectRatioForModel(model))
      }
      const maxImages = model?.max_images ?? 1
      setSelectedNumImages((prev) => (maxImages >= 1 ? Math.min(prev, maxImages) : 1))
    }
  }, [selectedModel, effectiveImageModels])

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
      setError("Please enter a prompt")
      return
    }

    if (isCharacterSwapModel) {
      if (!characterSwapCharacterImage?.file) {
        setError("Please upload a reference character image")
        return
      }

      if (!characterSwapSceneImage?.file) {
        setError("Please upload a reference scene image")
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
          setError('Reference images must be valid image files')
          return
        }
        
        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024 // 10MB
        if (refImage.file.size > maxSize) {
          setError('Reference images are too large. Maximum size is 10MB per image.')
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
    const selectedModelObject =
      effectiveImageModels.find((model) => model.identifier === selectedModel) ?? null
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
    }

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

      for (const refImage of imagesToUpload) {
        if (refImage.file) {
          formData.append('referenceImages', refImage.file)
        } else if (refImage.url && !refImage.file) {
          // For URLs from history/assets, we need to fetch and convert to file
          try {
            const response = await fetch(refImage.url)
            const blob = await response.blob()
            const file = new File([blob], `reference-${Date.now()}.png`, { type: blob.type || 'image/png' })
            formData.append('referenceImages', file)
          } catch (error) {
            console.error('Error fetching reference image URL:', error)
          }
        }
      }
      
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
      if (!isCredits) {
        console.error('Error generating image:', err)
      }
      setPendingRequests((currentRequests) => removeSlotByClientId(currentRequests, clientRequestId))
      if (isCredits) {
        toast.error(message, {
          description: 'Upgrade your plan to continue generating images',
          action: { label: 'View Plans', onClick: () => window.open('/pricing', '_blank') },
        })
      } else if (message.includes('Concurrency limit reached')) {
        toast.error('Too many active generations', {
          description: `${message} Wait for one to finish, then try again.`,
        })
      }
      setError(message)
      void fetchImageHistory(20, { silent: true, replace: false })
    }
  }

  const handleUseAsReference = React.useCallback(async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl)
      if (!response.ok) {
        throw new Error("Failed to fetch image for reference")
      }

      const blob = await response.blob()
      const mimeType = blob.type || "image/png"
      const extension = mimeType.split("/")[1] || "png"
      const file = new File([blob], `reference-${Date.now()}.${extension}`, { type: mimeType })

      // Always add to referenceImages (InfluencerInputBox displays referenceImages when onReferenceImagesChange is passed)
      setReferenceImages((prev) => [...prev, { file, url: imageUrl }])
      setError(null)
      toast.success("Reference image added")
    } catch (err) {
      console.error("Error setting reference image:", err)
      setError("Could not set this image as reference. Please try another image.")
      toast.error("Could not add reference image")
    }
  }, [])

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
        toast.error(msg)
        if (res.status === 402) {
          toast.error(msg, {
            description: 'Get more credits to continue',
            action: { label: 'View Plans', onClick: () => window.open('/pricing', '_blank') },
          })
        }
        return
      }
      const outputUrl = data.imageUrl
      if (outputUrl) {
        setHistoryImages((prev) => [
          { url: outputUrl, model: 'Creative Upscale', prompt: null },
          ...prev,
        ])
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
    const generating = pendingRequests.map((request) => ({
      type: "generating" as const,
      // Stable key for the lifetime of this request (do not switch to predictionId, avoids remount/flicker).
      id: `slot-${request.clientRequestId}`,
    }))
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
          onRecreate={handleRecreate}
          onCreateAsset={handleCreateAsset}
          onUpscale={handleUpscale}
          onRemoveMetadata={handleRemoveMetadata}
          onDelete={handleDeleteImage}
          upscalingImageUrl={upscalingImageUrl}
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
      "h-screen bg-background overflow-hidden flex flex-col",
      isRowLayout ? "p-0" : "p-4 sm:p-6 md:p-12"
    )}>
      <div className={cn(
        "mx-auto overflow-hidden flex-1 min-h-0 flex flex-col",
        isRowLayout ? "w-full pt-10" : "max-w-7xl pt-12"
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
