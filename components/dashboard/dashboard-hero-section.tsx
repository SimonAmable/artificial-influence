"use client"

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { DashboardAgentPromptBox } from "@/components/dashboard/dashboard-agent-prompt-box"
import { ShineBorder } from "@/components/ui/shine-border"
import { InfluencerInputBox } from "@/components/tools/influencer"
import type { AudioUploadValue } from "@/components/shared/upload/audio-upload"
import type { ImageUpload } from "@/components/shared/upload/photo-upload"
import { VideoInputBox } from "@/components/tools/video/video-input-box"
import type { MultiShotItem } from "@/components/tools/video/multi-shot-editor"
import { useDefaultEnhancePrompt } from "@/hooks/use-default-enhance-prompt"
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

type DashboardHeroMode = "video" | "image" | "agent"

const HERO_TABS: Array<{
  id: DashboardHeroMode
  label: string
  iconSrc: string
}> = [
  { id: "agent", label: "Agent", iconSrc: "/3d_icons/agent.png" },
  { id: "image", label: "Image", iconSrc: "/3d_icons/image.png" },
  { id: "video", label: "Video", iconSrc: "/3d_icons/video.png" },
]

const HERO_TAB_INDEX: Record<DashboardHeroMode, number> = {
  agent: 0,
  image: 1,
  video: 2,
}

const HERO_TITLES = [
  "What will you create?",
  "Got an idea?",
  "Tell us what you want",
  "Your turn to make something",
  "Ready when you are",
] as const

const HERO_TITLE_ROTATE_MS = 3200

function GlowContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-4xl rounded-[28px] p-[2.5px] transition-all duration-500 ease-in-out z-10",
        className
      )}
      style={{
        boxShadow: `
          0 0 24px 2px color-mix(in oklch, var(--foreground) 65%, transparent),
          0 0 48px 4px color-mix(in oklch, var(--foreground) 35%, transparent),
          0 0 96px 8px color-mix(in oklch, var(--foreground) 15%, transparent)
        `
      }}
    >
      <ShineBorder
        borderWidth={3}
        duration={12}
        shineColor={["var(--foreground)", "var(--muted-foreground)", "var(--foreground)"]}
        className="rounded-[28px]"
      />
      <div className="rounded-[25.5px] overflow-hidden bg-background/95 backdrop-blur-md relative z-10">
        {children}
      </div>
    </div>
  )
}

export function DashboardHeroSection({ className }: { className?: string }) {
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()
  const [activeTab, setActiveTab] = React.useState<DashboardHeroMode>("agent")
  const [tabDirection, setTabDirection] = React.useState(1)
  const [titleIndex, setTitleIndex] = React.useState(0)

  React.useEffect(() => {
    if (prefersReducedMotion) return
    const id = window.setInterval(() => {
      setTitleIndex((prev) => (prev + 1) % HERO_TITLES.length)
    }, HERO_TITLE_ROTATE_MS)
    return () => window.clearInterval(id)
  }, [prefersReducedMotion])

  const { models: imageModels, isLoading: imageModelsLoading } = useModels("image")
  const { models: videoModels, isLoading: videoModelsLoading } = useModels("video")

  const [imagePrompt, setImagePrompt] = React.useState("")
  const [imageAttachedRefs, setImageAttachedRefs] = React.useState<AttachedRef[]>([])
  const [referenceImage, setReferenceImage] = React.useState<ImageUpload | null>(null)
  const [referenceImages, setReferenceImages] = React.useState<ImageUpload[]>([])
  const [enhancePrompt, setEnhancePrompt] = React.useState(false)
  const { defaultEnhancePrompt, isReady: defaultEnhancePromptReady } =
    useDefaultEnhancePrompt()
  const enhancePromptSeededRef = React.useRef(false)
  const [selectedImageModel, setSelectedImageModel] = React.useState("")

  React.useEffect(() => {
    if (!defaultEnhancePromptReady || enhancePromptSeededRef.current) return
    enhancePromptSeededRef.current = true
    setEnhancePrompt(defaultEnhancePrompt)
  }, [defaultEnhancePrompt, defaultEnhancePromptReady])

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
      pricingConfig: selectedVideoModel.pricing_config,
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
      className={cn("relative flex w-full flex-col items-center justify-center overflow-hidden bg-background px-4", className)}
      style={{ minHeight: "calc(100vh + 40px)" }}
    >
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-5 py-8 sm:py-12">
        <div className="text-center">
          <h1 className="relative mx-auto flex min-h-[1.2em] w-full max-w-3xl items-center justify-center text-balance text-2xl font-sans font-extrabold normal-case tracking-tight text-foreground sm:text-4xl md:text-5xl">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={HERO_TITLES[titleIndex]}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(4px)" }}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(4px)" }}
                transition={{ duration: prefersReducedMotion ? 0.12 : 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="block"
              >
                {HERO_TITLES[titleIndex]}
              </motion.span>
            </AnimatePresence>
          </h1>
        </div>

        <div
          className={cn(
            "relative z-20 inline-flex flex-wrap items-center justify-center gap-1 rounded-full border p-[3px] backdrop-blur",
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
                  "inline-flex min-h-8 min-w-[6.5rem] shrink-0 items-center justify-center gap-1.5 rounded-full border border-transparent px-3 py-1 text-center text-sm font-medium transition-[color,box-shadow,border-color,background-color]",
                  isActive
                    ? "border-border/80 bg-background text-foreground shadow-sm dark:border-border/60 dark:bg-card/90"
                    : "text-muted-foreground hover:bg-background/40 hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "relative flex size-5 items-center justify-center transition-transform duration-300 ease-out",
                    isActive ? "scale-[2]" : "scale-100"
                  )}
                >
                  <Image
                    src={tab.iconSrc}
                    alt=""
                    width={20}
                    height={20}
                    className="h-5 w-5 object-contain"
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
              className="w-full flex justify-center"
            >
              {activeTab === "video" ? (
                selectedVideoModel ? (
                  <GlowContainer>
                    <VideoInputBox
                      className="mx-auto !border-transparent !bg-transparent !shadow-none"
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
                  </GlowContainer>
                ) : (
                  <HeroLoadingCard label="Loading video tools..." />
                )
              ) : null}

              {activeTab === "image" ? (
                selectedImageModel || !imageModelsLoading ? (
                  <GlowContainer>
                    <InfluencerInputBox
                      className="mx-auto !border-transparent !bg-transparent !shadow-none"
                      generateButtonLayout="bar"
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
                  </GlowContainer>
                ) : (
                  <HeroLoadingCard label="Loading image tools..." />
                )
              ) : null}

              {activeTab === "agent" ? (
                <GlowContainer>
                  <DashboardAgentPromptBox
                    className="mx-auto max-w-4xl !shadow-none !bg-transparent"
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
                </GlowContainer>
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
    <div className="mx-auto flex w-full max-w-5xl items-center justify-center rounded-[32px] border border-border/60 bg-card/70 px-6 py-12 shadow-sm backdrop-blur">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
