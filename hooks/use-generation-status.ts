"use client"

import * as React from "react"
import {
  subscribeGenerationStatus,
  type GenerationPollStatus,
} from "@/lib/generation-poll-manager"

export type { GenerationPollStatus }

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

export function useGenerationStatus<T>({
  enabled,
  predictionId,
  statusEndpoint,
  mapCompleted,
  mapFailed,
  timeoutMessage,
  fetchErrorMessage,
}: UseGenerationStatusOptions<T>) {
  const [polledState, setPolledState] = React.useState<T | null>(null)

  React.useEffect(() => {
    if (!enabled || !predictionId) {
      return
    }

    return subscribeGenerationStatus(
      {
        predictionId,
        statusEndpoint,
        mapCompleted,
        mapFailed,
        timeoutMessage,
        fetchErrorMessage,
      },
      setPolledState,
    )
  }, [
    enabled,
    predictionId,
    statusEndpoint,
    mapCompleted,
    mapFailed,
    timeoutMessage,
    fetchErrorMessage,
  ])

  return polledState
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
    mapFailed: mapImageFailed,
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
    mapFailed: mapVideoFailed,
    timeoutMessage: "Video generation timed out while waiting for completion.",
    fetchErrorMessage: "Failed to fetch video status.",
  })
}
