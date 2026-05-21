"use client"

import * as React from "react"

export type GenerationPollStatus = "pending" | "completed" | "failed"

export type ImageGenerationPollResult = {
  error?: string
  generationId?: string
  images?: Array<{
    mimeType?: string
    url: string
  }>
  status: GenerationPollStatus
}

export type VideoGenerationPollResult = {
  error?: string
  generationId?: string
  status: GenerationPollStatus
  video?: {
    mimeType?: string
    url: string
  }
}

type UseGenerationStatusOptions<T> = {
  enabled: boolean
  predictionId?: string | null
  statusEndpoint: string
  mapCompleted: (data: Record<string, unknown>) => T | null
  mapFailed: (data: Record<string, unknown>) => T
  timeoutMessage: string
  fetchErrorMessage: string
  maxAttempts?: number
  intervalMs?: number
}

const DEFAULT_MAX_ATTEMPTS = 180
const DEFAULT_INTERVAL_MS = 5000

async function pollPredictionStatus<T>({
  predictionId,
  statusEndpoint,
  mapCompleted,
  mapFailed,
  timeoutMessage,
  fetchErrorMessage,
  maxAttempts,
  intervalMs,
  isCancelled,
}: {
  predictionId: string
  statusEndpoint: string
  mapCompleted: (data: Record<string, unknown>) => T | null
  mapFailed: (data: Record<string, unknown>) => T
  timeoutMessage: string
  fetchErrorMessage: string
  maxAttempts: number
  intervalMs: number
  isCancelled: () => boolean
}): Promise<T | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(
        `${statusEndpoint}?predictionId=${encodeURIComponent(predictionId)}`,
        { cache: "no-store" },
      )

      if (!response.ok) {
        if (isCancelled()) return null
        if (response.status === 401 || response.status === 403 || response.status >= 500) {
          return mapFailed({ error: fetchErrorMessage })
        }
        if (response.status === 404) {
          await new Promise((resolve) => setTimeout(resolve, intervalMs))
          continue
        }
        return null
      }

      const data = (await response.json()) as Record<string, unknown>
      if (isCancelled()) return null

      if (data.status === "completed") {
        return mapCompleted(data)
      }

      if (data.status === "failed") {
        return mapFailed(data)
      }
    } catch {
      if (!isCancelled()) {
        return mapFailed({ error: fetchErrorMessage })
      }
      return null
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
    if (isCancelled()) return null
  }

  if (!isCancelled()) {
    return mapFailed({ error: timeoutMessage })
  }

  return null
}

export function useGenerationStatus<T>({
  enabled,
  predictionId,
  statusEndpoint,
  mapCompleted,
  mapFailed,
  timeoutMessage,
  fetchErrorMessage,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  intervalMs = DEFAULT_INTERVAL_MS,
}: UseGenerationStatusOptions<T>) {
  const [polledState, setPolledState] = React.useState<T | null>(null)

  React.useEffect(() => {
    if (!enabled || !predictionId) {
      return
    }

    let cancelled = false
    const isCancelled = () => cancelled

    void pollPredictionStatus({
      predictionId,
      statusEndpoint,
      mapCompleted,
      mapFailed,
      timeoutMessage,
      fetchErrorMessage,
      maxAttempts,
      intervalMs,
      isCancelled,
    }).then((result) => {
      if (!cancelled && result) {
        setPolledState(result)
      }
    })

    return () => {
      cancelled = true
    }
  }, [
    enabled,
    predictionId,
    statusEndpoint,
    mapCompleted,
    mapFailed,
    timeoutMessage,
    fetchErrorMessage,
    maxAttempts,
    intervalMs,
  ])

  return polledState
}

function mapImageCompleted(data: Record<string, unknown>): ImageGenerationPollResult | null {
  const images = Array.isArray(data.images)
    ? (data.images as ImageGenerationPollResult["images"])
    : data.image &&
        typeof data.image === "object" &&
        data.image !== null &&
        "url" in data.image
      ? [data.image as { mimeType?: string; url: string }]
      : []

  if (!images || images.length === 0) {
    return {
      error: "Image generation completed without any returned images.",
      generationId: typeof data.generationId === "string" ? data.generationId : undefined,
      status: "failed",
    }
  }

  return {
    generationId: typeof data.generationId === "string" ? data.generationId : undefined,
    images,
    status: "completed",
  }
}

function mapImageFailed(data: Record<string, unknown>): ImageGenerationPollResult {
  return {
    error: typeof data.error === "string" ? data.error : "Image generation failed.",
    generationId: typeof data.generationId === "string" ? data.generationId : undefined,
    status: "failed",
  }
}

function mapVideoCompleted(data: Record<string, unknown>): VideoGenerationPollResult | null {
  const video = data.video as VideoGenerationPollResult["video"] | undefined
  if (!video?.url) {
    return {
      error: "Video generation completed without a returned file.",
      generationId: typeof data.generationId === "string" ? data.generationId : undefined,
      status: "failed",
    }
  }

  return {
    generationId: typeof data.generationId === "string" ? data.generationId : undefined,
    status: "completed",
    video,
  }
}

function mapVideoFailed(data: Record<string, unknown>): VideoGenerationPollResult {
  return {
    error:
      typeof data.error === "string" ? data.error : "Video generation failed.",
    generationId: typeof data.generationId === "string" ? data.generationId : undefined,
    status: "failed",
  }
}

export function useImageGenerationPoll(
  predictionId: string | undefined,
  enabled: boolean,
) {
  return useGenerationStatus<ImageGenerationPollResult>({
    enabled,
    predictionId,
    statusEndpoint: "/api/generate-image/status",
    mapCompleted: mapImageCompleted,
    mapFailed: (data) =>
      mapImageFailed({
        error: typeof data.error === "string" ? data.error : "Image generation failed.",
        generationId: data.generationId,
      }),
    timeoutMessage: "Image generation timed out while waiting for completion.",
    fetchErrorMessage: "Failed to fetch image status.",
  })
}

export function useVideoGenerationPoll(
  predictionId: string | undefined,
  enabled: boolean,
) {
  return useGenerationStatus<VideoGenerationPollResult>({
    enabled,
    predictionId,
    statusEndpoint: "/api/generate-video/status",
    mapCompleted: mapVideoCompleted,
    mapFailed: (data) =>
      mapVideoFailed({
        error: typeof data.error === "string" ? data.error : "Video generation failed.",
        generationId: data.generationId,
      }),
    timeoutMessage: "Video generation timed out while waiting for completion.",
    fetchErrorMessage: "Failed to fetch video status.",
  })
}
