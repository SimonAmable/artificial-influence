import { parseModelParameters, type Model } from "@/lib/types/models"

export function isAutoAspectRatio(value?: string | null): boolean {
  return value === "auto" || value === "match_input_image"
}

export function getSupportedAspectRatios(model?: Model | null): string[] {
  if (!model) return []

  if (Array.isArray(model.aspect_ratios) && model.aspect_ratios.length > 0) {
    return model.aspect_ratios
  }

  const parameters = parseModelParameters(model.parameters)
  const aspectRatioParam = parameters.find(
    (param) =>
      (param.name === "aspect_ratio" || param.name === "aspectRatio") &&
      param.type === "string" &&
      Array.isArray(param.enum)
  )

  return aspectRatioParam?.type === "string" && Array.isArray(aspectRatioParam.enum)
    ? aspectRatioParam.enum
    : []
}

export function getPreferredAutoAspectRatio(model?: Model | null): string | null {
  const supportedAspectRatios = getSupportedAspectRatios(model)

  if (supportedAspectRatios.includes("auto")) return "auto"
  if (supportedAspectRatios.includes("match_input_image")) return "match_input_image"

  return null
}

export function getDefaultAspectRatioForModel(
  model?: Model | null,
  fallback = "1:1"
): string {
  const preferredAutoAspectRatio = getPreferredAutoAspectRatio(model)
  if (preferredAutoAspectRatio) return preferredAutoAspectRatio

  if (model?.default_aspect_ratio) return model.default_aspect_ratio

  return getSupportedAspectRatios(model)[0] ?? fallback
}

export function getConcreteAspectRatioForModel(
  model?: Model | null,
  fallback = "1:1"
): string {
  if (model?.default_aspect_ratio && !isAutoAspectRatio(model.default_aspect_ratio)) {
    return model.default_aspect_ratio
  }

  const firstConcreteAspectRatio = getSupportedAspectRatios(model).find(
    (aspectRatio) => !isAutoAspectRatio(aspectRatio)
  )

  return firstConcreteAspectRatio ?? fallback
}

export function resolveAspectRatioForRequest({
  model,
  selectedAspectRatio,
  hasReferenceImages,
  fallback = "1:1",
}: {
  model?: Model | null
  selectedAspectRatio?: string | null
  hasReferenceImages: boolean
  fallback?: string
}): string {
  const requestedAspectRatio =
    selectedAspectRatio && selectedAspectRatio.trim().length > 0
      ? selectedAspectRatio
      : getDefaultAspectRatioForModel(model, fallback)

  if (isAutoAspectRatio(requestedAspectRatio) && !hasReferenceImages) {
    return getConcreteAspectRatioForModel(model, fallback)
  }

  return requestedAspectRatio
}
