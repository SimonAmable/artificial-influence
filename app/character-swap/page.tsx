"use client"

import * as React from "react"
import { GeneratorLayout } from "@/components/shared/layout/generator-layout"
import { CharacterSwapInputBox, CharacterSwapShowcaseCard } from "@/components/tools/character-swap"
import { ImageGrid } from "@/components/shared/display/image-grid"
import { useLayoutMode } from "@/components/shared/layout/layout-mode-context"
import { ImageUpload } from "@/components/shared/upload/photo-upload"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { generateImageAndWait } from "@/lib/generate-image-client"
import { toast } from "sonner"

const CHARACTER_SWAP_PROMPT =
  "Character swap task using two reference images. First image is the reference character. " +
  "Second image is the reference scene. Place the character from the first image into the scene from the second image. " +
  "Preserve the character's facial identity, hairstyle, body shape, and skin tone from the first image. " +
  "Preserve scene composition, camera angle, environment layout, and lighting mood from the second image. " +
  "Blend naturally with correct perspective, realistic scale, contact shadows, reflections, and occlusion."

interface ImageHistoryItem {
  id: string
  url: string
  model: string | null
  prompt: string | null
  tool: string | null
  aspectRatio: string | null
  type: string | null
  createdAt: string | null
  reference_image_urls?: string[]
}

