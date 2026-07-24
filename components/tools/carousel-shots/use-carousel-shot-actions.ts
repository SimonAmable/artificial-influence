"use client"

import * as React from "react"
import { toast } from "sonner"

import {
  buildUpscaleRequestPayload,
  type UpscaleSettings,
} from "@/components/tools/upscale/upscale-settings-popover"
import { downloadReferenceImageSlides } from "@/lib/client/download-reference-slides"
import {
  isInsufficientCreditsError,
  isInsufficientCreditsMessage,
} from "@/lib/generate-image-client"
import { showCreditsUpsellToast } from "@/lib/pricing-upsell"
import type { CarouselShotRecord } from "@/lib/carousel-shots/types"

const BATCH_UPSCALE_CONCURRENCY = 10

function triggerBlobDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement("a")
    anchor.href = objectUrl
    anchor.download = filename
    anchor.rel = "noopener"
    anchor.style.display = "none"
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function fetchBlob(url: string): Promise<Blob> {
  const response = await fetch(url, { mode: "cors", cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`)
  }
  return response.blob()
}

function inferExtensionFromUrl(url: string) {
  const lower = url.toLowerCase()
  if (lower.includes(".png")) return "png"
  if (lower.includes(".webp")) return "webp"
  return "jpg"
}

function getShotDownloadUrl(shot: CarouselShotRecord) {
  return shot.upscaledUrl ?? shot.url
}

function getShotFilename(shot: CarouselShotRecord) {
  const index = String(shot.index + 1).padStart(2, "0")
  const ext = inferExtensionFromUrl(getShotDownloadUrl(shot))
  return `carousel-shot-${index}.${ext}`
}

async function upscaleShot(
  shot: CarouselShotRecord,
  upscaleSettings: UpscaleSettings,
): Promise<{ upscaledUrl: string; generationId?: string }> {
  const payload = buildUpscaleRequestPayload(upscaleSettings)
  const response = await fetch("/api/upscale", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media: shot.url,
      modelIdentifier: payload.modelIdentifier,
      parameters: payload.parameters,
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      typeof data.message === "string"
        ? data.message
        : typeof data.error === "string"
          ? data.error
          : "Upscale failed"
    throw new Error(message)
  }

  if (typeof data.imageUrl !== "string" || data.imageUrl.length === 0) {
    throw new Error("Upscale returned no image URL")
  }

  return {
    upscaledUrl: data.imageUrl,
    generationId: typeof data.generationId === "string" ? data.generationId : undefined,
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await worker(items[currentIndex]!, currentIndex)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker())
  await Promise.all(workers)
  return results
}

type UseCarouselShotActionsOptions = {
  generationId: string | null
  shots: CarouselShotRecord[]
  onShotsChange: (shots: CarouselShotRecord[]) => void
  upscaleSettings: UpscaleSettings
}

export function useCarouselShotActions({
  generationId,
  shots,
  onShotsChange,
  upscaleSettings,
}: UseCarouselShotActionsOptions) {
  const [upscalingShotIds, setUpscalingShotIds] = React.useState<Set<string>>(new Set())
  const [batchProgress, setBatchProgress] = React.useState<string | null>(null)

  const shotsRef = React.useRef(shots)
  React.useEffect(() => {
    shotsRef.current = shots
  }, [shots])

  const persistChainRef = React.useRef<Promise<void>>(Promise.resolve())

  const persistShots = React.useCallback(
    async (nextShots: CarouselShotRecord[]) => {
      onShotsChange(nextShots)
      if (!generationId) return

      // Queue PATCH writes and always send the latest shotsRef so concurrent
      // upscales cannot clobber each other's HD URLs on the server.
      const run = async () => {
        const response = await fetch(`/api/carousel-shots/${generationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shots: shotsRef.current }),
        })
        if (!response.ok) {
          throw new Error("Failed to save upscaled shots")
        }
      }

      const next = persistChainRef.current.then(run, run)
      persistChainRef.current = next.then(
        () => undefined,
        () => undefined,
      )
      await next
    },
    [generationId, onShotsChange],
  )

  const applyShotUpdate = React.useCallback(
    async (shotId: string, patch: Partial<CarouselShotRecord>) => {
      const nextShots = shotsRef.current.map((item) =>
        item.id === shotId ? { ...item, ...patch } : item,
      )
      shotsRef.current = nextShots
      await persistShots(nextShots)
    },
    [persistShots],
  )

  const downloadShot = React.useCallback(async (shot: CarouselShotRecord) => {
    const blob = await fetchBlob(getShotDownloadUrl(shot))
    triggerBlobDownload(blob, getShotFilename(shot))
  }, [])

  const downloadShots = React.useCallback(async (selectedShots: CarouselShotRecord[]) => {
    const urls = selectedShots.map((shot) => getShotDownloadUrl(shot))
    await downloadReferenceImageSlides(urls, "carousel-shots")
  }, [])

  const handleUpscaleError = React.useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : "Upscale failed"
    if (isInsufficientCreditsError(error) || isInsufficientCreditsMessage(message)) {
      showCreditsUpsellToast({
        message,
        description: "Get more credits to continue upscaling",
        toastId: "carousel-shots-upscale-credits",
      })
    } else {
      toast.error(message)
    }
  }, [])

  const upscaleOne = React.useCallback(
    async (shot: CarouselShotRecord, options?: { silent?: boolean }) => {
      setUpscalingShotIds((current) => new Set(current).add(shot.id))
      try {
        const result = await upscaleShot(shot, upscaleSettings)
        await applyShotUpdate(shot.id, {
          upscaledUrl: result.upscaledUrl,
          upscaleGenerationId: result.generationId ?? shot.upscaleGenerationId ?? null,
          upscaleModel: upscaleSettings.modelIdentifier,
        })
        if (!options?.silent) {
          toast.success(`Shot ${shot.index + 1} upscaled`)
        }
        return result.upscaledUrl
      } catch (error) {
        if (!options?.silent) {
          handleUpscaleError(error)
        }
        throw error
      } finally {
        setUpscalingShotIds((current) => {
          const next = new Set(current)
          next.delete(shot.id)
          return next
        })
      }
    },
    [applyShotUpdate, handleUpscaleError, upscaleSettings],
  )

  const upscaleShots = React.useCallback(
    async (selectedShots: CarouselShotRecord[]) => {
      const pending = selectedShots.filter((shot) => !shot.upscaledUrl)
      if (pending.length === 0) {
        toast.success("All selected shots are already upscaled")
        return
      }

      let completed = 0
      let failed = 0
      setBatchProgress(`Upscaling 0 of ${pending.length}…`)

      try {
        await runWithConcurrency(pending, BATCH_UPSCALE_CONCURRENCY, async (shot) => {
          try {
            await upscaleOne(shot, { silent: true })
          } catch {
            failed += 1
          } finally {
            completed += 1
            setBatchProgress(`Upscaling ${completed} of ${pending.length}…`)
          }
        })

        const succeeded = pending.length - failed
        if (succeeded > 0) {
          toast.success(
            failed > 0
              ? `Upscaled ${succeeded} of ${pending.length} shots`
              : `Upscaled ${succeeded} shot${succeeded === 1 ? "" : "s"}`,
          )
        }
        if (failed > 0 && succeeded === 0) {
          toast.error("Upscale failed")
        }
      } finally {
        setBatchProgress(null)
      }
    },
    [upscaleOne],
  )

  const upscaleAndDownloadShot = React.useCallback(
    async (shot: CarouselShotRecord) => {
      const upscaledUrl = shot.upscaledUrl ?? (await upscaleOne(shot))
      const blob = await fetchBlob(upscaledUrl)
      triggerBlobDownload(blob, getShotFilename({ ...shot, upscaledUrl }))
    },
    [upscaleOne],
  )

  const upscaleAndDownloadShots = React.useCallback(
    async (selectedShots: CarouselShotRecord[]) => {
      const hdUrls: Array<string | null> = new Array(selectedShots.length).fill(null)
      let completed = 0
      let failed = 0
      setBatchProgress(`Upscaling 0 of ${selectedShots.length}…`)

      try {
        await runWithConcurrency(selectedShots, BATCH_UPSCALE_CONCURRENCY, async (shot, index) => {
          try {
            const url = shot.upscaledUrl ?? (await upscaleOne(shot, { silent: true }))
            hdUrls[index] = url
          } catch {
            failed += 1
          } finally {
            completed += 1
            setBatchProgress(`Upscaling ${completed} of ${selectedShots.length}…`)
          }
        })

        const readyUrls = hdUrls.filter((url): url is string => typeof url === "string")
        if (readyUrls.length > 0) {
          await downloadReferenceImageSlides(readyUrls, "carousel-shots-hd")
          toast.success(
            failed > 0
              ? `Downloaded ${readyUrls.length} of ${selectedShots.length} upscaled shots`
              : `Downloaded ${readyUrls.length} upscaled shot${readyUrls.length === 1 ? "" : "s"}`,
          )
        } else {
          toast.error("Upscale failed")
        }
      } finally {
        setBatchProgress(null)
      }
    },
    [upscaleOne],
  )

  return {
    batchProgress,
    downloadShot,
    downloadShots,
    isUpscalingShot: (shotId: string) => upscalingShotIds.has(shotId),
    upscaleAndDownloadShot,
    upscaleAndDownloadShots,
    upscaleOne,
    upscaleShots,
  }
}
