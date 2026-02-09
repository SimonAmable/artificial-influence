"use client"

import * as React from "react"
import { GeneratorLayout } from "@/components/shared/layout/generator-layout"
import { InfluencerInputBox, InfluencerShowcaseCard } from "@/components/tools/influencer"
import { ImageGrid } from "@/components/shared/display/image-grid"
import { useLayoutMode } from "@/components/shared/layout/layout-mode-context"
import { ImageUpload } from "@/components/shared/upload/photo-upload"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useModels } from "@/hooks/use-models"
import { CreateAssetDialog } from "@/components/canvas/create-asset-dialog"
import { toast } from "sonner"

interface ImageHistoryItem {
  url: string
  model: string | null
  prompt: string | null
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
  const [historyImages, setHistoryImages] = React.useState<ImageHistoryItem[]>([])
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [historyError, setHistoryError] = React.useState<string | null>(null)
  const [enhancePrompt, setEnhancePrompt] = React.useState(false)
  const historyAbortRef = React.useRef<AbortController | null>(null)
  const historyRequestIdRef = React.useRef(0)

  const { models: imageModels, isLoading: modelsLoading } = useModels('image')
  
  const [selectedModel, setSelectedModel] = React.useState<string>("")
  const [selectedAspectRatio, setSelectedAspectRatio] = React.useState<string>("match_input_image")
  const [selectedNumImages, setSelectedNumImages] = React.useState<number>(1)
  
  // Create asset dialog state
  const [createAssetDialogOpen, setCreateAssetDialogOpen] = React.useState(false)
  const [selectedImageForAsset, setSelectedImageForAsset] = React.useState<{ url: string; index: number } | null>(null)

  // Set default model when models load
  React.useEffect(() => {
    if (imageModels.length > 0 && !selectedModel) {
      const first = imageModels[0]
      setSelectedModel(first.identifier)
      setSelectedAspectRatio(first.default_aspect_ratio ?? first.aspect_ratios?.[0] ?? "1:1")
    }
  }, [imageModels, selectedModel])

