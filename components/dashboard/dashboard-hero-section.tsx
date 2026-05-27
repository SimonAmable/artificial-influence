"use client"

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { DashboardAgentPromptBox } from "@/components/dashboard/dashboard-agent-prompt-box"
import { InfluencerInputBox } from "@/components/tools/influencer"
import type { AudioUploadValue } from "@/components/shared/upload/audio-upload"
import type { ImageUpload } from "@/components/shared/upload/photo-upload"
import { VideoInputBox } from "@/components/tools/video/video-input-box"
import type { MultiShotItem } from "@/components/tools/video/multi-shot-editor"
import { useModels } from "@/hooks/use-models"
import { DEFAULT_CHAT_GATEWAY_MODEL } from "@/lib/constants/chat-llm-models"
import { DEFAULT_IMAGE_MODEL_IDENTIFIER } from "@/lib/constants/models"
import { buildPromptWithRefs } from "@/lib/commands/build-prompt"
import type { AttachedRef } from "@/lib/commands/types"
import { brandRefsOnly, hasVideoOrAudioAssetRefs } from "@/lib/commands/ref-image-pipeline"
import { validateVideoAttachedRefs } from "@/lib/commands/validate-video-refs"
import {
  getDefaultAspectRatioForModel,
  getSupportedAspectRatios,
  pickRetainedAspectRatio,
} from "@/lib/utils/aspect-ratios"
import { buildVideoModelParameters } from "@/lib/utils/video-model-parameters"
import {
  buildImagePageGenerateHref,
  resolveReferenceImageUrls,
  saveImageGenerationIntent,
} from "@/lib/image/image-generation-intent"
import { saveDashboardAgentHandoff } from "@/lib/chat/dashboard-agent-handoff"
import {
  buildVideoPageGenerateHref,
  resolveVideoGenerationIntentUploads,
  saveVideoGenerationIntent,
} from "@/lib/video/video-generation-intent"
import { resolveVideoPricingQuote } from "@/lib/video-pricing"
import type {
  Model,
  ParameterDefinition,
  StringParameterDefinition,
} from "@/lib/types/models"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const APP_HEADER_HEIGHT_PX = 52

type DashboardHeroMode = "video" | "image" | "agent"

const HERO_TABS: Array<{
  id: DashboardHeroMode
  label: string
  iconSrc: string
}> = [
  { id: "video", label: "Video", iconSrc: "/3d_icons/video.png" },
  { id: "image", label: "Image", iconSrc: "/3d_icons/image.png" },
  { id: "agent", label: "Agent", iconSrc: "/3d_icons/agent.png" },
]

const HERO_TAB_INDEX: Record<DashboardHeroMode, number> = {
  video: 0,
  image: 1,
  agent: 2,
}

