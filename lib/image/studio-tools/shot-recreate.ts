import type { ImageStudioToolDefinition } from "./types"

export const SHOT_RECREATE_TOOL: ImageStudioToolDefinition = {
  id: "shot_recreate",
  uiModelIdentifier: "custom/shot-recreate",
  baseModelIdentifier: "openai/gpt-image-2",
  name: "Shot Recreate",
  description: "Recreate a reference shot with your character.",
  historyToolTag: "shot_recreate",
  canonicalPrompt:
    "Shot recreation using one character reference image and a structured JSON-derived shot analysis. " +
    "The attached image is the character whose identity and defining appearance must be preserved. " +
    "Use the supplied shot analysis to recreate every described detail of the shot with photographic accuracy, especially location. " +
    "Follow location_spatial_layout_from_camera exactly: preserve the same image-left/image-right placement, depth ordering, architecture, surfaces, fixed objects, signage, and environmental layout. Do not mirror, flip, reverse, or genericize the scene into a broad stock interpretation. " +
    "Recreate activity, pose, hands, gaze, expression, wardrobe, accessories, props, readable text, logos, recognizable brand or venue names, composition, camera language, lighting, color grade, and aesthetic. " +
    "Do not infer or copy any identity or unique physical features from the analyzed target shot. " +
    "Do not reproduce watermarks, username handles, or social-platform screen overlays. " +
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