export default function CharacterSwapPage() {
  const layoutModeContext = useLayoutMode()

  if (!layoutModeContext) {
    throw new Error("CharacterSwapPage must be used within LayoutModeProvider")
  }

  const { layoutMode } = layoutModeContext
  const isRowLayout = layoutMode === "row"

  const [characterImage, setCharacterImage] = React.useState<ImageUpload | null>(null)
  const [sceneImage, setSceneImage] = React.useState<ImageUpload | null>(null)
  const [historyImages, setHistoryImages] = React.useState<ImageHistoryItem[]>([])
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [historyError, setHistoryError] = React.useState<string | null>(null)
  const historyAbortRef = React.useRef<AbortController | null>(null)
  const historyRequestIdRef = React.useRef(0)

  const fetchImageHistory = React.useCallback(async (limit = 20) => {
    historyAbortRef.current?.abort()
    const controller = new AbortController()
    historyAbortRef.current = controller
    const requestId = ++historyRequestIdRef.current

    setIsHistoryLoading(true)
    setHistoryError(null)

    try {
      const response = await fetch(`/api/generations?tool=character_swap&limit=${limit}`, {
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error("Failed to fetch character swap history")
      }

      const data = await response.json()
      const imageRows = Array.isArray(data.generations)
        ? data.generations
            .map((generation: { 
              id?: string; 
              url?: string; 
              model?: string | null; 
              prompt?: string | null;
              tool?: string | null;
              aspect_ratio?: string | null;
              type?: string | null;
              created_at?: string | null;
              reference_image_urls?: string[];
            }) => ({
              id: generation.id ?? '',
              url: generation.url,
              model: generation.model ?? null,
              prompt: generation.prompt ?? null,
              tool: generation.tool ?? null,
              aspectRatio: generation.aspect_ratio ?? null,
              type: generation.type ?? null,
              createdAt: generation.created_at ?? null,
              reference_image_urls: generation.reference_image_urls ?? [],
            }))
            .filter(
              (item: { 
                id: string; 
                url?: string; 
                model: string | null; 
                prompt: string | null;
                tool: string | null;
                aspectRatio: string | null;
                type: string | null;
                createdAt: string | null;
              }): item is ImageHistoryItem =>
                typeof item.url === "string" && item.url.length > 0 && typeof item.id === "string" && item.id.length > 0
            )
        : []

      if (requestId === historyRequestIdRef.current) {
        setHistoryImages(imageRows)
      }
    } catch (err) {
      if (controller.signal.aborted) {
        return
      }

      console.error("Error fetching character swap history:", err)

      if (requestId === historyRequestIdRef.current) {
        setHistoryError(err instanceof Error ? err.message : "Failed to fetch character swap history")
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

  const handleGenerate = async () => {
    if (!characterImage?.file) {
      setError("Please upload a reference character image")
      return
    }

    if (!sceneImage?.file) {
      setError("Please upload a reference scene image")
      return
    }

    const files = [characterImage.file, sceneImage.file]

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setError("Both references must be valid image files")
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("Each reference image must be 10MB or less")
        return
      }
    }

    setIsGenerating(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("model", "google/nano-banana-pro")
      formData.append("prompt", CHARACTER_SWAP_PROMPT)
      formData.append("enhancePrompt", "false")
      formData.append("aspect_ratio", "match_input_image")

      // Order matters for the prompt convention: first = character, second = scene
      formData.append("referenceImages", characterImage.file)
      formData.append("referenceImages", sceneImage.file)
      formData.append("tool", "character_swap")

      await generateImageAndWait(formData)
      // Use DB as source of truth for grid order/history
      await fetchImageHistory(20)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate character swap image"
      if (message.includes("Concurrency limit reached")) {
        toast.error("Too many active generations", {
          description: `${message} Wait for one to finish, then try again.`,
        })
      }
      setError(message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDelete = async (id: string, imageUrl: string, index: number) => {
    try {
      const response = await fetch(`/api/generations/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete image')
      }

      // Refresh the history to reflect the deletion
      await fetchImageHistory(20)
    } catch (err) {
      console.error('Error deleting image:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete image')
    }
  }

  const renderShowcase = () => {
    const hasImages = historyImages.length > 0

    // Always show grid if we have images OR are generating OR are loading
    // Grid will show skeleton when loading, generating card when generating
    if (hasImages || isGenerating || isHistoryLoading) {
      return (
        <ImageGrid
          images={historyImages}
          isGenerating={isGenerating && hasImages}
          isLoadingSkeleton={isHistoryLoading && !hasImages}
          onDelete={handleDelete}
        />
      )
    }

    // Show error state only for generation errors (not history errors)
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

    // Show showcase when no images, not generating, and no generation error
    // This includes cases where history failed (e.g., not logged in)
    return <CharacterSwapShowcaseCard />
  }

  const inputBox = (
    <CharacterSwapInputBox
      characterImage={characterImage}
      sceneImage={sceneImage}
      onCharacterImageChange={setCharacterImage}
      onSceneImageChange={setSceneImage}
      onGenerate={handleGenerate}
      isGenerating={isGenerating}
    />
  )

  return (
    <div className={cn("min-h-screen bg-background flex flex-col", isRowLayout ? "p-0" : "p-4 sm:p-6 md:p-12")}>
      <div className={cn("mx-auto flex-1 flex flex-col", isRowLayout ? "w-full pt-20" : "max-w-7xl pt-12")}>
        <GeneratorLayout layoutMode={layoutMode} className="h-full flex-1 min-h-0">
          {isRowLayout ? (
            <>
              <div className="flex-1 w-full h-full overflow-auto pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {renderShowcase()}
              </div>
              <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6">
                <div className="max-w-7xl mx-auto flex justify-center">{inputBox}</div>
              </div>
            </>
          ) : (
            <>
              <div className="w-full flex-1 min-h-0 lg:pb-0">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 sm:gap-6 lg:gap-12 h-full">
                  <div className="hidden lg:block lg:sticky lg:top-0 h-fit">
                    <div className="flex justify-center">{inputBox}</div>
                  </div>
                  <div className="w-full h-full overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {renderShowcase()}
                  </div>
                </div>
              </div>
              <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 lg:hidden">
                <div className="max-w-7xl mx-auto flex justify-center">{inputBox}</div>
              </div>
            </>
          )}
        </GeneratorLayout>
      </div>
    </div>
  )
}