export function DashboardHeroSection({ className }: { className?: string }) {
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()
  const [activeTab, setActiveTab] = React.useState<DashboardHeroMode>("video")
  const [tabDirection, setTabDirection] = React.useState(1)

  const { models: imageModels, isLoading: imageModelsLoading } = useModels("image")
  const { models: videoModels, isLoading: videoModelsLoading } = useModels("video")

  const [imagePrompt, setImagePrompt] = React.useState("")
  const [imageAttachedRefs, setImageAttachedRefs] = React.useState<AttachedRef[]>([])
  const [referenceImage, setReferenceImage] = React.useState<ImageUpload | null>(null)
  const [referenceImages, setReferenceImages] = React.useState<ImageUpload[]>([])
  const [enhancePrompt, setEnhancePrompt] = React.useState(false)
  const [selectedImageModel, setSelectedImageModel] = React.useState("")
  const [selectedAspectRatio, setSelectedAspectRatio] = React.useState("match_input_image")
  const [selectedNumImages, setSelectedNumImages] = React.useState(1)
  const [isImageHandoffPending, setIsImageHandoffPending] = React.useState(false)
  const prevImageModelForAspectRef = React.useRef<string | null>(null)

  const [videoPrompt, setVideoPrompt] = React.useState("")
  const [videoNegativePrompt, setVideoNegativePrompt] = React.useState("")
  const [selectedVideoModel, setSelectedVideoModel] = React.useState<Model | null>(null)
  const [inputImage, setInputImage] = React.useState<ImageUpload | null>(null)
  const [lastFrameImage, setLastFrameImage] = React.useState<ImageUpload | null>(null)
  const [inputVideo, setInputVideo] = React.useState<ImageUpload | null>(null)
  const [inputAudio, setInputAudio] = React.useState<AudioUploadValue | null>(null)
  const [videoParameters, setVideoParameters] = React.useState<Record<string, unknown>>({})
  const [multiShotMode, setMultiShotMode] = React.useState(false)
  const [multiShotShots, setMultiShotShots] = React.useState<MultiShotItem[]>([])
  const [videoReferenceImages, setVideoReferenceImages] = React.useState<ImageUpload[]>([])
  const [videoAttachedRefs, setVideoAttachedRefs] = React.useState<AttachedRef[]>([])
  const [isVideoHandoffPending, setIsVideoHandoffPending] = React.useState(false)
  const prevVideoModelIdForParamsRef = React.useRef<string | null>(null)

  const [agentPrompt, setAgentPrompt] = React.useState("")
  const [agentAttachedRefs, setAgentAttachedRefs] = React.useState<AttachedRef[]>([])
  const [selectedAgentModel, setSelectedAgentModel] = React.useState<string>(DEFAULT_CHAT_GATEWAY_MODEL)
  const [isAgentHandoffPending, setIsAgentHandoffPending] = React.useState(false)

  const handleTabChange = React.useCallback((nextTab: DashboardHeroMode) => {
    if (nextTab === activeTab) return
    setTabDirection(HERO_TAB_INDEX[nextTab] > HERO_TAB_INDEX[activeTab] ? 1 : -1)
    setActiveTab(nextTab)
  }, [activeTab])

  React.useEffect(() => {
    if (imageModels.length === 0 || selectedImageModel) return
    const defaultModel =
      imageModels.find((model) => model.identifier === DEFAULT_IMAGE_MODEL_IDENTIFIER) ?? imageModels[0]
    setSelectedImageModel(defaultModel.identifier)
    setSelectedAspectRatio(getDefaultAspectRatioForModel(defaultModel))
  }, [imageModels, selectedImageModel])

  React.useEffect(() => {
    if (!selectedImageModel || imageModels.length === 0) return

    const model = imageModels.find((item) => item.identifier === selectedImageModel)
    if (!model) return

    const prevModel = prevImageModelForAspectRef.current
    prevImageModelForAspectRef.current = selectedImageModel

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
  }, [selectedImageModel, imageModels])

  React.useEffect(() => {
    if (videoModels.length === 0 || selectedVideoModel) return
    const first = videoModels[0]
    setSelectedVideoModel({
      ...first,
      parameters: { parameters: buildVideoModelParameters(first) },
    })
  }, [selectedVideoModel, videoModels])

  React.useEffect(() => {
    if (!selectedVideoModel) return

    const modelId = selectedVideoModel.identifier
    const prevModelId = prevVideoModelIdForParamsRef.current
    prevVideoModelIdForParamsRef.current = modelId
    const paramList = selectedVideoModel.parameters.parameters

    setVideoParameters((prev) => {
      const next: Record<string, unknown> = {}
      paramList.forEach((param: ParameterDefinition) => {
        next[param.name] = param.default
      })

      const aspectParam = paramList.find(
        (param): param is StringParameterDefinition =>
          (param.name === "aspect_ratio" || param.name === "aspectRatio") &&
          param.type === "string" &&
          Array.isArray(param.enum) &&
          param.enum.length > 0
      )

      if (!aspectParam?.enum?.length || prevModelId === null) {
        return next
      }

      const supported = aspectParam.enum.map(String)
      const prevAspectRaw = prev.aspect_ratio ?? prev.aspectRatio
      if (prevAspectRaw === undefined || prevAspectRaw === null) {
        return next
      }

      const kept = pickRetainedAspectRatio(String(prevAspectRaw), supported)
      if (kept) {
        next[aspectParam.name] = kept
      }

      return next
    })
  }, [selectedVideoModel])

  const estimatedVideoCredits = React.useMemo(() => {
    if (!selectedVideoModel) return null

    return resolveVideoPricingQuote({
      modelIdentifier: selectedVideoModel.identifier,
      modelCost: selectedVideoModel.model_cost,
      modelCostPerSecond: selectedVideoModel.model_cost_per_second,
      duration: videoParameters.duration as number | string | undefined,
      resolution: typeof videoParameters.resolution === "string" ? videoParameters.resolution : null,
      draft: videoParameters.draft as boolean | undefined,
      mode: typeof videoParameters.mode === "string" ? videoParameters.mode : null,
      generateAudio:
        typeof videoParameters.generate_audio === "boolean"
          ? videoParameters.generate_audio
          : typeof videoParameters.generateAudio === "boolean"
            ? videoParameters.generateAudio
            : null,
      characterOrientation:
        typeof videoParameters.character_orientation === "string"
          ? videoParameters.character_orientation
          : null,
      hasInputVideo: !!inputVideo,
      hasReferenceVideo: !!inputVideo,
    }).quotedCredits
  }, [inputVideo, selectedVideoModel, videoParameters])

  const handleImageGenerate = React.useCallback(async () => {
    if (hasVideoOrAudioAssetRefs(imageAttachedRefs)) {
      toast.error("Video and audio assets can't be used as references for image generation.", {
        description: "Remove those @ chips or use image assets only.",
      })
      return
    }

    const mergedPrompt = buildPromptWithRefs(imagePrompt, brandRefsOnly(imageAttachedRefs))
    const hasManualRefs = referenceImages.length > 0 || !!referenceImage

    if (!mergedPrompt.trim() && !hasManualRefs) {
      toast.error("Please enter a prompt")
      return
    }

    if (!selectedImageModel) {
      toast.error("Select a model to continue")
      return
    }

    setIsImageHandoffPending(true)

    try {
      const referenceImageUrls = await resolveReferenceImageUrls(referenceImages, referenceImage)

      saveImageGenerationIntent({
        prompt: mergedPrompt.trim(),
        attachedRefs: imageAttachedRefs,
        referenceImageUrls,
        enhancePrompt,
        model: selectedImageModel,
        aspectRatio: selectedAspectRatio,
        numImages: Math.max(1, selectedNumImages),
      })

      router.push(buildImagePageGenerateHref())
    } catch (err) {
      console.error("Failed to prepare image generation:", err)
      toast.error(err instanceof Error ? err.message : "Could not start generation")
      setIsImageHandoffPending(false)
    }
  }, [
    enhancePrompt,
    imageAttachedRefs,
    imagePrompt,
    referenceImage,
    referenceImages,
    router,
    selectedAspectRatio,
    selectedImageModel,
    selectedNumImages,
  ])

  const handleVideoGenerate = React.useCallback(async () => {
    if (!selectedVideoModel) {
      toast.error("Select a video model to continue")
      return
    }

    const refError = validateVideoAttachedRefs(videoAttachedRefs, selectedVideoModel)
    if (refError) {
      toast.error(refError)
      return
    }

    const mergedPrompt = buildPromptWithRefs(videoPrompt, brandRefsOnly(videoAttachedRefs)).trim()
    const hasReferenceInputs =
      !!inputImage ||
      !!lastFrameImage ||
      !!inputVideo ||
      !!inputAudio ||
      videoReferenceImages.length > 0

    if (!mergedPrompt && !hasReferenceInputs && multiShotShots.length === 0) {
      toast.error("Add a prompt or reference before opening the video studio.")
      return
    }

    setIsVideoHandoffPending(true)

    try {
      const resolvedUploads = await resolveVideoGenerationIntentUploads({
        inputImage,
        lastFrameImage,
        inputVideo,
        inputAudio,
        referenceImages: videoReferenceImages,
      })

      saveVideoGenerationIntent({
        prompt: videoPrompt,
        negativePrompt: videoNegativePrompt,
        attachedRefs: videoAttachedRefs,
        model: selectedVideoModel.identifier,
        parameters: videoParameters,
        multiShotMode,
        multiShotShots,
        ...resolvedUploads,
      })

      router.push(buildVideoPageGenerateHref())
    } catch (err) {
      console.error("Failed to prepare video generation:", err)
      toast.error(err instanceof Error ? err.message : "Could not open the video studio")
      setIsVideoHandoffPending(false)
    }
  }, [
    inputAudio,
    inputImage,
    inputVideo,
    lastFrameImage,
    multiShotMode,
    multiShotShots,
    router,
    selectedVideoModel,
    videoAttachedRefs,
    videoNegativePrompt,
    videoParameters,
    videoPrompt,
    videoReferenceImages,
  ])

  const handleAgentGenerate = React.useCallback(() => {
    const trimmedPrompt = agentPrompt.trim()
    if (!trimmedPrompt) {
      toast.error("Enter a prompt for the agent")
      return
    }

    setIsAgentHandoffPending(true)
    saveDashboardAgentHandoff({
      prompt: trimmedPrompt,
      attachedRefs: agentAttachedRefs,
      model: selectedAgentModel,
    })
    router.push(`/chat?new=${Date.now()}`)
  }, [agentAttachedRefs, agentPrompt, router, selectedAgentModel])

  return (
    <section
      className={cn("relative flex w-full flex-col items-center justify-center overflow-hidden px-4", className)}
      style={{ minHeight: `calc(100svh - ${APP_HEADER_HEIGHT_PX}px)` }}
    >
      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-8 py-14 sm:py-18">
        <div className="space-y-4 text-center">
          <h1 className="text-balance text-3xl font-medium tracking-tight text-foreground sm:text-4xl md:text-5xl">
            <span>Create at the Speed of Thought</span>
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Jump into the right tool, keep the real controls, and hand the draft off without rebuilding it.
          </p>
        </div>

        <div
          className={cn(
            "inline-flex flex-wrap items-center justify-center gap-1 rounded-[2rem] border p-1 backdrop-blur",
            "border-border/65 bg-muted/95",
            "shadow-[inset_0_2px_6px_rgba(0,0,0,0.10),inset_0_1px_2px_rgba(0,0,0,0.06),inset_0_-1px_1px_rgba(255,255,255,0.35)]",
            "dark:border-border/45 dark:bg-muted/55",
            "dark:shadow-[inset_0_2px_12px_rgba(0,0,0,0.55),inset_0_1px_2px_rgba(0,0,0,0.45),inset_0_-1px_0_rgba(255,255,255,0.04)]"
          )}
          role="tablist"
          aria-label="Dashboard hero tools"
        >
          {HERO_TABS.map((tab) => {
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                role="tab"
                aria-selected={isActive}
                className={cn(
                  "inline-flex min-h-11 min-w-[8.5rem] shrink-0 items-center justify-center gap-2 rounded-full border border-transparent px-5 py-3 text-center text-sm font-medium transition-[color,box-shadow,border-color,background-color]",
                  isActive
                    ? "border-border/80 bg-background text-foreground shadow-sm dark:border-border/60 dark:bg-card/90"
                    : "text-muted-foreground hover:bg-background/40 hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "relative flex size-6 items-center justify-center transition-transform duration-300 ease-out",
                    isActive ? "scale-[1.2]" : "scale-100"
                  )}
                >
                  <Image
                    src={tab.iconSrc}
                    alt=""
                    width={24}
                    height={24}
                    className="h-6 w-6 object-contain"
                    aria-hidden
                  />
                </span>
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        <div className="w-full">
          <AnimatePresence initial={false} mode="wait" custom={tabDirection}>
            <motion.div
              key={activeTab}
              custom={tabDirection}
              initial={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, x: tabDirection > 0 ? 28 : -28, filter: "blur(4px)" }
              }
              animate={
                prefersReducedMotion
                  ? { opacity: 1 }
                  : { opacity: 1, x: 0, filter: "blur(0px)" }
              }
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, x: tabDirection > 0 ? -28 : 28, filter: "blur(4px)" }
              }
              transition={{
                duration: prefersReducedMotion ? 0.16 : 0.28,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="w-full"
            >
              {activeTab === "video" ? (
                selectedVideoModel ? (
                  <div className="mx-auto flex w-full justify-center">
                    <VideoInputBox
                      className="mx-auto"
                      videoModels={videoModels}
                      promptValue={videoPrompt}
                      onPromptChange={setVideoPrompt}
                      negativePromptValue={videoNegativePrompt}
                      onNegativePromptChange={setVideoNegativePrompt}
                      selectedModel={selectedVideoModel}
                      onModelChange={setSelectedVideoModel}
                      inputImage={inputImage}
                      onInputImageChange={setInputImage}
                      lastFrameImage={lastFrameImage}
                      onLastFrameChange={setLastFrameImage}
                      inputVideo={inputVideo}
                      onInputVideoChange={setInputVideo}
                      inputAudio={inputAudio}
                      onInputAudioChange={setInputAudio}
                      parameters={videoParameters}
                      onParametersChange={setVideoParameters}
                      estimatedCredits={estimatedVideoCredits}
                      isGenerating={isVideoHandoffPending || videoModelsLoading}
                      onGenerate={() => void handleVideoGenerate()}
                      allowOptionsDuringGeneration
                      multiShotMode={multiShotMode}
                      onMultiShotModeChange={setMultiShotMode}
                      multiShotShots={multiShotShots}
                      onMultiShotShotsChange={setMultiShotShots}
                      referenceImages={videoReferenceImages}
                      onReferenceImagesChange={setVideoReferenceImages}
                      attachedRefs={videoAttachedRefs}
                      onAttachedRefsChange={setVideoAttachedRefs}
                    />
                  </div>
                ) : (
                  <HeroLoadingCard label="Loading video tools..." />
                )
              ) : null}

              {activeTab === "image" ? (
                selectedImageModel || !imageModelsLoading ? (
                  <div className="mx-auto flex w-full justify-center">
                    <InfluencerInputBox
                      className="mx-auto"
                      promptValue={imagePrompt}
                      onPromptChange={setImagePrompt}
                      onAttachedRefsChange={setImageAttachedRefs}
                      referenceImage={referenceImage}
                      onReferenceImageChange={setReferenceImage}
                      referenceImages={referenceImages}
                      onReferenceImagesChange={setReferenceImages}
                      enhancePrompt={enhancePrompt}
                      onEnhancePromptChange={setEnhancePrompt}
                      isGenerating={isImageHandoffPending || imageModelsLoading}
                      onGenerate={() => void handleImageGenerate()}
                      selectedModel={selectedImageModel}
                      onModelChange={setSelectedImageModel}
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
                ) : (
                  <HeroLoadingCard label="Loading image tools..." />
                )
              ) : null}

              {activeTab === "agent" ? (
                <div className="mx-auto flex w-full justify-center">
                  <DashboardAgentPromptBox
                    className="mx-auto max-w-4xl"
                    promptValue={agentPrompt}
                    onPromptChange={setAgentPrompt}
                    attachedRefs={agentAttachedRefs}
                    onAttachedRefsChange={setAgentAttachedRefs}
                    selectedModelId={selectedAgentModel}
                    onModelChange={setSelectedAgentModel}
                    onSubmit={handleAgentGenerate}
                    onOpenFullAgent={() => {
                      const trimmedPrompt = agentPrompt.trim()
                      if (trimmedPrompt) {
                        saveDashboardAgentHandoff({
                          prompt: trimmedPrompt,
                          attachedRefs: agentAttachedRefs,
                          model: selectedAgentModel,
                        })
                      }
                      router.push("/chat")
                    }}
                    isSubmitting={isAgentHandoffPending}
                  />
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

function HeroLoadingCard({ label }: { label: string }) {
  return (
    <div className="mx-auto flex min-h-[18rem] w-full max-w-5xl items-center justify-center rounded-[32px] border border-border/60 bg-card/70 px-6 py-12 shadow-sm backdrop-blur">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
