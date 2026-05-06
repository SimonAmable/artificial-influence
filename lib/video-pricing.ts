export interface VideoPricingQuoteInput {
  modelIdentifier: string
  modelCost?: number | null
  modelCostPerSecond?: number | null
  duration?: number | string | null
  resolution?: string | null
  draft?: boolean | null
  mode?: string | null
  generateAudio?: boolean | null
  characterOrientation?: string | null
  hasInputVideo?: boolean
  hasReferenceVideo?: boolean
  sourceDurationSeconds?: number | null
}

export interface VideoPricingQuote {
  creditsPerSecond: number | null
  predictedDurationSeconds: number | null
  quotedCredits: number
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
    case "alibaba/happy-horse":
    case "veed/fabric-1.0":
    default:
      return 5
  }
}

function resolveCreditsPerSecond(input: VideoPricingQuoteInput): number | null {
  const modelIdentifier = input.modelIdentifier
  const base = toFiniteNumber(input.modelCostPerSecond)
  const generateAudio = input.generateAudio !== false
  const resolution = input.resolution ?? null
  const draft = input.draft === true
  const mode = input.mode ?? null

  switch (modelIdentifier) {
    case "google/veo-3.1-fast":
      return generateAudio ? 6 : 4
    case "kwaivgi/kling-v2.6":
      return generateAudio ? 6 : 3
    case "kwaivgi/kling-v2.6-motion-control":
      return mode === "std" ? 3 : 5
    case "kwaivgi/kling-v3-motion-control":
      return mode === "std" ? 6 : 7
    case "kwaivgi/kling-v3-video":
    case "kwaivgi/kling-v3-omni-video": {
      const isStandard = mode === "standard"
      if (isStandard && generateAudio) return 11
      if (isStandard && !generateAudio) return 7
      if (!isStandard && generateAudio) return 14
      return 10
    }
    case "alibaba/happy-horse":
      return resolution === "720p" ? 6 : 12
    case "veed/fabric-1.0":
      return resolution === "480p" ? 4 : 6
    case "xai/grok-imagine-video":
      return resolution === "480p" ? 2 : 3
    case "minimax/hailuo-2.3-fast":
      return resolution === "1080p" ? 2.2 : 1.2
    case "prunaai/p-video":
      if (resolution === "1080p") {
        return draft ? 1 : 4
      }
      return draft ? 0.5 : 2
    default:
      return base && base > 0 ? base : null
  }
}

function resolvePredictedDurationSeconds(input: VideoPricingQuoteInput): number | null {
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
      if (explicitDuration != null && explicitDuration > 0) {
        return roundDuration(explicitDuration, 3, 15)
      }
      return 5
    default:
      if (explicitDuration != null && explicitDuration > 0) {
        return Math.max(1, Math.round(explicitDuration))
      }
      return getDefaultDurationSeconds(input.modelIdentifier)
  }
}

export function resolveVideoPricingQuote(input: VideoPricingQuoteInput): VideoPricingQuote {
  const creditsPerSecond = resolveCreditsPerSecond(input)
  const predictedDurationSeconds = resolvePredictedDurationSeconds(input)

  if (creditsPerSecond != null && creditsPerSecond > 0 && predictedDurationSeconds != null && predictedDurationSeconds > 0) {
    return {
      creditsPerSecond,
      predictedDurationSeconds,
      quotedCredits: Math.max(1, Math.ceil(creditsPerSecond * predictedDurationSeconds)),
    }
  }

  const legacyFlatCost = toFiniteNumber(input.modelCost)
  return {
    creditsPerSecond: null,
    predictedDurationSeconds,
    quotedCredits: Math.max(1, Math.ceil(legacyFlatCost ?? 10)),
  }
}
