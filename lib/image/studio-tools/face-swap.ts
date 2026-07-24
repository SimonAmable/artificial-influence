import type { ImageStudioToolDefinition } from "./types"

export const FACE_SWAP_TOOL: ImageStudioToolDefinition = {
  id: "face_swap",
  uiModelIdentifier: "custom/face-swap",
  baseModelIdentifier: "google/nano-banana-pro",
  name: "Face Swap",
  description: "Transfer facial identity onto a target person or scene.",
  historyToolTag: "face_swap",
  canonicalPrompt:
    "Identity-only face transfer using two reference images. First image is the identity source (face to transfer). " +
    "Second image is the reference person/scene (clothes, pose, body, and setting to keep). " +
    "Transfer ONLY the facial identity from the first image onto the person in the second image. " +
    "From the first image preserve ONLY: face shape, eyes, nose, mouth, bone structure, and facial features; nothing else. " +
    "From the second image preserve: the exact clothing, outfit, and accessories; body proportions and pose; hairstyle and hair; skin tone; scene composition; camera angle; environment; and lighting. " +
    "The result must show the person from image two wearing their own clothes in their own pose and setting, but with the face from image one. " +
    "Adjust the transferred face to match the reference's lighting direction, color temperature, perspective, and scale. Blend seamlessly with no visible seams.",
  generation: {
    aspectRatio: "match_input_image",
    numImages: 1,
    enhancePrompt: false,
  },
  referenceSlots: [
    {
      key: "source",
      label: "Identity Source",
      description: "Upload the face to transfer",
    },
    {
      key: "scene",
      label: "Target Person / Scene",
      description: "Upload the person, pose, and setting to keep",
    },
  ],
  inputKind: "dual-reference-swap",
  icon: "product",
}
