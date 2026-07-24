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
import { DEFAULT_CAROUSEL_SHOTS_MODEL } from "@/lib/carousel-shots/constants"
import type {
  CarouselGridSize,
  CarouselPanelAspectRatio,
  CarouselShotsMetadata,
} from "@/lib/carousel-shots/types"
import { isCarouselShotsMetadata } from "@/lib/carousel-shots/types"
import { cn } from "@/lib/utils"

const DEFAULT_FORM: CarouselShotsFormState = {
  referenceImage: null,
  gridSize: 4,
  aspectRatio: "9:16",
  variationStrength: "subtle",
  model: DEFAULT_CAROUSEL_SHOTS_MODEL,
}

type PendingJob = {
  id: string
  aspectRatio: CarouselPanelAspectRatio
  gridSize: CarouselGridSize
}

type PendingResult = {
  generationId: string
  metadata: CarouselShotsMetadata
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
  const dragCounterRef = React.useRef(0)
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

  const clearPageDragState = React.useCallback(() => {
    dragCounterRef.current = 0
    setIsDraggingFile(false)
  }, [])

  const handlePageDragOver = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const handlePageDragEnter = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!event.dataTransfer.types.includes("Files")) return
    dragCounterRef.current += 1
    setIsDraggingFile(true)
  }, [])

  const handlePageDragLeave = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragCounterRef.current -= 1
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setIsDraggingFile(false)
    }
  }, [])

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

    const jobId = crypto.randomUUID()
    const jobSnapshot: PendingJob = {
      id: jobId,
      aspectRatio: form.aspectRatio,
      gridSize: form.gridSize,
    }
    const formSnapshot = {
      file: reference.file ?? null,
      url: reference.url ?? null,
      gridSize: form.gridSize,
      aspectRatio: form.aspectRatio,
      variationStrength: form.variationStrength,
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
      formData.append("gridSize", String(formSnapshot.gridSize))
      formData.append("aspectRatio", formSnapshot.aspectRatio)
      formData.append("variationStrength", formSnapshot.variationStrength)
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
