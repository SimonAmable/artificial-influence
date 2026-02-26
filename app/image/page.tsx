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
import { CreateAssetDialog } from "@/components/canvas/create-asset-dialog"
import { toast } from "sonner"

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

const CHARACTER_SWAP_UI_MODEL_IDENTIFIER = "custom/character-swap"
const CHARACTER_SWAP_BASE_MODEL_IDENTIFIER = "google/nano-banana-pro"
const CHARACTER_SWAP_PROMPTS: Record<CharacterSwapMode, string> = {
  full_character:
    "Character swap task using two reference images. First image is the reference character. " +
    "Second image is the reference scene. Place the character from the first image into the scene from the second image. " +
    "Preserve the character's facial identity, hairstyle, body shape, and skin tone from the first image. " +
    "Preserve scene composition, camera angle, environment layout, and lighting mood from the second image. " +
    "Blend naturally with correct perspective, realistic scale, contact shadows, reflections, and occlusion.",
  identity_only:
    "Full identity swap using two reference images. First image is the reference character (face, hair, body, and clothing to transfer). " +
    "Second image is the reference scene. Place the character from the first image into the scene from the second image. " +
    "From the first image preserve: the entire face (face shape, eyes, nose, mouth, bone structure, facial features), the reference character's hairstyle and hair, body shape, skin tone, and clothing/outfit—so the person in the result is recognizably the same individual as in the first image, wearing the same clothes. " +
    "From the second image preserve only: scene composition, environment, camera angle, and lighting mood. " +
    "Output must look like the full character from image one (same face, hair, body, and clothes) placed in the scene from image two, with realistic lighting and seamless blending.",
}

