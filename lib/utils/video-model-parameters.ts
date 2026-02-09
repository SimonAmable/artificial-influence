import { getModelParameters } from "@/lib/constants/models";
import type { ParameterDefinition } from "@/lib/types/models";

/** Minimal shape for video model params (Model or ModelMetadata) */
export interface VideoParamsInput {
  identifier: string;
  supports_first_frame?: boolean;
  supports_last_frame?: boolean;
  duration_options?: number[];
  parameters?: { parameters?: ParameterDefinition[] };
}

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

function hasParameter(params: ParameterDefinition[], name: string): boolean {
  return params.some((param) => param.name === name);
}

export function buildVideoModelParameters(input: VideoParamsInput): ParameterDefinition[] {
  const baseParams = input.parameters?.parameters ?? getModelParameters(input.identifier);
  const params = [...baseParams];

  // Override duration param to use discrete options from DB when available
  if (input.duration_options && input.duration_options.length > 0) {
    const durationIdx = params.findIndex((p) => p.name === "duration");
    if (durationIdx >= 0) {
      const options = input.duration_options
        .map((x) => (typeof x === "string" ? parseInt(x, 10) : x))
        .filter((n): n is number => !Number.isNaN(n));
      if (options.length > 0) {
        const orig = params[durationIdx];
        params[durationIdx] = {
          ...orig,
          type: "number",
          enum: options,
          default: options[0],
          min: undefined,
          max: undefined,
        };
      }
    }
  }

  if (input.supports_first_frame && !hasParameter(params, "first_frame_image")) {
    params.push(FALLBACK_FIRST_FRAME);
  }

  if (input.supports_last_frame && !hasParameter(params, "last_frame")) {
    params.push(FALLBACK_LAST_FRAME);
  }

  const needsNegativePrompt = input.identifier.includes("veo");
  if (needsNegativePrompt && !hasParameter(params, "negative_prompt")) {
    params.push(FALLBACK_NEGATIVE_PROMPT);
  }

  return params;
}
