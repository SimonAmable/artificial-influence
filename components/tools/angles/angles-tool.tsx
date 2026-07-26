"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { ArrowsClockwise, CubeFocus, Image as ImageIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

import { AngleOrbitViewer } from "@/components/tools/angles/angle-orbit-viewer"
import { AngleSliders } from "@/components/tools/angles/angle-sliders"
import { AnglesModelSelect } from "@/components/tools/angles/angles-model-select"
import { PhotoUpload, type ImageUpload } from "@/components/shared/upload/photo-upload"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { GenerateShaderButton } from "@/components/tools/influencer/generate-shader-button"
import { useGenerationCreditEstimate } from "@/hooks/use-generation-credit-estimate"
import {
  DEFAULT_ANGLES_MODEL,
  ANGLES_TOOL,
  type AnglesModelId,
} from "@/lib/angles/constants"
import { buildAnglesPrompt, buildCameraPromptSpec } from "@/lib/angles/prompt"
import { DEFAULT_ANGLE_STATE, type AngleState } from "@/lib/angles/types"
import {
  isInsufficientCreditsError,
  isInsufficientCreditsMessage,
  generateImageAndWait,
} from "@/lib/generate-image-client"
import {
  toUserFacingGenerationError,
  tryShowContentModerationToast,
} from "@/lib/content-moderation-toast"
import { appendImageReferencesToFormData } from "@/lib/image/append-references-to-form-data"
import { showCreditsUpsellToast } from "@/lib/pricing-upsell"
import type { Model } from "@/lib/types/models"
import { cn } from "@/lib/utils"

