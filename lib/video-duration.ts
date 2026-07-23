export interface VideoDurationInput {
  modelIdentifier: string
  duration?: number | string | null
  characterOrientation?: string | null
  hasInputVideo?: boolean
  hasReferenceVideo?: boolean
  sourceDurationSeconds?: number | null
}

function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundDuration(value: number, min: number, max: number) {
  return clamp(Math.round(value), min, max)
}

function getDefaultDurationSeconds(modelIdentifier: string): number {
  switch (modelIdentifier) {
    case "minimax/hailuo-2.3-fast":
      return 6
    case "google/veo-3.1-fast":
      return 8
    case "kwaivgi/kling-v2.5-turbo-pro":
    case "kwaivgi/kling-v2.6":
    case "kwaivgi/kling-v3-video":
    case "kwaivgi/kling-v3-omni-video":
    case "bytedance/seedance-2.0":
    case "wan-video/wan-2.7":
    case "xai/grok-imagine-video":
    case "xai/grok-imagine-video-1.5":
    case "alibaba/happy-horse":
    case "alibaba/happy-horse/v1.1":
    case "google/gemini-omni-flash":
    case "veed/fabric-1.0":
    default:
      return 5
  }
}

export function resolvePredictedDurationSeconds(input: VideoDurationInput): number | null {
  const explicitDuration = toFiniteNumber(input.duration)
  const sourceDuration = toFiniteNumber(input.sourceDurationSeconds)

  switch (input.modelIdentifier) {
    case "bytedance/seedance-2.0":
      if (explicitDuration != null && explicitDuration > 0) {
        return roundDuration(explicitDuration, 1, 15)
      }
      if (sourceDuration != null && sourceDuration > 0 && input.hasReferenceVideo) {
        return roundDuration(sourceDuration, 1, 15)
      }
      return 5
    case "kwaivgi/kling-v2.6-motion-control":
    case "kwaivgi/kling-v3-motion-control": {
      const maxDuration = input.characterOrientation === "video" ? 30 : 10
      if (sourceDuration != null && sourceDuration > 0) {
        return roundDuration(sourceDuration, 1, maxDuration)
      }
      return Math.min(5, maxDuration)
    }
    case "veed/fabric-1.0":
      if (sourceDuration != null && sourceDuration > 0) {
        return roundDuration(sourceDuration, 1, 60)
      }
      return 5
    case "xai/grok-imagine-video":
      if (input.hasInputVideo && sourceDuration != null && sourceDuration > 0) {
        return roundDuration(sourceDuration, 1, 15)
      }
      if (explicitDuration != null && explicitDuration > 0) {
        return roundDuration(explicitDuration, 1, 15)
      }
      return 5
    case "xai/grok-imagine-video-1.5":
      if (explicitDuration != null && explicitDuration > 0) {
        return roundDuration(explicitDuration, 1, 15)
      }
      return 5
    case "kwaivgi/kling-v3-omni-video":
      if (input.hasReferenceVideo && sourceDuration != null && sourceDuration > 0) {
        return roundDuration(sourceDuration, 3, 15)
      }
      if (explicitDuration != null && explicitDuration > 0) {
        return roundDuration(explicitDuration, 3, 15)
      }
      return 5
    case "minimax/hailuo-2.3-fast":
      if (explicitDuration != null && explicitDuration > 0) {
        return roundDuration(explicitDuration, 5, 10)
      }
      return 6
    case "google/veo-3.1-fast":
      if (explicitDuration != null && explicitDuration > 0) {
        return roundDuration(explicitDuration, 2, 10)
      }
      return 8
    case "kwaivgi/kling-v2.5-turbo-pro":
    case "kwaivgi/kling-v2.6":
      if (explicitDuration != null && explicitDuration > 0) {
        return roundDuration(explicitDuration, 5, 10)
      }
      return 5
    case "kwaivgi/kling-v3-video":
      if (explicitDuration != null && explicitDuration > 0) {
        return roundDuration(explicitDuration, 3, 15)
      }
      return 5
    case "wan-video/wan-2.7":
      if (explicitDuration != null && explicitDuration > 0) {
        return roundDuration(explicitDuration, 2, 15)
      }
      return 5
    case "prunaai/p-video":
      if (sourceDuration != null && sourceDuration > 0) {
        return roundDuration(sourceDuration, 1, 10)
      }
      if (explicitDuration != null && explicitDuration > 0) {
        return roundDuration(explicitDuration, 1, 10)
      }
      return 5
    case "alibaba/happy-horse":
    case "alibaba/happy-horse/v1.1":
      if (explicitDuration != null && explicitDuration > 0) {
        return roundDuration(explicitDuration, 3, 15)
      }
      return 5
    case "google/gemini-omni-flash":
      if (explicitDuration != null && explicitDuration > 0) {
        return roundDuration(explicitDuration, 3, 10)
      }
      return 8
    default:
      if (explicitDuration != null && explicitDuration > 0) {
        return Math.max(1, Math.round(explicitDuration))
      }
      return getDefaultDurationSeconds(input.modelIdentifier)
  }
}
