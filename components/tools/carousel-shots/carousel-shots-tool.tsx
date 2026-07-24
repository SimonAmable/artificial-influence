"use client"

import * as React from "react"
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
import { tryShowContentModerationToast } from "@/lib/content-moderation-toast"
import { showCreditsUpsellToast } from "@/lib/pricing-upsell"
import type {
  CarouselGridSize,
  CarouselPanelAspectRatio,
  CarouselShotsMetadata,
} from "@/lib/carousel-shots/types"
import { isCarouselShotsMetadata } from "@/lib/carousel-shots/types"

const DEFAULT_FORM: CarouselShotsFormState = {
  referenceImage: null,
  gridSize: 9,
  aspectRatio: "4:5",
  variationStrength: "natural",
  model: "google/nano-banana-2",
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
  const [form, setForm] = React.useState<CarouselShotsFormState>(DEFAULT_FORM)
  const [pendingJobs, setPendingJobs] = React.useState<PendingJob[]>([])
  const [pendingResults, setPendingResults] = React.useState<PendingResult[]>([])
  const [rightView, setRightView] = React.useState<CarouselShotsRightView>("example")
  const [historyRefreshKey, setHistoryRefreshKey] = React.useState(0)
  const [regeneratingId, setRegeneratingId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

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
      setError(message)
      return
    }

    setError(message)
    toast.error(message)
  }, [])

  const runGenerate = React.useCallback(async () => {
    const reference = form.referenceImage
    if (!reference?.file && !reference?.url) {
      setError("Please upload a reference image")
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
    setError(null)
    setRightView("history")

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
      toast.success("Carousel shots ready")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed"
      if (isInsufficientCreditsError(err) || isInsufficientCreditsMessage(message)) {
        showCreditsUpsellToast({
          message,
          description: "Upgrade your plan to continue generating",
          toastId: "carousel-shots-credits-upsell",
        })
      } else {
        setError(message)
        toast.error(message)
      }
    } finally {
      setPendingJobs((current) => current.filter((job) => job.id !== jobId))
    }
  }, [form, handleGenerationFailure])

  const runRegenerate = React.useCallback(
    async (generationId: string) => {
      setRegeneratingId(generationId)
      setError(null)
      setRightView("history")

      try {
        const response = await fetch(`/api/carousel-shots/${generationId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "regenerate" }),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          const message =
            typeof data.message === "string"
              ? data.message
              : typeof data.error === "string"
                ? data.error
                : "Regeneration failed"
          handleGenerationFailure(response.status, message)
          return
        }
        if (!isCarouselShotsMetadata(data.metadata)) {
          throw new Error("Invalid carousel shots response")
        }

        const nextGenerationId =
          typeof data.generationId === "string" ? data.generationId : generationId
        setPendingResults((current) => [
          { generationId: nextGenerationId, metadata: data.metadata },
          ...current.filter((entry) => entry.generationId !== nextGenerationId),
        ])
        setHistoryRefreshKey((current) => current + 1)
        toast.success("Carousel shots regenerated")
      } catch (err) {
        const message = err instanceof Error ? err.message : "Regeneration failed"
        if (isInsufficientCreditsError(err) || isInsufficientCreditsMessage(message)) {
          showCreditsUpsellToast({
            message,
            description: "Upgrade your plan to continue generating",
            toastId: "carousel-shots-credits-upsell",
          })
        } else {
          setError(message)
          toast.error(message)
        }
      } finally {
        setRegeneratingId(null)
      }
    },
    [handleGenerationFailure],
  )

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
    <main className="box-border flex h-dvh max-h-dvh w-full flex-col overflow-hidden px-2 pb-4 pt-[52px] sm:px-4">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain lg:grid lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] lg:items-stretch lg:overflow-hidden">
        <div className="w-full min-w-0 shrink-0 lg:min-h-0 lg:overflow-y-auto">
          <CarouselShotsInputBox
            form={form}
            isGenerating={isGenerating}
            activeSlotCount={activeSlotCount}
            onChange={setForm}
            onGenerate={() => void runGenerate()}
          />
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </div>

        <div className="relative flex min-h-[70dvh] min-w-0 flex-1 flex-col lg:min-h-0 lg:overflow-hidden">
          <CarouselShotsRightPanel
            view={rightView}
            onViewChange={setRightView}
            historyRefreshKey={historyRefreshKey}
            pendingJobs={pendingJobs}
            pendingResults={pendingResults}
            regeneratingId={regeneratingId}
            onRegenerate={runRegenerate}
            onShotsChange={handleShotsChange}
          />
        </div>
      </div>
    </main>
  )
}
