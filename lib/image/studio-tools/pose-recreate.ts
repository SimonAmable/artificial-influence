import type { ImageStudioToolDefinition } from "./types"

export const POSE_RECREATE_TOOL: ImageStudioToolDefinition = {
  id: "pose_recreate",
  uiModelIdentifier: "custom/pose-recreate",
  baseModelIdentifier: "google/nano-banana-2-lite",
  name: "Pose Recreate",
  description: "Recreate a reference pose with your character.",
  historyToolTag: "pose_recreate",
  canonicalPrompt:
    "Pose recreation using two reference images. The first image is the character to preserve. " +
    "The second image is the pose reference. Repose the character from the first image to precisely match the second image's body position, limb placement, hand positioning, head direction, weight distribution, gesture, and stance. " +
    "Preserve the first image's facial identity, hairstyle, skin tone, body appearance and proportions, clothing, outfit details, and accessories. " +
    "Do not transfer the second image's identity, face, hair, body appearance, clothing, or background. " +
    "Compose the result naturally around the recreated pose with anatomically correct hands and limbs, believable balance, consistent perspective, and realistic lighting.",
  generation: {
    aspectRatio: "match_input_image",
    numImages: 1,
    enhancePrompt: false,
  },
  referenceSlots: [
    {
      key: "source",
      label: "Character Image",
      description: "Upload the character you want to preserve",
    },
    {
      key: "scene",
      label: "Pose Reference",
      description: "Upload the pose you want to recreate",
    },
  ],
  inputKind: "dual-reference-swap",
  icon: "product",
}
