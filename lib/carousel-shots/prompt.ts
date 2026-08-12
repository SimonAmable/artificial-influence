import type {
  CarouselGridSize,
  CarouselVariationStrength,
} from "@/lib/carousel-shots/types"

const VARIATION_INSTRUCTIONS: Record<Exclude<CarouselVariationStrength, "custom">, string> = {
  subtle:
    "Keep pose and camera changes minimal — micro-expressions, slight head tilt, and small framing shifts only.",
  natural:
    "Use believable alternate poses, expressions, and framing while staying in the same scene and setup.",
  creative:
    "Use more expressive poses and camera angles while strictly preserving identity, outfit, background, and lighting.",
}

function resolveVariationInstruction(options: {
  variationStrength: CarouselVariationStrength
  customVariation?: string | null
}): string {
  if (options.variationStrength === "custom") {
    const custom = options.customVariation?.trim()
    return custom || "Vary pose, expression, framing, and camera angle in a believable way."
  }

  return VARIATION_INSTRUCTIONS[options.variationStrength]
}

function buildPerShotPanelInstructions(
  perShotVariations: string[] | null | undefined,
  panelCount: number,
): string | null {
  if (!perShotVariations || perShotVariations.length === 0) return null

  const instructions = Array.from({ length: panelCount }, (_, index) => {
    const custom = perShotVariations[index]?.trim()
    if (!custom) return null
    return `Panel ${index + 1}: ${custom}`
  }).filter((entry): entry is string => Boolean(entry))

  if (instructions.length === 0) return null
  return instructions.join(" ")
}

export function buildCarouselShotsPrompt(options: {
  gridSize: CarouselGridSize
  variationStrength: CarouselVariationStrength
  customVariation?: string | null
  perShotVariations?: string[] | null
}): string {
  const cols = options.gridSize === 4 ? 2 : 3
  const rows = cols
  const panelCount = options.gridSize
  const variation = resolveVariationInstruction(options)
  const perShot = buildPerShotPanelInstructions(options.perShotVariations, panelCount)

  return [
    "Create a single high-resolution contact sheet image using the provided reference photo.",
    `Layout: a rigid ${cols}×${rows} grid with exactly ${panelCount} equal panels separated by thin, uniform white gutters.`,
    "No borders, labels, numbers, text, watermarks, or UI chrome anywhere in the image.",
    "Preserve the same person identity, face, hairstyle, skin tone, outfit, accessories, background, environment, lighting, color grade, and photographic style across every panel.",
    "Only vary pose, facial expression, framing, and camera angle between panels.",
    variation,
    perShot,
    "Panels must be the same size with clean gutters. Reading order is left-to-right, top-to-bottom.",
    "Photorealistic, sharp, consistent series suitable for a social carousel.",
  ]
    .filter(Boolean)
    .join(" ")
}

export function buildCarouselHdShotPrompt(options: {
  shotIndex: number
  shotCount: number
  variationStrength: CarouselVariationStrength
  customVariation?: string | null
  perShotVariation?: string | null
}): string {
  const perShot = options.perShotVariation?.trim()
  const variation =
    perShot ||
    resolveVariationInstruction({
      variationStrength: options.variationStrength,
      customVariation: options.customVariation,
    })

  return [
    "Create a single high-resolution image using the provided reference photo.",
    `This is shot ${options.shotIndex + 1} of ${options.shotCount} in a social carousel series.`,
    "Preserve the same person identity, face, hairstyle, skin tone, outfit, accessories, background, environment, lighting, color grade, and photographic style.",
    "Only vary pose, facial expression, framing, and camera angle from the reference.",
    variation,
    "Photorealistic, sharp, and consistent with the rest of the carousel series.",
  ].join(" ")
}

