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

export default function ImagePage() {
  const layoutModeContext = useLayoutMode()
  
  if (!layoutModeContext) {
    throw new Error("ImagePage must be used within LayoutModeProvider")
  }
  
  const { layoutMode } = layoutModeContext

  // State management
  const [prompt, setPrompt] = React.useState("")
  const [referenceImage, setReferenceImage] = React.useState<ImageUpload | null>(null)
  const [generatedImages, setGeneratedImages] = React.useState<string[]>([])
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [enhancePrompt, setEnhancePrompt] = React.useState(false)
  const [selectedModel, setSelectedModel] = React.useState<string>("")
  const [selectedAspectRatio, setSelectedAspectRatio] = React.useState<string>("")

  // Handle image generation
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt")
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      // Validate reference image if present
      if (referenceImage?.file) {
        // Validate file type
        if (!referenceImage.file.type.startsWith('image/')) {
          setError('Reference image must be a valid image file')
          setIsGenerating(false)
          return
        }
        
        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024 // 10MB
        if (referenceImage.file.size > maxSize) {
          setError('Reference image is too large. Maximum size is 10MB.')
          setIsGenerating(false)
          return
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
      
      // Add reference image file if present
      if (referenceImage?.file) {
        formData.append('referenceImage', referenceImage.file)
      }
      
      console.log('Sending request with reference image:', !!referenceImage?.file)
      
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || errorData.message || 'Failed to generate image')
      }

      const data = await response.json()
      
      // Handle response - extract ALL image URLs and PREPEND to existing images (add to top-left)
      if (data.images && data.images.length > 0) {
        // Multiple images: extract all URLs and prepend to existing (new images appear at top-left)
        const newImageUrls = data.images.map((img: { url: string }) => img.url)
        setGeneratedImages(prev => [...newImageUrls, ...prev])
      } else if (data.image?.url) {
        // Single image: prepend to existing images (new image appears at top-left)
        setGeneratedImages(prev => [data.image.url, ...prev])
      } else {
        throw new Error('No image URL received from API')
      }
    } catch (err) {
      console.error('Error generating image:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate image')
      // Don't clear existing images on error - keep them in the grid
    } finally {
      setIsGenerating(false)
    }
  }

  // Render generated image or showcase card
  const renderShowcase = () => {
    // Always show grid if we have images OR are generating
    // Grid will show generating card inside it when isGenerating is true
    if (generatedImages.length > 0 || isGenerating) {
      return <ImageGrid images={generatedImages} isGenerating={isGenerating} />
    }

    // Show error state if there's an error and no images
    if (error) {
      return (
        <Card className="w-full h-full flex flex-col">
          <CardContent className="flex flex-col items-center justify-center flex-1 p-8">
            <p className="text-destructive mb-4">{error}</p>
            <Button
              onClick={handleGenerate}
              variant="default"
            >
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
        highlightedTitle="IMAGE"
        description="Generate engaging social media content and captions that resonate with your audience."
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
                    enhancePrompt={enhancePrompt}
                    onEnhancePromptChange={setEnhancePrompt}
                    isGenerating={isGenerating}
                    onGenerate={handleGenerate}
                    selectedModel={selectedModel}
                    onModelChange={setSelectedModel}
                    showModelSelector={true}
                    selectedAspectRatio={selectedAspectRatio}
                    onAspectRatioChange={setSelectedAspectRatio}
                    showAspectRatioSelector={true}
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
                        enhancePrompt={enhancePrompt}
                        onEnhancePromptChange={setEnhancePrompt}
                        isGenerating={isGenerating}
                        onGenerate={handleGenerate}
                        selectedModel={selectedModel}
                        onModelChange={setSelectedModel}
                        showModelSelector={true}
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
                    enhancePrompt={enhancePrompt}
                    onEnhancePromptChange={setEnhancePrompt}
                    isGenerating={isGenerating}
                    onGenerate={handleGenerate}
                    selectedModel={selectedModel}
                    onModelChange={setSelectedModel}
                    showModelSelector={true}
                    selectedAspectRatio={selectedAspectRatio}
                    onAspectRatioChange={setSelectedAspectRatio}
                    showAspectRatioSelector={true}
                  />
                </div>
              </div>
            </>
          )}
        </GeneratorLayout>
      </div>
    </div>
  )
}
