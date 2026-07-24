import type { ImageStudioToolDefinition } from "./types"

export const CHARACTER_SWAP_TOOL: ImageStudioToolDefinition = {
  id: "character_swap",
  uiModelIdentifier: "custom/character-swap",
  baseModelIdentifier: "google/nano-banana-pro",
  name: "Character Swap",
  description: "Swap a character into a scene using two references.",
  historyToolTag: "character_swap",
  canonicalPrompt:
    "Character swap task using two reference images. First image is the reference character. " +
    "Second image is the reference scene and pose. Place the character from the first image into the scene from the second image. " +
    "Preserve the character's facial identity, hairstyle, body shape, skin tone, clothing, outfit, and accessories from the first image. " +
    "Strictly preserve the exact pose, body positioning, limb placement, gesture, and overall stance from the second image. " +
    "Preserve scene composition, camera angle, environment layout, and lighting mood from the second image. " +
    "Blend naturally with correct perspective, realistic scale, contact shadows, reflections, and occlusion.",
  generation: {
    aspectRatio: "match_input_image",
    numImages: 1,
    enhancePrompt: false,
  },
  referenceSlots: [
    {
      key: "source",
      label: "Reference Character",
      description: "Upload character, outfit, and identity image",
    },
    {
      key: "scene",
      label: "Reference Scene / Pose",
      description: "Upload scene, framing, and pose image",
    },
  ],
  inputKind: "dual-reference-swap",
  icon: "product",
}