  // Update aspect ratio and clamp numImages when model changes
  React.useEffect(() => {
    if (selectedModel && imageModels.length > 0) {
      const model = imageModels.find(m => m.identifier === selectedModel)
      const fallbackAspectRatio = model?.aspect_ratios?.[0]
      if (model?.default_aspect_ratio || fallbackAspectRatio) {
        setSelectedAspectRatio(model?.default_aspect_ratio ?? fallbackAspectRatio ?? "1:1")
      }
      const maxImages = model?.max_images ?? 1
      setSelectedNumImages((prev) => (maxImages >= 1 ? Math.min(prev, maxImages) : 1))
    }
  }, [selectedModel, imageModels])

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
            .map((generation: { url?: string; model?: string | null; prompt?: string | null }) => ({
              url: generation.url,
              model: generation.model ?? null,
              prompt: generation.prompt ?? null,
            }))
            .filter(
              (item: { url?: string; model: string | null; prompt: string | null }): item is ImageHistoryItem =>
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
    if (!prompt.trim()) {
      setError("Please enter a prompt")
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      // Validate reference images if present
      const imagesToValidate = referenceImages.length > 0 ? referenceImages : (referenceImage ? [referenceImage] : [])
      
      for (const refImage of imagesToValidate) {
        if (refImage.file) {
          // Validate file type
          if (!refImage.file.type.startsWith('image/')) {
            setError('Reference images must be valid image files')
            setIsGenerating(false)
            return
          }
          
          // Validate file size (max 10MB)
          const maxSize = 10 * 1024 * 1024 // 10MB
          if (refImage.file.size > maxSize) {
            setError('Reference images are too large. Maximum size is 10MB per image.')
            setIsGenerating(false)
            return
          }
        }
      }

      // Create FormData for the request
      const formData = new FormData()
      formData.append('prompt', prompt.trim())
      formData.append('enhancePrompt', enhancePrompt.toString())
      
      // Add model identifier if selected
      if (selectedModel) {
        formData.append('model', selectedModel)
      }
      
      // Add aspect ratio if selected
      if (selectedAspectRatio) {
        formData.append('aspectRatio', selectedAspectRatio)
        formData.append('aspect_ratio', selectedAspectRatio)
      }
      
      // Add reference image files if present (supports both single and multiple)
      const imagesToUpload = referenceImages.length > 0 ? referenceImages : (referenceImage ? [referenceImage] : [])
      
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
      if (selectedNumImages > 1) {
        formData.append('n', String(selectedNumImages))
      }
      
      const totalRefImages = imagesToUpload.length
      console.log('Sending request with reference images:', totalRefImages, 'numImages:', selectedNumImages)
      
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        
        // Handle insufficient credits (402)
        if (response.status === 402) {
          toast.error(errorData.message || "Insufficient credits", {
            description: "Upgrade your plan to continue generating images",
            action: {
              label: "View Plans",
              onClick: () => window.open("/pricing", "_blank")
            }
          })
          setError(errorData.message || "Insufficient credits")
          return
        }
        
        throw new Error(errorData.error || errorData.message || 'Failed to generate image')
      }

      const data = await response.json()
      
      if (!data.images?.length && !data.image?.url) {
        throw new Error('No image URL received from API')
      }

      // Use DB as source of truth for grid order/history
      await fetchImageHistory(20)
    } catch (err) {
      console.error('Error generating image:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate image')
    } finally {
      setIsGenerating(false)
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

      // Add to multiple reference images if supported, otherwise use single
      if (referenceImages.length > 0) {
        setReferenceImages([...referenceImages, { file, url: imageUrl }])
      } else {
        setReferenceImage({ file, url: imageUrl })
      }
      setError(null)
    } catch (err) {
      console.error("Error setting reference image:", err)
      setError("Could not set this image as reference. Please try another image.")
    }
  }, [referenceImages])

  const handleCreateAsset = React.useCallback((imageUrl: string, index: number) => {
    setSelectedImageForAsset({ url: imageUrl, index })
    setCreateAssetDialogOpen(true)
  }, [])

  // Render generated image or showcase card
  const renderShowcase = () => {
    const activeError = error || historyError
    const hasImages = historyImages.length > 0

    // Always show grid if we have images OR are generating OR are loading
    // Grid will show skeleton when loading, generating card when generating
    if (hasImages || isGenerating || isHistoryLoading) {
      return (
        <ImageGrid
          images={historyImages}
          isGenerating={isGenerating && hasImages}
          generatingCount={selectedNumImages}
          isLoadingSkeleton={isHistoryLoading && !hasImages}
          onUseAsReference={(imageUrl) => {
            void handleUseAsReference(imageUrl)
          }}
          onCreateAsset={handleCreateAsset}
        />
      )
    }

    // Show error state if there's an error and no images
    if (activeError) {
      const isHistoryOnlyError = !!historyError && !error

      return (
        <Card className="w-full h-full flex flex-col">
          <CardContent className="flex flex-col items-center justify-center flex-1 p-8">
            <p className="text-destructive mb-4">{activeError}</p>
            <Button
              onClick={isHistoryOnlyError ? () => void fetchImageHistory(20) : handleGenerate}
              variant="default"
            >
              {isHistoryOnlyError ? "Reload History" : "Try Again"}
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
            // Row layout: Full-screen grid fills entire screen excluding header
            <>
              {/* Main Content - Full-screen grid fills entire screen excluding header */}
              <div className="flex-1 w-full h-full overflow-auto pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {renderShowcase()}
              </div>

              {/* Fixed Bottom Panel - Prompt Box (always visible) */}
              <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6">
                <div className="max-w-7xl mx-auto flex justify-center">
                  <InfluencerInputBox
                    forceRowLayout={true}
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
                    imageModels={imageModels}
                    selectedAspectRatio={selectedAspectRatio}
                    onAspectRatioChange={setSelectedAspectRatio}
                    showAspectRatioSelector={true}
                    selectedNumImages={selectedNumImages}
                    onNumImagesChange={setSelectedNumImages}
                    showNumImagesSelector={true}
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
                  {/* Left Panel - Prompt Box (hidden on mobile, shown on desktop) */}
                  <div className="hidden lg:block lg:sticky lg:top-0 h-fit">
                    <div className="flex justify-center">
                      <InfluencerInputBox
                        forceRowLayout={false}
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
                        imageModels={imageModels}
                        selectedAspectRatio={selectedAspectRatio}
                        onAspectRatioChange={setSelectedAspectRatio}
                        showAspectRatioSelector={true}
                        selectedNumImages={selectedNumImages}
                        onNumImagesChange={setSelectedNumImages}
                        showNumImagesSelector={true}
                      />
                    </div>
                  </div>

                  {/* Right Panel - Showcase (full-screen grid) */}
                  <div className="w-full h-full overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {renderShowcase()}
                  </div>
                </div>
              </div>

              {/* Fixed Bottom Panel - Prompt Box (mobile only) */}
              <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 lg:hidden">
                <div className="max-w-7xl mx-auto flex justify-center">
                  <InfluencerInputBox
                    forceRowLayout={false}
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
                    imageModels={imageModels}
                    selectedAspectRatio={selectedAspectRatio}
                    onAspectRatioChange={setSelectedAspectRatio}
                    showAspectRatioSelector={true}
                    selectedNumImages={selectedNumImages}
                    onNumImagesChange={setSelectedNumImages}
                    showNumImagesSelector={true}
                  />
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
          onOpenChange={setCreateAssetDialogOpen}
          initial={{
            title: `Generated Image ${selectedImageForAsset.index + 1}`,
            url: selectedImageForAsset.url,
            assetType: "image",
          }}
          onSaved={() => {
            // Optionally refresh or show success message
            setSelectedImageForAsset(null)
          }}
        />
      )}
    </div>
  )
}
