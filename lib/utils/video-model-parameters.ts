import { getModelParameters } from "@/lib/constants/models";
import type { ModelMetadata } from "@/lib/constants/model-metadata";
import type { ParameterDefinition } from "@/lib/types/models";

const FALLBACK_FIRST_FRAME: ParameterDefinition = {
  name: "first_frame_image",
  type: "string",
  label: "First Frame",
  description: "First frame image",
  required: false,
  default: null,
  ui_type: "text",
};

const FALLBACK_LAST_FRAME: ParameterDefinition = {
  name: "last_frame",
  type: "string",
  label: "Last Frame",
  description: "Last frame image",
  required: false,
  default: null,
  ui_type: "text",
};

const FALLBACK_NEGATIVE_PROMPT: ParameterDefinition = {
  name: "negative_prompt",
  type: "string",
  label: "Negative Prompt",
  description: "What to exclude",
  required: false,
  default: null,
  ui_type: "textarea",
};

function hasParameter(
  params: ParameterDefinition[],
  name: string
): boolean {
  return params.some((param) => param.name === name);
}

export function buildVideoModelParameters(
  metadata: ModelMetadata
): ParameterDefinition[] {
  const baseParams = getModelParameters(metadata.identifier);
  const params = [...baseParams];

  if (metadata.supports_first_frame && !hasParameter(params, "first_frame_image")) {
    params.push(FALLBACK_FIRST_FRAME);
  }

  if (metadata.supports_last_frame && !hasParameter(params, "last_frame")) {
    params.push(FALLBACK_LAST_FRAME);
  }

  const needsNegativePrompt = metadata.identifier.includes("veo");
  if (needsNegativePrompt && !hasParameter(params, "negative_prompt")) {
    params.push(FALLBACK_NEGATIVE_PROMPT);
  }

  return params;
}
