import type {
  CarouselGridSize,
  CarouselVariationStrength,
} from "@/lib/carousel-shots/types"

const VARIATION_INSTRUCTIONS: Record<CarouselVariationStrength, string> = {
  subtle:
    "Keep pose and camera changes minimal — micro-expressions, slight head tilt, and small framing shifts only.",
  natural:
    "Use believable alternate poses, expressions, and framing while staying in the same scene and setup.",
  creative:
    "Use more expressive poses and camera angles while strictly preserving identity, outfit, background, and lighting.",
}

export function buildCarouselShotsPrompt(options: {
  gridSize: CarouselGridSize
  variationStrength: CarouselVariationStrength
}): string {
  const cols = options.gridSize === 4 ? 2 : 3
  const rows = cols
  const panelCount = options.gridSize
  const variation = VARIATION_INSTRUCTIONS[options.variationStrength]

  return [
    "Create a single high-resolution contact sheet image using the provided reference photo.",
    `Layout: a rigid ${cols}×${rows} grid with exactly ${panelCount} equal panels separated by thin, uniform white gutters.`,
    "No borders, labels, numbers, text, watermarks, or UI chrome anywhere in the image.",
    "Preserve the same person identity, face, hairstyle, skin tone, outfit, accessories, background, environment, lighting, color grade, and photographic style across every panel.",
    "Only vary pose, facial expression, framing, and camera angle between panels.",
    variation,
    "Panels must be the same size with clean gutters. Reading order is left-to-right, top-to-bottom.",
    "Photorealistic, sharp, consistent series suitable for a social carousel.",
  ].join(" ")
}
