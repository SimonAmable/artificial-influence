import { getModelMetadataByIdentifier } from "@/lib/constants/model-metadata"
import { CHARACTER_SWAP_TOOL } from "@/lib/image/studio-tools/character-swap"
import { estimateStudioToolCredits } from "@/lib/image/studio-tools/estimate-credits"
import { FACE_SWAP_TOOL } from "@/lib/image/studio-tools/face-swap"
import type { MotionCopyActiveSwapMode } from "@/lib/motion-copy/swap-mode"

/** Client-side quote for the swap still used before Motion Copy. */
export function estimateMotionSwapCredits(mode: MotionCopyActiveSwapMode): number {
  const tool = mode === "face_swap" ? FACE_SWAP_TOOL : CHARACTER_SWAP_TOOL
  const meta = getModelMetadataByIdentifier(tool.baseModelIdentifier)
  return estimateStudioToolCredits({
    baseModelIdentifier: tool.baseModelIdentifier,
    model_cost: meta?.model_cost ?? 4,
    outputCount: tool.generation.numImages ?? 1,
  })
}

/** @deprecated Use estimateMotionSwapCredits */
export function estimateCharacterSwapCredits(): number {
  return estimateMotionSwapCredits("character_swap")
}
