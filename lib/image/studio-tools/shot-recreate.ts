import type { ImageStudioToolDefinition } from "./types"

export const SHOT_RECREATE_TOOL: ImageStudioToolDefinition = {
  id: "shot_recreate",
  uiModelIdentifier: "custom/shot-recreate",
  baseModelIdentifier: "google/nano-banana-2-lite",
  name: "Shot Recreate",
  description: "Recreate a reference shot with your character.",
  historyToolTag: "shot_recreate",
  canonicalPrompt:
    "Shot recreation using one character reference image and a structured JSON-derived shot analysis. " +
    "The attached image is the character whose identity and defining appearance must be preserved. " +
    "Use the supplied shot analysis to recreate its scene, activity, pose, expression, composition, camera language, lighting, wardrobe, and aesthetic. " +
    "Do not infer or copy any identity or unique physical features from the analyzed target shot. " +
    "Preserve the character's recognizable face, hairstyle, skin tone, body proportions, and defining features. " +
    "Rebuild the shot naturally with correct perspective, scale, contact shadows, reflections, occlusion, and social-media-ready realism.",
  generation: {
    aspectRatio: "match_input_image",
    numImages: 1,
    enhancePrompt: false,
  },
  referenceSlots: [
    {
      key: "source",
      label: "Character Image",
      description: "Upload the character to place in the shot",
    },
    {
      key: "scene",
      label: "Reference Shot",
      description: "Upload the shot you want to recreate",
    },
  ],
  inputKind: "dual-reference-swap",
  requiresReferenceAnalysis: true,
  includeSceneReferenceInGeneration: false,
  icon: "product",
}
