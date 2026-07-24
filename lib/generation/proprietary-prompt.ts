/** Custom tools whose prompt/model should not appear in the UI. */
const HIDDEN_DETAIL_TOOLS = new Set([
  "ai_influencer",
  "carousel_shots",
  "character_swap",
  "face_swap",
  "remove-background",
])

export function shouldHideGenerationDetails(tool: string | null | undefined): boolean {
  return typeof tool === "string" && HIDDEN_DETAIL_TOOLS.has(tool)
}
