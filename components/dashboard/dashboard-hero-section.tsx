"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { InfluencerInputBox } from "@/components/tools/influencer"
import { useModels } from "@/hooks/use-models"
import { DEFAULT_IMAGE_MODEL_IDENTIFIER } from "@/lib/constants/models"
import {
  getDefaultAspectRatioForModel,
  getSupportedAspectRatios,
  pickRetainedAspectRatio,
} from "@/lib/utils/aspect-ratios"
import type { AttachedRef } from "@/lib/commands/types"
import type { ImageUpload } from "@/components/shared/upload/photo-upload"
import { buildPromptWithRefs } from "@/lib/commands/build-prompt"
import { brandRefsOnly, getImageAssetUrlsFromRefChips, hasVideoOrAudioAssetRefs } from "@/lib/commands/ref-image-pipeline"
import {
  buildImagePageGenerateHref,
  resolveReferenceImageUrls,
  saveImageGenerationIntent,
} from "@/lib/image/image-generation-intent"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const APP_HEADER_HEIGHT_PX = 52

export function DashboardHeroSection({ className }: { className?: string }) {
  const router = useRouter()
  const { models: imageModels, isLoading: modelsLoading } = useModels("image")

  const [prompt, setPrompt] = React.useState("")
  const [attachedCommandRefs, setAttachedCommandRefs] = React.useState<AttachedRef[]>([])
  const [referenceImage, setReferenceImage] = React.useState<ImageUpload | null>(null)
  const [referenceImages, setReferenceImages] = React.useState<ImageUpload[]>([])
  const [enhancePrompt, setEnhancePrompt] = React.useState(false)
  const [selectedModel, setSelectedModel] = React.useState("")
  const [selectedAspectRatio, setSelectedAspectRatio] = React.useState("match_input_image")
  const [selectedNumImages, setSelectedNumImages] = React.useState(1)
  const [isHandoffPending, setIsHandoffPending] = React.useState(false)
  const prevModelForAspectRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (imageModels.length === 0 || selectedModel) return
    const defaultModel =
      imageModels.find((m) => m.identifier === DEFAULT_IMAGE_MODEL_IDENTIFIER) ?? imageModels[0]
    setSelectedModel(defaultModel.identifier)
    setSelectedAspectRatio(getDefaultAspectRatioForModel(defaultModel))
  }, [imageModels, selectedModel])

  React.useEffect(() => {
    if (!selectedModel || imageModels.length === 0) return

    const model = imageModels.find((m) => m.identifier === selectedModel)
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
  }, [selectedModel, imageModels])

  const handleGenerate = React.useCallback(async () => {
    if (hasVideoOrAudioAssetRefs(attachedCommandRefs)) {
      toast.error("Video and audio assets can't be used as references for image generation.", {
        description: "Remove those @ chips or use image assets only.",
      })
      return
    }

    const mergedPrompt = buildPromptWithRefs(prompt, brandRefsOnly(attachedCommandRefs))
    const chipImageUrls = getImageAssetUrlsFromRefChips(attachedCommandRefs)

    if (
      !mergedPrompt.trim() &&
      chipImageUrls.length === 0 &&
      referenceImages.length === 0 &&
      !referenceImage
    ) {
      toast.error("Please enter a prompt")
      return
    }

    if (!selectedModel) {
      toast.error("Select a model to continue")
      return
    }

    setIsHandoffPending(true)

    try {
      const manualRefUrls = await resolveReferenceImageUrls(referenceImages, referenceImage)
      const referenceImageUrls = [...new Set([...manualRefUrls, ...chipImageUrls])]

      saveImageGenerationIntent({
        prompt: mergedPrompt.trim(),
        attachedRefs: attachedCommandRefs,
        referenceImageUrls,
        enhancePrompt,
        model: selectedModel,
        aspectRatio: selectedAspectRatio,
        numImages: Math.max(1, selectedNumImages),
      })

      router.push(buildImagePageGenerateHref())
    } catch (err) {
      console.error("Failed to prepare image generation:", err)
      toast.error(err instanceof Error ? err.message : "Could not start generation")
      setIsHandoffPending(false)
    }
  }, [
    attachedCommandRefs,
    enhancePrompt,
    prompt,
    referenceImage,
    referenceImages,
    router,
    selectedAspectRatio,
    selectedModel,
    selectedNumImages,
  ])

  return (
    <section
      className={cn(
        "relative flex w-full flex-col items-center justify-center px-4",
        className
      )}
      style={{ minHeight: `calc(100svh - ${APP_HEADER_HEIGHT_PX}px)` }}
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8 text-center">
        <div className="space-y-2">
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
            Create your next image
          </h1>
          <p className="mx-auto max-w-xl text-pretty text-sm text-muted-foreground sm:text-base">
            Describe what you want, pick a model, and generate on the image studio.
          </p>
        </div>

        <div className="w-full max-w-sm sm:max-w-lg lg:max-w-4xl">
          <InfluencerInputBox
            promptValue={prompt}
            onPromptChange={setPrompt}
            onAttachedRefsChange={setAttachedCommandRefs}
            referenceImage={referenceImage}
            onReferenceImageChange={setReferenceImage}
            referenceImages={referenceImages}
            onReferenceImagesChange={setReferenceImages}
            enhancePrompt={enhancePrompt}
            onEnhancePromptChange={setEnhancePrompt}
            isGenerating={isHandoffPending || modelsLoading}
            onGenerate={() => void handleGenerate()}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            showModelSelector
            imageModels={imageModels}
            selectedAspectRatio={selectedAspectRatio}
            onAspectRatioChange={setSelectedAspectRatio}
            showAspectRatioSelector
            selectedNumImages={selectedNumImages}
            onNumImagesChange={setSelectedNumImages}
            showNumImagesSelector
            allowedAssetTypes={["image"]}
          />
        </div>
      </div>
    </section>
  )
}
