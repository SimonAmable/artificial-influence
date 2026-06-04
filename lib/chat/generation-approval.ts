export type GenerationApprovalMode = "auto" | "ask"

export const DEFAULT_GENERATION_APPROVAL_MODE: GenerationApprovalMode = "ask"

export function normalizeGenerationApprovalMode(value: unknown): GenerationApprovalMode {
  return value === "auto" || value === "ask" ? value : DEFAULT_GENERATION_APPROVAL_MODE
}
