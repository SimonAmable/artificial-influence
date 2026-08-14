/** Custom tools whose prompt/model should not appear in the UI. */
const HIDDEN_DETAIL_TOOLS = new Set([
  "ai_influencer",
  "carousel_shots",
  "photodump",
  "character_swap",
  "face_swap",
  "outfit_swap",
  "pose_recreate",
  "shot_recreate",
  "remove-background",
])

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  ai_influencer: "AI Influencer",
  carousel_shots: "Carousel Shots",
  photodump: "Photodump",
  character_swap: "Character Swap",
  face_swap: "Face Swap",
  outfit_swap: "Outfit Swap",
  pose_recreate: "Pose Recreate",
  shot_recreate: "Shot Recreate",
  "remove-background": "Remove Background",
}

export function shouldHideGenerationDetails(tool: string | null | undefined): boolean {
  return typeof tool === "string" && HIDDEN_DETAIL_TOOLS.has(tool)
}

export function getGenerationToolDisplayName(
  tool: string | null | undefined,
): string | null {
  return typeof tool === "string" ? TOOL_DISPLAY_NAMES[tool] ?? null : null
}
