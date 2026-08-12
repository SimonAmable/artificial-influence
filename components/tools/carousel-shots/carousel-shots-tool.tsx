"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { UploadSimple } from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  CarouselShotsInputBox,
  type CarouselShotsFormState,
} from "@/components/tools/carousel-shots/carousel-shots-input-box"
import {
  CarouselShotsRightPanel,
  type CarouselShotsRightView,
} from "@/components/tools/carousel-shots/carousel-shots-right-panel"
import {
  isInsufficientCreditsError,
  isInsufficientCreditsMessage,
} from "@/lib/generate-image-client"
import {
  toUserFacingGenerationError,
  tryShowContentModerationToast,
} from "@/lib/content-moderation-toast"
import { showCreditsUpsellToast } from "@/lib/pricing-upsell"
import { DEFAULT_CAROUSEL_HD_SHOT_COUNT, DEFAULT_CAROUSEL_SHOTS_MODEL } from "@/lib/carousel-shots/constants"
import type {
  CarouselGenerationMode,
  CarouselPanelAspectRatio,
  CarouselShotsMetadata,
} from "@/lib/carousel-shots/types"
import { isCarouselShotsMetadata } from "@/lib/carousel-shots/types"
import { cn } from "@/lib/utils"

const DEFAULT_FORM: CarouselShotsFormState = {
  referenceImage: null,
  generationMode: "fast",
  gridSize: 4,
  hdShotCount: DEFAULT_CAROUSEL_HD_SHOT_COUNT,
  aspectRatio: "9:16",
  variationStrength: "subtle",
  customVariation: "",
  perShotVariationEnabled: false,
  perShotVariations: [],
  model: DEFAULT_CAROUSEL_SHOTS_MODEL,
}

const DRAG_PREVIEW_OFFSET_X = 18
const DRAG_PREVIEW_OFFSET_Y = 18

type PendingJob = {
  id: string
  aspectRatio: CarouselPanelAspectRatio
  generationMode: CarouselGenerationMode
  shotCount: number
}

type PendingResult = {
  generationId: string
  metadata: CarouselShotsMetadata
}

function getImageFileFromDataTransfer(dataTransfer: DataTransfer): File | null {
  for (const item of Array.from(dataTransfer.items ?? [])) {
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue
    const file = item.getAsFile()
    if (file) return file
  }

  for (const file of Array.from(dataTransfer.files ?? [])) {
    if (file.type.startsWith("image/")) return file
  }

  return null
}

