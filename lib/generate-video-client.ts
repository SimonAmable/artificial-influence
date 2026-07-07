import { waitForGenerationStatus } from "@/lib/generation-poll-manager"

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

    const pollResult = await waitForGenerationStatus<
      | { ok: true; result: { video: { url: string; mimeType?: string } } }
      | { ok: false; error: Error }
    >({
      predictionId,
      statusEndpoint: "/api/generate-video/status",
      timeoutMessage: "Video generation timed out",
      fetchErrorMessage: "Failed to fetch video generation status",
      mapCompleted: (statusData) => {
        if (statusData.status !== "completed") {
          return null
        }
        const video = statusData.video as { url?: string; mimeType?: string } | undefined
        if (!video?.url) {
          return null
        }
        return {
          ok: true,
          result: {
            video: {
              url: video.url,
              mimeType: video.mimeType,
            },
          },
        }
      },
      mapFailed: (statusData) => ({
        ok: false,
        error: new Error(
          typeof statusData.error === "string" ? statusData.error : "Video generation failed",
        ),
      }),
    })

    if (!pollResult.ok) {
      throw pollResult.error
    }

    return pollResult.result
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