export default function ImagePage() {
  const layoutModeContext = useLayoutMode()
  
  if (!layoutModeContext) {
    throw new Error("ImagePage must be used within LayoutModeProvider")
  }
  
  const { layoutMode } = layoutModeContext

  // State management
  const [prompt, setPrompt] = React.useState("")
  const [referenceImage, setReferenceImage] = React.useState<ImageUpload | null>(null)
  const [referenceImages, setReferenceImages] = React.useState<ImageUpload[]>([])
  const [characterSwapCharacterImage, setCharacterSwapCharacterImage] = React.useState<ImageUpload | null>(null)
  const [characterSwapSceneImage, setCharacterSwapSceneImage] = React.useState<ImageUpload | null>(null)
  const [characterSwapMode, setCharacterSwapMode] = React.useState<CharacterSwapMode>("full_character")
  const [historyImages, setHistoryImages] = React.useState<ImageHistoryItem[]>([])
  const [inFlightCount, setInFlightCount] = React.useState(0)
  const [isHistoryLoading, setIsHistoryLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [historyError, setHistoryError] = React.useState<string | null>(null)
  const [enhancePrompt, setEnhancePrompt] = React.useState(false)
  const historyAbortRef = React.useRef<AbortController | null>(null)
  const historyRequestIdRef = React.useRef(0)
  const isGenerating = inFlightCount > 0

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

  // Set default model when models load
  React.useEffect(() => {
    if (effectiveImageModels.length > 0 && !selectedModel) {
      const first = effectiveImageModels[0]
      setSelectedModel(first.identifier)
      setSelectedAspectRatio(first.default_aspect_ratio ?? first.aspect_ratios?.[0] ?? "1:1")
    }
  }, [effectiveImageModels, selectedModel])

  // Update aspect ratio and clamp numImages when model changes
  React.useEffect(() => {
    if (selectedModel && effectiveImageModels.length > 0) {
      const model = effectiveImageModels.find(m => m.identifier === selectedModel)
      const fallbackAspectRatio = model?.aspect_ratios?.[0]
      if (model?.default_aspect_ratio || fallbackAspectRatio) {
        setSelectedAspectRatio(model?.default_aspect_ratio ?? fallbackAspectRatio ?? "1:1")
      }
      const maxImages = model?.max_images ?? 1
      setSelectedNumImages((prev) => (maxImages >= 1 ? Math.min(prev, maxImages) : 1))
    }
  }, [selectedModel, effectiveImageModels])

  const fetchImageHistory = React.useCallback(async (limit = 20) => {
    historyAbortRef.current?.abort()
    const controller = new AbortController()
    historyAbortRef.current = controller
    const requestId = ++historyRequestIdRef.current

    setIsHistoryLoading(true)
    setHistoryError(null)

    try {
      const response = await fetch(`/api/generations?type=image&limit=${limit}`, {
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error("Failed to fetch image history")
      }

      const data = await response.json()
      const imageRows = Array.isArray(data.generations)
        ? data.generations
            .map((g: {
              url?: string; model?: string | null; prompt?: string | null;
              id?: string; tool?: string | null; aspect_ratio?: string | null;
              type?: string | null; created_at?: string | null;
              reference_image_urls?: string[];
            }) => ({
              id: g.id,
              url: g.url,
              model: g.model ?? null,
              prompt: g.prompt ?? null,
              tool: g.tool ?? null,
              aspectRatio: g.aspect_ratio ?? null,
              type: g.type ?? null,
              createdAt: g.created_at ?? null,
              reference_image_urls: g.reference_image_urls ?? [],
            }))
            .filter(
              (item: ImageHistoryItem): item is ImageHistoryItem =>
                typeof item.url === "string" && item.url.length > 0
            )
        : []

      if (requestId === historyRequestIdRef.current) {
        setHistoryImages(imageRows)
      }
    } catch (err) {
      if (controller.signal.aborted) {
        return
      }

      console.error("Error fetching image history:", err)

      if (requestId === historyRequestIdRef.current) {
        setHistoryError(err instanceof Error ? err.message : "Failed to fetch image history")
      }
    } finally {
      if (requestId === historyRequestIdRef.current) {
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
    if (!isCharacterSwapModel && !prompt.trim()) {
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

    setInFlightCount((count) => count + 1)
    setError(null)

    try {
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

      // Create FormData for the request
      const formData = new FormData()
      formData.append('prompt', isCharacterSwapModel ? CHARACTER_SWAP_PROMPTS[characterSwapMode] : prompt.trim())
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
      } else if (selectedAspectRatio) {
        formData.append('aspectRatio', selectedAspectRatio)
        formData.append('aspect_ratio', selectedAspectRatio)
      }
      
      // Add reference image files if present (supports both single and multiple)
      const imagesToUpload = isCharacterSwapModel
        ? [characterSwapCharacterImage, characterSwapSceneImage].filter(
            (img): img is ImageUpload => Boolean(img)
          )
        : referenceImages.length > 0
          ? referenceImages
          : (referenceImage ? [referenceImage] : [])
      
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
      await generateImageAndWait(formData)
      // Use DB as source of truth for grid order/history
      await fetchImageHistory(20)
    } catch (err) {
      console.error('Error generating image:', err)
      const message = err instanceof Error ? err.message : 'Failed to generate image'
      if (message.includes('Insufficient credits')) {
        toast.error(message, {
          description: "Upgrade your plan to continue generating images",
          action: { label: "View Plans", onClick: () => window.open("/pricing", "_blank") }
        })
      } else if (message.includes('Concurrency limit reached')) {
        toast.error('Too many active generations', {
          description: `${message} Wait for one to finish, then try again.`,
        })
      }
      setError(message)
    } finally {
      setInFlightCount((count) => Math.max(0, count - 1))
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
          referenceImage={referenceImage}
          onReferenceImageChange={setReferenceImage}
          referenceImages={referenceImages}
          onReferenceImagesChange={setReferenceImages}
          enhancePrompt={enhancePrompt}
          onEnhancePromptChange={setEnhancePrompt}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
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
  }, [fetchImageHistory])

  // Render generated image or showcase card
  const renderShowcase = () => {
    const hasImages = historyImages.length > 0

    // Always show grid if we have images OR are generating OR are loading
    // Grid will show skeleton when loading, generating card when generating
    if (hasImages || isGenerating || isHistoryLoading) {
      return (
        <ImageGrid
          images={historyImages}
          isGenerating={isGenerating}
          generatingCount={inFlightCount}
          isLoadingSkeleton={isHistoryLoading && !hasImages}
          onUseAsReference={(imageUrl) => {
            void handleUseAsReference(imageUrl)
          }}
          onRecreate={handleRecreate}
          onCreateAsset={handleCreateAsset}
          onUpscale={handleUpscale}
          upscalingImageUrl={upscalingImageUrl}
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
        isRowLayout ? "w-full pt-20" : "max-w-7xl pt-12"
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
              <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6">
                <div className="max-w-7xl mx-auto flex justify-center">
                  {renderInputBox(true)}
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
              <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 lg:hidden">
                <div className="max-w-7xl mx-auto flex justify-center">
                  {renderInputBox(false)}
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