export function CarouselShotsTool() {
  const searchParams = useSearchParams()
  const focusedGenerationId = searchParams.get("generation")
  const referenceImageParam = searchParams.get("image")
  const [form, setForm] = React.useState<CarouselShotsFormState>(DEFAULT_FORM)
  const [pendingJobs, setPendingJobs] = React.useState<PendingJob[]>([])
  const [pendingResults, setPendingResults] = React.useState<PendingResult[]>([])
  const [rightView, setRightView] = React.useState<CarouselShotsRightView>(
    focusedGenerationId ? "history" : "example",
  )
  const [historyRefreshKey, setHistoryRefreshKey] = React.useState(0)
  const [historyScrollNonce, setHistoryScrollNonce] = React.useState(0)
  const [isDraggingFile, setIsDraggingFile] = React.useState(false)
  const [dragPreviewUrl, setDragPreviewUrl] = React.useState<string | null>(null)
  const dragCounterRef = React.useRef(0)
  const dragPreviewUrlRef = React.useRef<string | null>(null)
  const dragPreviewElRef = React.useRef<HTMLDivElement>(null)
  const historyPanelAnchorRef = React.useRef<HTMLDivElement>(null)

  const scrollHistoryIntoView = React.useCallback(() => {
    window.requestAnimationFrame(() => {
      historyPanelAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [])

  const bumpHistoryScroll = React.useCallback(() => {
    setHistoryScrollNonce((current) => current + 1)
    scrollHistoryIntoView()
  }, [scrollHistoryIntoView])

  const applyReferenceFile = React.useCallback((file?: File | null) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file")
      return
    }

    setForm((current) => ({
      ...current,
      referenceImage: {
        file,
        url: URL.createObjectURL(file),
      },
    }))
  }, [])

  const clearDragPreview = React.useCallback(() => {
    if (dragPreviewUrlRef.current) {
      URL.revokeObjectURL(dragPreviewUrlRef.current)
      dragPreviewUrlRef.current = null
    }
    setDragPreviewUrl(null)
  }, [])

  const clearPageDragState = React.useCallback(() => {
    dragCounterRef.current = 0
    setIsDraggingFile(false)
    clearDragPreview()
  }, [clearDragPreview])

  const updateDragPreviewPosition = React.useCallback((clientX: number, clientY: number) => {
    const el = dragPreviewElRef.current
    if (!el) return
    el.style.transform = `translate3d(${clientX + DRAG_PREVIEW_OFFSET_X}px, ${clientY + DRAG_PREVIEW_OFFSET_Y}px, 0) rotate(-8deg)`
  }, [])

  const ensureDragPreview = React.useCallback(
    (dataTransfer: DataTransfer, clientX: number, clientY: number) => {
      if (dragPreviewUrlRef.current) {
        updateDragPreviewPosition(clientX, clientY)
        return
      }

      const file = getImageFileFromDataTransfer(dataTransfer)
      if (!file) return

      const url = URL.createObjectURL(file)
      dragPreviewUrlRef.current = url
      setDragPreviewUrl(url)
      // Position after paint so the ref exists
      window.requestAnimationFrame(() => {
        updateDragPreviewPosition(clientX, clientY)
      })
    },
    [updateDragPreviewPosition],
  )

  const handlePageDragOver = React.useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault()
      event.stopPropagation()
      if (!event.dataTransfer.types.includes("Files")) return
      event.dataTransfer.dropEffect = "copy"
      ensureDragPreview(event.dataTransfer, event.clientX, event.clientY)
      updateDragPreviewPosition(event.clientX, event.clientY)
    },
    [ensureDragPreview, updateDragPreviewPosition],
  )

  const handlePageDragEnter = React.useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault()
      event.stopPropagation()
      if (!event.dataTransfer.types.includes("Files")) return
      dragCounterRef.current += 1
      setIsDraggingFile(true)
      ensureDragPreview(event.dataTransfer, event.clientX, event.clientY)
    },
    [ensureDragPreview],
  )

  const handlePageDragLeave = React.useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault()
      event.stopPropagation()
      dragCounterRef.current -= 1
      if (dragCounterRef.current <= 0) {
        clearPageDragState()
      }
    },
    [clearPageDragState],
  )

  const handlePageDropCapture = React.useCallback(() => {
    clearPageDragState()
  }, [clearPageDragState])

  const handlePageDrop = React.useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault()
      event.stopPropagation()
      clearPageDragState()
      applyReferenceFile(event.dataTransfer.files?.[0] ?? null)
    },
    [applyReferenceFile, clearPageDragState],
  )

  React.useEffect(() => {
    return () => {
      if (dragPreviewUrlRef.current) {
        URL.revokeObjectURL(dragPreviewUrlRef.current)
        dragPreviewUrlRef.current = null
      }
    }
  }, [])

  React.useEffect(() => {
    const imageUrl = referenceImageParam?.trim()
    if (!imageUrl) return

    setForm((current) => ({
      ...current,
      referenceImage: {
        url: imageUrl,
      },
    }))
  }, [referenceImageParam])

  React.useEffect(() => {
    if (!focusedGenerationId) return

    setRightView("history")

    let cancelled = false

    void (async () => {
      try {
        const response = await fetch(`/api/carousel-shots/${focusedGenerationId}`)
        const data = (await response.json().catch(() => ({}))) as {
          metadata?: CarouselShotsMetadata
        }

        if (!response.ok || !isCarouselShotsMetadata(data.metadata)) {
          if (!cancelled) {
            toast.error("Could not open that carousel set")
          }
          return
        }

        if (cancelled) return

        setPendingResults((current) => {
          if (current.some((entry) => entry.generationId === focusedGenerationId)) {
            return current.map((entry) =>
              entry.generationId === focusedGenerationId
                ? { ...entry, metadata: data.metadata! }
                : entry,
            )
          }
          return [
            { generationId: focusedGenerationId, metadata: data.metadata! },
            ...current,
          ]
        })
      } catch {
        if (!cancelled) {
          toast.error("Could not open that carousel set")
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [focusedGenerationId])

  const activeSlotCount = pendingJobs.length
  const isGenerating = activeSlotCount > 0

  const handleGenerationFailure = React.useCallback((responseStatus: number | null, message: string) => {
    if (responseStatus === 402 || isInsufficientCreditsMessage(message)) {
      showCreditsUpsellToast({
        message,
        description: "Upgrade your plan to continue generating",
        toastId: "carousel-shots-credits-upsell",
      })
      return
    }

    if (
      tryShowContentModerationToast(message, undefined, {
        toastId: "carousel-shots-moderation-error",
      })
    ) {
      return
    }

    toast.error(toUserFacingGenerationError(message, "Generation failed. Please try again."))
  }, [])

  const runGenerate = React.useCallback(async () => {
    const reference = form.referenceImage
    if (!reference?.file && !reference?.url) {
      toast.error("Please upload a reference image")
      return
    }

    const shotCount = form.generationMode === "hd" ? form.hdShotCount : form.gridSize
    const jobId = crypto.randomUUID()
    const jobSnapshot: PendingJob = {
      id: jobId,
      aspectRatio: form.aspectRatio,
      generationMode: form.generationMode,
      shotCount,
    }
    const perShotVariations =
      form.variationStrength === "custom" && form.perShotVariationEnabled
        ? Array.from({ length: shotCount }, (_, index) => form.perShotVariations[index]?.trim() ?? "")
        : []
    const formSnapshot = {
      file: reference.file ?? null,
      url: reference.url ?? null,
      generationMode: form.generationMode,
      gridSize: form.gridSize,
      shotCount,
      aspectRatio: form.aspectRatio,
      variationStrength: form.variationStrength,
      customVariation: form.customVariation.trim(),
      perShotVariations,
      model: form.model,
    }

    setPendingJobs((current) => [jobSnapshot, ...current])
    setRightView("history")
    bumpHistoryScroll()

    try {
      let referenceFile = formSnapshot.file
      if (!referenceFile && formSnapshot.url) {
        const response = await fetch(formSnapshot.url)
        if (!response.ok) {
          throw new Error("Failed to load reference image")
        }
        const blob = await response.blob()
        const mimeType = blob.type.startsWith("image/") ? blob.type : "image/png"
        referenceFile = new File([blob], "reference.png", { type: mimeType })
      }

      if (!referenceFile) {
        throw new Error("Please upload a reference image")
      }

      const formData = new FormData()
      formData.append("referenceImage", referenceFile)
      formData.append("generationMode", formSnapshot.generationMode)
      if (formSnapshot.generationMode === "fast") {
        formData.append("gridSize", String(formSnapshot.gridSize))
      } else {
        formData.append("shotCount", String(formSnapshot.shotCount))
      }
      formData.append("aspectRatio", formSnapshot.aspectRatio)
      formData.append("variationStrength", formSnapshot.variationStrength)
      if (formSnapshot.customVariation) {
        formData.append("customVariation", formSnapshot.customVariation)
      }
      if (formSnapshot.perShotVariations.some((entry) => entry.length > 0)) {
        formData.append("perShotVariations", JSON.stringify(formSnapshot.perShotVariations))
      }
      formData.append("model", formSnapshot.model)

      const response = await fetch("/api/carousel-shots/generate", {
        method: "POST",
        body: formData,
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const message =
          typeof data.message === "string"
            ? data.message
            : typeof data.error === "string"
              ? data.error
              : "Generation failed"
        handleGenerationFailure(response.status, message)
        return
      }

      if (!isCarouselShotsMetadata(data.metadata)) {
        throw new Error("Invalid carousel shots response")
      }

      const generationId = typeof data.generationId === "string" ? data.generationId : null
      if (generationId) {
        setPendingResults((current) => [
          { generationId, metadata: data.metadata },
          ...current.filter((entry) => entry.generationId !== generationId),
        ])
      }
      setHistoryRefreshKey((current) => current + 1)
      setHistoryScrollNonce((current) => current + 1)
      toast.success("Carousel shots ready")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed"
      if (isInsufficientCreditsError(err) || isInsufficientCreditsMessage(message)) {
        showCreditsUpsellToast({
          message,
          description: "Upgrade your plan to continue generating",
          toastId: "carousel-shots-credits-upsell",
        })
      } else if (
        !tryShowContentModerationToast(message, err, {
          toastId: "carousel-shots-moderation-error",
        })
      ) {
        toast.error(toUserFacingGenerationError(message, "Generation failed. Please try again."))
      }
    } finally {
      setPendingJobs((current) => current.filter((job) => job.id !== jobId))
    }
  }, [bumpHistoryScroll, form, handleGenerationFailure])

  const handleShotsChange = React.useCallback(
    (generationId: string, shots: CarouselShotsMetadata["shots"]) => {
      setPendingResults((current) =>
        current.map((entry) =>
          entry.generationId === generationId
            ? {
                ...entry,
                metadata: {
                  ...entry.metadata,
                  shots,
                },
              }
            : entry,
        ),
      )
    },
    [],
  )

  return (
    <main
      className={cn(
        "relative box-border flex h-dvh max-h-dvh w-full flex-col overflow-hidden px-2 pb-4 pt-[52px] transition-colors sm:px-4",
        isDraggingFile && "bg-primary/5",
      )}
      onDragOver={handlePageDragOver}
      onDragEnter={handlePageDragEnter}
      onDragLeave={handlePageDragLeave}
      onDropCapture={handlePageDropCapture}
      onDrop={handlePageDrop}
    >
      {isDraggingFile ? (
        <div
          className="pointer-events-none absolute inset-2 top-[52px] z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-primary/10 sm:inset-4 sm:top-[52px]"
          aria-live="polite"
          role="status"
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/15">
              <UploadSimple className="size-8 text-primary" weight="bold" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">Drop reference image</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Sets the subject, outfit, and scene for your carousel
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {dragPreviewUrl ? (
        <div
          ref={dragPreviewElRef}
          className="pointer-events-none fixed left-0 top-0 z-60 will-change-transform"
          style={{ transform: "translate3d(-9999px, -9999px, 0) rotate(-8deg)" }}
          aria-hidden
        >
          <div className="overflow-hidden rounded-2xl border-[3px] border-primary bg-background shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob preview URL during drag */}
            <img
              src={dragPreviewUrl}
              alt=""
              draggable={false}
              className="block h-40 w-28 object-cover sm:h-48 sm:w-32"
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain lg:grid lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] lg:items-stretch lg:overflow-hidden">
        <div
          ref={historyPanelAnchorRef}
          className="relative order-1 flex min-h-[70dvh] min-w-0 flex-1 flex-col lg:order-2 lg:min-h-0 lg:overflow-hidden"
        >
          <CarouselShotsRightPanel
            view={rightView}
            onViewChange={setRightView}
            historyRefreshKey={historyRefreshKey}
            historyScrollNonce={historyScrollNonce}
            pendingJobs={pendingJobs}
            pendingResults={pendingResults}
            focusedGenerationId={focusedGenerationId}
            onShotsChange={handleShotsChange}
          />
        </div>

        <div className="order-2 w-full min-w-0 shrink-0 lg:order-1 lg:min-h-0 lg:overflow-y-auto">
          <CarouselShotsInputBox
            form={form}
            isGenerating={isGenerating}
            activeSlotCount={activeSlotCount}
            onChange={setForm}
            onGenerate={() => void runGenerate()}
          />
        </div>
      </div>
    </main>
  )
}
