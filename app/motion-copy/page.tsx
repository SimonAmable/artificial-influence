"use client"

import * as React from "react"
import { GeneratorLayout } from "@/components/shared/layout/generator-layout"
import { MotionCopyInputBox } from "@/components/tools/motion-copy/motion-copy-input-box"
import { MotionCopyShowcaseCard } from "@/components/tools/motion-copy/motion-copy-showcase-card"
import {
  VideoGrid,
  type VideoGridItem,
  type VideoHistoryItem,
} from "@/components/shared/display/video-grid"
import { useLayoutMode } from "@/components/shared/layout/layout-mode-context"
import { ImageUpload } from "@/components/shared/upload/photo-upload"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import { generateVideoAndWait } from "@/lib/generate-video-client"
import { resolveReferenceImageForGeneration } from "@/lib/image/resolve-reference-for-generation"
import { resolveReferenceVideoForGeneration } from "@/lib/video/resolve-reference-for-generation"
import { getVideoDurationSeconds } from "@/lib/video-editor/media-parser"
import { MotionCopyFaceLockControl } from "@/components/tools/motion-copy/motion-copy-face-lock-control"
import { MotionCopySwapModeControl } from "@/components/tools/motion-copy/motion-copy-swap-mode-control"
import {
  AssetSelectionModal,
  type AssetSelectionPick,
} from "@/components/shared/modals/asset-selection-modal"
import {
  isFaceLockActive,
  type FaceLockMode,
} from "@/lib/motion-copy/face-lock"
import {
  isMotionCopySwapActive,
  motionCopySwapHistoryToolTag,
  motionCopySwapModeLabel,
  type MotionCopySwapMode,
} from "@/lib/motion-copy/swap-mode"
import { estimateMotionSwapCredits } from "@/lib/motion-copy/estimate-motion-swap-credits"
import { runSwapForMotionCopy } from "@/lib/motion-copy/run-swap-for-motion"
import { resolveVideoPricingQuote } from "@/lib/video-pricing"
import { getModelMetadataByIdentifier } from "@/lib/constants/model-metadata"
import {
  isInsufficientCreditsError,
  isInsufficientCreditsMessage,
} from "@/lib/generate-image-client"
import { showCreditsUpsellToast } from "@/lib/pricing-upsell"
import { usePersistedSwapPreviewSlots } from "@/hooks/use-persisted-swap-preview-slots"
import {
  resolveSwapPreviewImageUpload,
  resolveSwapPreviewVideoUpload,
} from "@/lib/motion-copy/swap-preview-storage"

const MOTION_COPY_MODEL = "kwaivgi/kling-v3-motion-control" as const

