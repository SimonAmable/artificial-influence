const POLL_INTERVAL_MS = 5000
const POLL_MAX_ATTEMPTS = 180

export interface GenerateVideoAcceptedPayload {
  generationId?: string
  predictionId: string
}

interface GenerateVideoCallbacks {
  onAccepted?: (payload: GenerateVideoAcceptedPayload) => void
  onProgress?: (message: string) => void
}

function normalizeCallbacks(
  optionsOrProgress?: GenerateVideoCallbacks | ((message: string) => void),
  onAccepted?: (payload: GenerateVideoAcceptedPayload) => void,
): GenerateVideoCallbacks {
  if (typeof optionsOrProgress === "function") {
    return {
      onAccepted,
      onProgress: optionsOrProgress,
    }
  }

  return {
    onAccepted: optionsOrProgress?.onAccepted ?? onAccepted,
    onProgress: optionsOrProgress?.onProgress,
  }
}

export async function generateVideoAndWait(
  endpoint: string,
  payload: Record<string, unknown>,
  optionsOrProgress?: GenerateVideoCallbacks | ((message: string) => void),
  onAccepted?: (payload: GenerateVideoAcceptedPayload) => void,
) {
  const { onAccepted: acceptedCallback, onProgress } = normalizeCallbacks(optionsOrProgress, onAccepted)
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || error.message || "Video generation failed")
  }

  const data = await response.json()

  if (response.status === 202) {
    const predictionId = data.predictionId as string
    const generationId =
      typeof data.generationId === "string" && data.generationId.length > 0
        ? data.generationId
        : undefined

    if (!predictionId) {
      throw new Error("No predictionId in async response")
    }

    acceptedCallback?.({ generationId, predictionId })
    onProgress?.("Video generation started, waiting for result...")

    for (let index = 0; index < POLL_MAX_ATTEMPTS; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))

      const statusResponse = await fetch(
        `/api/generate-video/status?predictionId=${encodeURIComponent(predictionId)}`,
      )
      if (!statusResponse.ok) {
        throw new Error("Failed to fetch video generation status")
      }

      const statusData = await statusResponse.json()
      if (statusData.status === "completed") {
        if (statusData.video?.url) {
          return {
            video: {
              url: statusData.video.url as string,
              mimeType: statusData.video.mimeType as string | undefined,
            },
          }
        }

        throw new Error("Video generation completed but no video URL was returned")
      }

      if (statusData.status === "failed") {
        throw new Error(statusData.error || "Video generation failed")
      }

      onProgress?.(`Waiting for video result... (${index + 1})`)
    }

    throw new Error("Video generation timed out")
  }

  if (data.video?.url) {
    return {
      video: {
        url: data.video.url as string,
        mimeType: data.video.mimeType as string | undefined,
      },
    }
  }

  if (typeof data.videoUrl === "string") {
    return {
      video: {
        url: data.videoUrl,
        mimeType: undefined,
      },
    }
  }

  throw new Error("No video URL returned from API")
}
