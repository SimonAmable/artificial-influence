const REPLICATE_IMAGE_DISABLE_SAFETY_CHECKER_MODELS = new Set([
  "black-forest-labs/flux-2-dev",
  "qwen/qwen-image-edit-plus-lora",
])

export function applyMinimalReplicateImageModeration(
  modelIdentifier: string,
  input: Record<string, unknown>,
): Record<string, unknown> {
  if (REPLICATE_IMAGE_DISABLE_SAFETY_CHECKER_MODELS.has(modelIdentifier)) {
    input.disable_safety_checker = true
  }

  if (modelIdentifier === "google/nano-banana-pro") {
    input.safety_filter_level = "block_only_high"
  }

  if (
    modelIdentifier === "openai/gpt-image-1.5" ||
    modelIdentifier === "openai/gpt-image-2"
  ) {
    input.moderation = "low"
  }

  return input
}

export function applyMinimalReplicateVideoModeration(
  modelIdentifier: string,
  input: Record<string, unknown>,
): Record<string, unknown> {
  if (modelIdentifier === "prunaai/p-video") {
    input.disable_safety_filter = true
  }

  return input
}
