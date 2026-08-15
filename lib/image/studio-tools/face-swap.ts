import type { ImageStudioToolDefinition } from "./types"

export const FACE_SWAP_TOOL: ImageStudioToolDefinition = {
  id: "face_swap",
  uiModelIdentifier: "custom/face-swap",
  baseModelIdentifier: "google/nano-banana-2-lite",
  name: "Face Swap",
  description: "Transfer face, head, hair, and skin onto a target person or scene.",
  historyToolTag: "face_swap",
  canonicalPrompt:
    "Face and head transfer using two reference images. First image is the reference character (face, head, hair, and skin to transfer). " +
    "Second image is the reference person/scene (clothes, pose, body, and setting to keep). " +
    "Transfer the facial identity, head shape, hairstyle, hair, and skin tone from the first image onto the person in the second image. " +
    "From the first image preserve: face shape, head structure, eye structure, nose structure, bone structure, facial identity features, hairstyle, hair, and skin tone. " +
    "Do not copy facial expression, mouth shape, smile, frown, or emotion from the first image. " +
    "From the second image preserve: the exact facial expression, mouth shape, and emotion; clothing, outfit, and accessories; body proportions and pose; scene composition; camera angle; environment; and lighting. " +
    "The result must show the person from image two wearing their own clothes in their own pose and setting with their own expression, but with the face, head, hair, and skin from image one. " +
    "Adjust the transferred head and face to match the reference's lighting direction, color temperature, perspective, and scale. Blend seamlessly with no visible seams.",
  generation: {
    aspectRatio: "match_input_image",
    numImages: 1,
    enhancePrompt: false,
  },
  referenceSlots: [
    {
      key: "source",
      label: "Identity Source",
      description: "Upload the character face, head, hair, and skin to transfer",
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
