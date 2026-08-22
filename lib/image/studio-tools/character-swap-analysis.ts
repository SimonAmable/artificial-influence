import { z } from "zod"

export const characterSwapVisionHintsSchema = z.object({
  character_preservation: z
    .string()
    .describe("Brief notes on outfit, hair, colors, and accessories to preserve from the character reference."),
  scene_pose: z
    .string()
    .describe("Brief notes on pose, limbs, expression, setting, camera, and lighting to preserve from the scene reference."),
  integration_hint: z
    .string()
    .describe("One short sentence on the hardest blending or matching detail for this swap."),
})

export type CharacterSwapVisionHints = z.infer<typeof characterSwapVisionHintsSchema>

export const CHARACTER_SWAP_ANALYSIS_MODEL = "google/gemini-2.5-flash" as const

export const CHARACTER_SWAP_ANALYSIS_INSTRUCTIONS = [
  "You are helping an image model perform a character swap using two reference images.",
  "Image 1 is the reference CHARACTER (identity, outfit, hair, and accessories to preserve).",
  "Image 2 is the reference SCENE/POSE (body pose, expression, environment, camera, and lighting to preserve).",
  "Write concise, concrete visual notes — not a full prompt. Each field should be 1-3 short sentences max.",
  "Do NOT identify the person, estimate age/ethnicity, or describe unique biometric identity.",
  "Ignore watermarks, usernames, and social-platform UI overlays unless they are physically part of the real scene.",
  "Focus on actionable details that help the generator place the character naturally into the scene pose.",
].join(" ")

export function appendCharacterSwapVisionHints(
  canonicalPrompt: string,
  hints: CharacterSwapVisionHints,
): string {
  const parts = [
    canonicalPrompt.trim(),
    "Vision-guided swap hints:",
    `Preserve from character reference: ${hints.character_preservation.trim()}`,
    `Preserve from scene/pose reference: ${hints.scene_pose.trim()}`,
    `Integration focus: ${hints.integration_hint.trim()}`,
  ]

  return parts.filter((part) => part.length > 0).join(" ")
}