function createClientRequestId() {
  return `mc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export default function MotionCopyPage() {
  const layoutModeContext = useLayoutMode()

  if (!layoutModeContext) {
    throw new Error("MotionCopyPage must be used within LayoutModeProvider")
  }

  const { layoutMode } = layoutModeContext

  const [inputImage, setInputImage] = React.useState<ImageUpload | null>(null)
  const [inputVideo, setInputVideo] = React.useState<ImageUpload | null>(null)
  const [characterOrientation, setCharacterOrientation] = React.useState<string>("video")
  const [faceLockMode, setFaceLockMode] = React.useState<FaceLockMode>("off")
  const [faceLockCustomImage, setFaceLockCustomImage] = React.useState<ImageUpload | null>(null)
  const [faceLockAssetPickerOpen, setFaceLockAssetPickerOpen] = React.useState(false)
  const [swapMode, setSwapMode] = React.useState<MotionCopySwapMode>("off")
  const [prompt, setPrompt] = React.useState("")
  const [historyVideos, setHistoryVideos] = React.useState<VideoHistoryItem[]>([])
  const [pendingVideoSlots, setPendingVideoSlots] = React.useState<
    Array<{ clientRequestId: string; startedAt: string }>
  >([])
  const {
    slots: swapPreviewSlots,
    setSlots: setSwapPreviewSlots,
    removeSlot: removeSwapSlot,
    updateSlot: updateSwapSlot,
  } = usePersistedSwapPreviewSlots("motion-copy")
  const [isBusy, setIsBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const estimatedSwapCredits = React.useMemo(() => {
    if (!isMotionCopySwapActive(swapMode)) return null
    return estimateMotionSwapCredits(swapMode)
  }, [swapMode])

  const estimatedVideoCredits = React.useMemo(() => {
    const meta = getModelMetadataByIdentifier(MOTION_COPY_MODEL)
    return resolveVideoPricingQuote({
      modelIdentifier: MOTION_COPY_MODEL,
      modelCost: meta?.model_cost ?? null,
      mode: "pro",
      characterOrientation,
      faceLock: faceLockMode,
      hasInputVideo: true,
      hasReferenceVideo: true,
    }).quotedCredits
  }, [characterOrientation, faceLockMode])

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video")
      video.preload = "metadata"

      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src)
        resolve(video.duration)
      }

      video.onerror = () => {
        window.URL.revokeObjectURL(video.src)
        reject(new Error("Failed to load video metadata"))
      }

      video.src = URL.createObjectURL(file)
    })
  }

  const runMotionVideo = React.useCallback(
    async (opts: { characterImage: ImageUpload; drivingVideo: ImageUpload }) => {
      const clientRequestId = createClientRequestId()
      setPendingVideoSlots((prev) => [
        { clientRequestId, startedAt: new Date().toISOString() },
        ...prev,
      ])
      setIsBusy(true)
      setError(null)

      try {
        const resolvedImage = await resolveReferenceImageForGeneration(opts.characterImage)
        const resolvedVideo = await resolveReferenceVideoForGeneration(opts.drivingVideo)
        if (!resolvedImage?.url) {
          throw new Error("Please upload an image")
        }
        if (!resolvedVideo?.url) {
          throw new Error("Please upload a video")
        }

        if (resolvedImage.file && !resolvedImage.file.type.startsWith("image/")) {
          throw new Error("Image must be a valid image file")
        }
        if (resolvedVideo.file && !resolvedVideo.file.type.startsWith("video/")) {
          throw new Error("Video must be a valid video file")
        }

        const maxImageSize = 10 * 1024 * 1024
        const maxVideoSize = 50 * 1024 * 1024
        if (resolvedImage.file && resolvedImage.file.size > maxImageSize) {
          throw new Error("Image is too large. Maximum size is 10MB.")
        }
        if (resolvedVideo.file && resolvedVideo.file.size > maxVideoSize) {
          throw new Error("Video is too large. Maximum size is 50MB.")
        }

        const maxDuration = characterOrientation === "video" ? 30 : 10
        const videoDuration = resolvedVideo.file
          ? await getVideoDuration(resolvedVideo.file)
          : await getVideoDurationSeconds(resolvedVideo.url)
        if (videoDuration > maxDuration) {
          throw new Error(
            `Video duration must be ${maxDuration} seconds or less for ${characterOrientation} orientation. Your video is ${videoDuration.toFixed(1)} seconds.`,
          )
        }

        if (isFaceLockActive(faceLockMode)) {
          if (characterOrientation !== "video") {
            throw new Error("Face lock requires video orientation.")
          }
          if (faceLockMode === "custom" && !faceLockCustomImage?.url) {
            throw new Error("Choose a custom face image for face lock.")
          }
        }

        let imagePublicUrl = resolvedImage.url
        let imageStoragePath: string | undefined
        if (resolvedImage.file) {
          const uploadedImage = await uploadFileToSupabase(resolvedImage.file, "reference-images")
          if (!uploadedImage) throw new Error("Failed to upload image")
          imageStoragePath = uploadedImage.storagePath
          imagePublicUrl = uploadedImage.url
        }

        let videoPublicUrl = resolvedVideo.url
        let videoStoragePath: string | undefined
        if (resolvedVideo.file) {
          const uploadedVideo = await uploadFileToSupabase(resolvedVideo.file, "reference-videos")
          if (!uploadedVideo) throw new Error("Failed to upload video")
          videoStoragePath = uploadedVideo.storagePath
          videoPublicUrl = uploadedVideo.url
        }

        let faceLockImagePublicUrl: string | undefined
        if (faceLockMode === "custom" && faceLockCustomImage?.url) {
          const resolvedFace = await resolveReferenceImageForGeneration(faceLockCustomImage)
          if (resolvedFace?.file) {
            const uploadedFace = await uploadFileToSupabase(resolvedFace.file, "motion-copy-face-lock")
            if (!uploadedFace) throw new Error("Failed to upload face lock image")
            faceLockImagePublicUrl = uploadedFace.url
          } else if (resolvedFace?.url) {
            faceLockImagePublicUrl = resolvedFace.url
          }
        }

        const data = await generateVideoAndWait("/api/generate-video", {
          imageUrl: imagePublicUrl,
          videoUrl: videoPublicUrl,
          ...(imageStoragePath ? { imageStoragePath } : {}),
          ...(videoStoragePath ? { videoStoragePath } : {}),
          prompt: prompt.trim(),
          mode: "pro",
          keep_original_sound: true,
          character_orientation: characterOrientation,
          face_lock: faceLockMode,
          ...(faceLockImagePublicUrl ? { face_lock_image_url: faceLockImagePublicUrl } : {}),
          model: MOTION_COPY_MODEL,
          tool: "motion_copy",
        })

        if (!data.video?.url) {
          throw new Error("No video URL received from API")
        }

        setHistoryVideos((prev) => [
          {
            id: clientRequestId,
            url: data.video.url,
            model: "Kling Motion Control",
            prompt: prompt.trim() || null,
            tool: "motion_copy",
            createdAt: new Date().toISOString(),
            referenceImageUrls: [imagePublicUrl],
          },
          ...prev,
        ])
      } catch (err) {
        console.error("Error generating motion copy:", err)
        setError(err instanceof Error ? err.message : "Failed to generate motion copy")
      } finally {
        setPendingVideoSlots((prev) =>
          prev.filter((slot) => slot.clientRequestId !== clientRequestId),
        )
        setIsBusy(false)
      }
    },
    [characterOrientation, faceLockCustomImage, faceLockMode, prompt],
  )

  const runSwapPreview = React.useCallback(
    async (clientRequestId?: string) => {
      const slotId = clientRequestId ?? createClientRequestId()
      const existing = clientRequestId
        ? swapPreviewSlots.find((s) => s.clientRequestId === clientRequestId)
        : null

      const characterImage = existing
        ? resolveSwapPreviewImageUpload(existing, inputImage)
        : inputImage?.url
          ? inputImage
          : null
      const drivingVideo = existing
        ? resolveSwapPreviewVideoUpload(existing, inputVideo)
        : inputVideo?.url
          ? inputVideo
          : null

      if (!characterImage?.url) {
        setError("Please upload an image")
        return
      }
      if (!drivingVideo?.url) {
        setError("Please upload a video")
        return
      }

      const activeSwapMode = existing?.swapMode ?? swapMode
      if (!isMotionCopySwapActive(activeSwapMode)) {
        setError("Select a swap mode")
        return
      }
      const swapCredits = estimateMotionSwapCredits(activeSwapMode)
      const swapLabel = motionCopySwapModeLabel(activeSwapMode)

      if (!existing) {
        setSwapPreviewSlots((prev) => [
          {
            clientRequestId: slotId,
            startedAt: new Date().toISOString(),
            swapMode: activeSwapMode,
            status: "pending",
            swapCredits,
            videoCredits: estimatedVideoCredits,
            characterImageUrl: characterImage.url,
            drivingVideoUrl: drivingVideo.url,
          },
          ...prev,
        ])
      } else {
        updateSwapSlot(slotId, {
          status: "pending",
          error: null,
          beforeUrl: existing.beforeUrl,
          afterUrl: null,
          characterImageUrl: characterImage.url,
          drivingVideoUrl: drivingVideo.url,
        })
      }

      setIsBusy(true)
      setError(null)

      try {
        const result = await runSwapForMotionCopy({
          swapMode: activeSwapMode,
          characterImage,
          drivingVideo,
        })

        updateSwapSlot(slotId, {
          status: "ready",
          beforeUrl: result.anchorFrameUrl,
          afterUrl: result.swappedImageUrl,
          error: null,
          swapCredits,
          videoCredits: estimatedVideoCredits,
          characterImageUrl: characterImage.url,
          drivingVideoUrl: drivingVideo.url,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : `${swapLabel} failed`
        if (isInsufficientCreditsError(err) || isInsufficientCreditsMessage(message)) {
          showCreditsUpsellToast({
            message,
            description: "Upgrade your plan to continue swap preview",
            toastId: "motion-copy-swap-credits-upsell",
          })
        }
        updateSwapSlot(slotId, {
          status: "failed",
          error: message,
          characterImageUrl: characterImage.url,
          drivingVideoUrl: drivingVideo.url,
        })
      } finally {
        setIsBusy(false)
      }
    },
    [
      estimatedVideoCredits,
      inputImage,
      inputVideo,
      swapMode,
      swapPreviewSlots,
      setSwapPreviewSlots,
      updateSwapSlot,
    ],
  )

  const handleGenerate = async () => {
    if (isMotionCopySwapActive(swapMode)) {
      await runSwapPreview()
      return
    }
    if (!inputImage || !inputVideo) {
      setError("Please upload an image and a video")
      return
    }
    await runMotionVideo({ characterImage: inputImage, drivingVideo: inputVideo })
  }

  const handleSwapContinue = React.useCallback(
    async (id: string) => {
      const slot = swapPreviewSlots.find((s) => s.clientRequestId === id)
      const drivingVideo = slot ? resolveSwapPreviewVideoUpload(slot, inputVideo) : null
      if (!slot?.afterUrl || !drivingVideo?.url) return
      removeSwapSlot(id)
      await runMotionVideo({
        characterImage: { url: slot.afterUrl },
        drivingVideo,
      })
    },
    [inputVideo, removeSwapSlot, runMotionVideo, swapPreviewSlots],
  )

  const handleSwapRetry = React.useCallback(
    (id: string) => {
      void runSwapPreview(id)
    },
    [runSwapPreview],
  )

  const handleSwapCancel = React.useCallback(
    (id: string) => {
      removeSwapSlot(id)
    },
    [removeSwapSlot],
  )

  const gridItems = React.useMemo((): VideoGridItem[] => {
    const swapItems = swapPreviewSlots.map((slot) => ({
      createdAt: slot.startedAt,
      item: {
        type: "swap-preview" as const,
        id: slot.clientRequestId,
        status: slot.status,
        beforeUrl: slot.beforeUrl,
        afterUrl: slot.afterUrl,
        model: motionCopySwapModeLabel(slot.swapMode),
        tool: isMotionCopySwapActive(slot.swapMode)
          ? motionCopySwapHistoryToolTag(slot.swapMode)
          : "character_swap",
        prompt:
          slot.status === "pending"
            ? `Extracting frame and running ${motionCopySwapModeLabel(slot.swapMode).toLowerCase()}…`
            : slot.status === "failed"
              ? slot.error
              : "Review swap before motion video",
        error: slot.error,
        swapCredits: slot.swapCredits,
        videoCredits: slot.videoCredits,
      },
    }))

    const generating = pendingVideoSlots.map((slot) => ({
      createdAt: slot.startedAt,
      item: {
        type: "generating" as const,
        id: `slot-${slot.clientRequestId}`,
        model: "Kling Motion Control",
        prompt: prompt.trim() || "Motion copy…",
      },
    }))

    const completed = historyVideos.map((video) => ({
      createdAt: video.createdAt ?? new Date(0).toISOString(),
      item: { type: "video" as const, data: video },
    }))

    return [...swapItems, ...generating, ...completed]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map((entry) => entry.item)
  }, [historyVideos, pendingVideoSlots, prompt, swapPreviewSlots])

  const renderShowcase = () => {
    if (gridItems.length > 0) {
      return (
        <VideoGrid
          items={gridItems}
          showNativeControlsOnHoverOnly
          onSwapPreviewContinue={handleSwapContinue}
          onSwapPreviewRetry={handleSwapRetry}
          onSwapPreviewCancel={handleSwapCancel}
        />
      )
    }

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

    return (
      <MotionCopyShowcaseCard
        title="CREATE YOUR"
        highlightedTitle="MOTION COPY"
        description="Recreate the motion from any UGC hook or short-form dance. Pair a reference clip with your image and get a matching clip for your feed."
        steps={[
          {
            mediaPath: "/motion_copy/step1_image.png",
            mediaType: "image",
            title: "UPLOAD IMAGE",
            description: "Your photo, product, or character as the subject that should move.",
          },
          {
            mediaPath: "/motion_copy/step2_video.mp4",
            mediaType: "video",
            title: "UPLOAD VIDEO",
            description: "Any UGC hook, dance, or trend clip you want the motion from.",
          },
          {
            mediaPath: "/motion_copy/step_3_copy.mp4",
            mediaType: "video",
            title: "GENERATE",
            description: "Export a short-form clip with your image following that motion.",
          },
        ]}
      />
    )
  }

  const isRowLayout = layoutMode === "row"
  const inputImageValue = inputImage ?? undefined
  const inputVideoValue = inputVideo ?? undefined

  const characterOrientationOptionsWithDescription: {
    value: string
    label: string
    description: string
  }[] = [
    { value: "image", label: "Image", description: "Same direction as picture (max 10s)" },
    { value: "video", label: "Video", description: "Match reference video (max 30s)" },
  ]

  const characterOrientationTriggerLabel =
    characterOrientationOptionsWithDescription.find((o) => o.value === characterOrientation)
      ?.label ?? ""

  const generateLabel = isMotionCopySwapActive(swapMode)
    ? `Preview ${motionCopySwapModeLabel(swapMode).toLowerCase()}${estimatedSwapCredits != null ? ` · ${estimatedSwapCredits} cr` : ""}`
    : estimatedVideoCredits != null
      ? `Generate · ${estimatedVideoCredits} cr`
      : "Generate"

  const generatingLabel = isMotionCopySwapActive(swapMode) ? "Swapping..." : "Generating..."

  const controlsRow = (
    <div className="flex flex-row items-center gap-3 flex-wrap w-full">
      <MotionCopySwapModeControl
        value={swapMode}
        onValueChange={setSwapMode}
        disabled={isBusy}
        estimatedSwapCredits={estimatedSwapCredits}
      />
      <div className="flex items-center gap-2 px-1">
        <Label htmlFor="character-orientation" className="text-xs text-muted-foreground shrink-0">
          Character orientation
        </Label>
        <Select
          value={characterOrientation}
          onValueChange={(value) => {
            setCharacterOrientation(value)
            if (value === "image" && isFaceLockActive(faceLockMode)) {
              setFaceLockMode("off")
              setFaceLockCustomImage(null)
            }
          }}
        >
          <SelectTrigger id="character-orientation" className="h-7 text-xs w-fit min-w-[72px]">
            <SelectValue placeholder="Select">{characterOrientationTriggerLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {characterOrientationOptionsWithDescription.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                <div className="flex flex-col gap-0.5">
                  <span>{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    {opt.description}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <MotionCopyFaceLockControl
        value={faceLockMode}
        onValueChange={(mode) => {
          setFaceLockMode(mode)
          if (mode !== "off") {
            setCharacterOrientation("video")
          }
          if (mode !== "custom") {
            setFaceLockCustomImage(null)
          }
        }}
        referenceImageUrl={inputImage?.url}
        customFaceImageUrl={faceLockCustomImage?.url}
        characterOrientation={characterOrientation}
        disabled={isBusy}
        onRequestCustomPick={() => setFaceLockAssetPickerOpen(true)}
      />
    </div>
  )

  const handleFaceLockAssetSelect = React.useCallback((pick: AssetSelectionPick) => {
    if (pick.assetType !== "image") return
    setFaceLockCustomImage({ url: pick.url })
    setFaceLockMode("custom")
    setCharacterOrientation("video")
    setFaceLockAssetPickerOpen(false)
  }, [])

  const inputBoxProps = {
    defaultImage: inputImageValue,
    defaultVideo: inputVideoValue,
    onImageChange: setInputImage,
    onVideoChange: setInputVideo,
    photoUploadProps: {
      title: "Upload Image",
      description: "Click to upload image",
    },
    videoUploadProps: {
      title: "Background source",
      description: "",
      maxDurationSeconds: characterOrientation === "video" ? 30 : 10,
    },
    isGenerating: isBusy,
    onGenerate: handleGenerate,
    extraControls: controlsRow,
    promptValue: prompt,
    onPromptChange: setPrompt,
    generateLabel,
    generatingLabel,
  }

  return (
    <div
      className={cn(
        "min-h-screen bg-background flex flex-col",
        isRowLayout ? "p-0" : "px-4 pt-4 pb-0 sm:px-6 sm:pt-6 md:px-12 md:pt-[60px]",
      )}
    >
      <div
        className={cn(
          "mx-auto flex-1 flex flex-col",
          isRowLayout ? "w-full pt-20" : "max-w-7xl",
        )}
      >
        <GeneratorLayout layoutMode={layoutMode} className="h-full flex-1 min-h-0">
          {isRowLayout ? (
            <>
              <div className="flex-1 w-full h-full overflow-auto pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {renderShowcase()}
              </div>

              <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6">
                <div className="max-w-7xl mx-auto flex justify-center">
                  <MotionCopyInputBox forceRowLayout={true} {...inputBoxProps} />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="w-full flex-1 min-h-0 lg:pb-0">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 sm:gap-6 lg:gap-12 h-full">
                  <div className="hidden lg:block lg:sticky lg:top-0 h-fit">
                    <div className="flex justify-center">
                      <MotionCopyInputBox forceRowLayout={false} {...inputBoxProps} />
                    </div>
                  </div>

                  <div className="w-full h-full overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {renderShowcase()}
                  </div>
                </div>
              </div>

              <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 lg:hidden">
                <div className="max-w-7xl mx-auto flex justify-center">
                  <MotionCopyInputBox forceRowLayout={false} {...inputBoxProps} />
                </div>
              </div>
            </>
          )}
        </GeneratorLayout>
      </div>

      <AssetSelectionModal
        open={faceLockAssetPickerOpen}
        onOpenChange={setFaceLockAssetPickerOpen}
        onSelect={handleFaceLockAssetSelect}
        allowedAssetTypes={["image"]}
        defaultTab="assets"
      />
    </div>
  )
}
