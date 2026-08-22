export const GROK_IMAGE_2_IDENTIFIER = "xai/grok-imagine-image-2.0" as const

export type GrokImage2Quality = "low" | "medium"
export type GrokImage2Resolution = "1k" | "2k"

export function isGrokImage2Identifier(identifier: string | null | undefined): boolean {
  return identifier === GROK_IMAGE_2_IDENTIFIER
}

export function normalizeGrokImage2Quality(
  value: string | null | undefined,
): GrokImage2Quality {
  const normalized = value?.trim().toLowerCase()
  if (normalized === "medium" || normalized === "high" || normalized === "on") {
    return "medium"
  }
  return "low"
}

export function normalizeGrokImage2Resolution(
  value: string | null | undefined,
): GrokImage2Resolution {
  return value?.trim().toLowerCase() === "2k" ? "2k" : "1k"
}

export function formatGrokImage2ThinkingLabel(option: string): string {
  return normalizeGrokImage2Quality(option) === "medium" ? "On" : "Off"
}

export function formatGrokImage2QualityLabel(option: string): string {
  return normalizeGrokImage2Resolution(option).toUpperCase()
}

export function resolveXaiImageQuality(
  modelIdentifier: string | null | undefined,
  value: string | null | undefined,
): "low" | "medium" | "high" | null {
  if (isGrokImage2Identifier(modelIdentifier)) {
    return normalizeGrokImage2Quality(value)
  }

  const normalized = value?.trim().toLowerCase()
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized
  }

  return null
}