export function AnglesTool() {
  const searchParams = useSearchParams()
  const initialImageUrl = searchParams.get("image")?.trim() || null
  const [referenceImage, setReferenceImage] = React.useState<ImageUpload | null>(
    initialImageUrl ? { url: initialImageUrl } : null,
  )
  const [angle, setAngle] = React.useState<AngleState>(DEFAULT_ANGLE_STATE)
  const [selectedModel, setSelectedModel] =
    React.useState<AnglesModelId>(DEFAULT_ANGLES_MODEL)
  const [models, setModels] = React.useState<Model[]>([])
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [resultUrl, setResultUrl] = React.useState<string | null>(null)

  const selectedModelObject =
    models.find((model) => model.identifier === selectedModel) ?? null
  const estimatedCredits = useGenerationCreditEstimate({
    model: selectedModelObject,
    parameters:
      selectedModel === "openai/gpt-image-2"
        ? { quality: "low" }
        : selectedModel === "bytedance/seedream-5-lite"
          ? { resolution: "2K" }
          : {},
    outputCount: 1,
  })
  const cameraSpec = React.useMemo(() => buildCameraPromptSpec(angle), [angle])
  const hasReference = Boolean(referenceImage?.file || referenceImage?.url)
  const displayedImageUrl = resultUrl ?? referenceImage?.url

  React.useEffect(() => {
    if (!initialImageUrl) return
    setReferenceImage((current) => current ?? { url: initialImageUrl })
  }, [initialImageUrl])

  const handleReferenceChange = React.useCallback((next: ImageUpload | null) => {
    setReferenceImage(next)
    setResultUrl(null)
  }, [])

  const handleGenerate = React.useCallback(async () => {
    if (!referenceImage || !hasReference || isGenerating) return

    setIsGenerating(true)
    try {
      const formData = new FormData()
      formData.append("prompt", buildAnglesPrompt(selectedModel, angle))
      formData.append("enhancePrompt", "false")
      formData.append("model", selectedModel)
      formData.append("aspect_ratio", "match_input_image")
      formData.append("aspectRatio", "match_input_image")
      formData.append("n", "1")
      formData.append("tool", ANGLES_TOOL)
      formData.append("output_format", "png")
      if (selectedModel === "openai/gpt-image-2") {
        formData.append("quality", "low")
      }
      if (selectedModel === "bytedance/seedream-5-lite") {
        formData.append("resolution", "2K")
      }
      appendImageReferencesToFormData(formData, [referenceImage])

      const result = await generateImageAndWait(formData)
      const nextUrl = result.image?.url ?? result.images?.[0]?.url
      if (!nextUrl) {
        throw new Error("Generation completed without an image")
      }
      setResultUrl(nextUrl)
      toast.success("New angle generated")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed"
      if (isInsufficientCreditsError(error) || isInsufficientCreditsMessage(message)) {
        showCreditsUpsellToast({
          message,
          description: "Add credits to generate this angle.",
          toastId: "angles-credits-upsell",
        })
      } else if (
        !tryShowContentModerationToast(message, error, {
          toastId: "angles-moderation-error",
        })
      ) {
        toast.error("Could not generate this angle", {
          description: toUserFacingGenerationError(message, "Please try again."),
        })
      }
    } finally {
      setIsGenerating(false)
    }
  }, [angle, hasReference, isGenerating, referenceImage, selectedModel])

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-background px-3 pb-3 pt-[60px] sm:px-4 sm:pb-4">
      <div className="mx-auto grid min-h-[calc(100dvh-6rem)] max-w-[1600px] gap-3 lg:grid-cols-[minmax(0,1fr)_350px]">
        <section className="relative flex min-h-[460px] items-center justify-center overflow-hidden rounded-3xl border border-border/50 bg-muted/15 p-4 sm:min-h-[620px] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,var(--color-muted)_0,transparent_65%)] opacity-35" />

          {displayedImageUrl ? (
            <div className="relative flex size-full items-center justify-center">
              <div className="absolute left-0 top-0 z-10 flex items-center gap-2">
                <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
                  {resultUrl ? "Generated angle" : "Reference"}
                </span>
                {resultUrl ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-full bg-background/80 backdrop-blur"
                    onClick={() => setResultUrl(null)}
                  >
                    <ArrowsClockwise className="size-3.5" />
                    Show original
                  </Button>
                ) : null}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayedImageUrl}
                alt={resultUrl ? "Generated camera angle" : "Reference image"}
                className="max-h-[calc(100dvh-9rem)] max-w-full rounded-2xl object-contain shadow-2xl"
              />
            </div>
          ) : (
            <div className="relative w-full max-w-xl">
              <PhotoUpload
                value={referenceImage}
                onChange={handleReferenceChange}
                title="Add a reference image"
                description="Choose the image you want to view from a new angle"
                className="min-h-[360px] bg-card/60"
                minHeight="min-h-[360px]"
                maxHeight="max-h-none"
                previewFit="contain"
              />
            </div>
          )}

          {hasReference ? (
            <div className="absolute bottom-4 left-4 z-10 sm:bottom-5 sm:left-5">
              <PhotoUpload
                value={referenceImage}
                onChange={handleReferenceChange}
                title="Reference image"
                description="Drop in a replacement"
                className="h-16 w-16 overflow-hidden rounded-2xl border border-border/70 bg-background/85 shadow-lg backdrop-blur sm:h-20 sm:w-20"
                minHeight="min-h-0"
                maxHeight="max-h-none"
                previewFit="cover"
              />
            </div>
          ) : null}
        </section>

        <Card className="flex min-h-[680px] flex-col overflow-hidden rounded-3xl border-border/60 bg-card p-3 shadow-lg lg:sticky lg:top-3 lg:h-[calc(100dvh-6rem)]">
          <div className="flex items-center gap-2 px-2 pb-3 pt-1">
            <CubeFocus className="size-5 text-primary" weight="duotone" />
            <h1 className="text-base font-semibold tracking-tight text-foreground normal-case">
              Angles
            </h1>
          </div>

          <AngleOrbitViewer
            imageUrl={referenceImage?.url}
            value={angle}
            onChange={setAngle}
            disabled={!hasReference || isGenerating}
          />

          <div className="mt-3 space-y-3">
            <AngleSliders
              value={angle}
              onChange={setAngle}
              disabled={!hasReference || isGenerating}
            />

            <div className="space-y-1.5">
              <span className="px-1 text-xs text-muted-foreground">Model</span>
              <AnglesModelSelect
                value={selectedModel}
                onChange={setSelectedModel}
                disabled={isGenerating}
                onModelsChange={setModels}
              />
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
              <ImageIcon className="size-4 shrink-0 text-primary" weight="duotone" />
              <span className="truncate">{cameraSpec.viewDescription}</span>
            </div>
          </div>

          <div className={cn("mt-auto pt-6", !hasReference && "opacity-70")}>
            <GenerateShaderButton
              layout="bar"
              label="Generate angle"
              isReady={hasReference && Boolean(selectedModelObject)}
              isGenerating={isGenerating}
              allowConcurrent={false}
              onGenerate={() => void handleGenerate()}
              creditCost={estimatedCredits ?? selectedModelObject?.model_cost ?? "-"}
            />
          </div>
        </Card>
      </div>
    </main>
  )
}
