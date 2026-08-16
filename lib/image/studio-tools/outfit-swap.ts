import type { ImageStudioToolDefinition } from "./types"

export const OUTFIT_SWAP_TOOL: ImageStudioToolDefinition = {
  id: "outfit_swap",
  uiModelIdentifier: "custom/outfit-swap",
  baseModelIdentifier: "openai/gpt-image-2",
  name: "Outfit Swap",
  description: "Dress your character in an outfit from a reference image.",
  historyToolTag: "outfit_swap",
  canonicalPrompt:
    "Outfit transfer using two reference images. The first image is the character to preserve. " +
    "The second image is the outfit reference. Dress the character from the first image in the complete outfit shown in the second image. " +
    "Preserve the first image's exact facial identity, hairstyle, body proportions, skin tone, pose, expression, background, composition, camera angle, and lighting. " +
    "Transfer only the clothing: garment types, colors, patterns, materials, fit, layering, construction details, and clothing accessories. " +
    "Fit the garments naturally to the character's body and pose with realistic folds, seams, texture, shadows, and occlusion. " +
    "Do not copy the second image's person, face, body, pose, background, or camera framing.",
  generation: {
    aspectRatio: "match_input_image",
    numImages: 1,
    enhancePrompt: false,
  },
  referenceSlots: [
    {
      key: "source",
      label: "Character Image",
      description: "Upload the character who will wear the outfit",
    },
    {
      key: "scene",
      label: "Outfit Reference",
      description: "Upload the outfit you want to recreate",
    },
  ],
  inputKind: "dual-reference-swap",
  icon: "product",
}
