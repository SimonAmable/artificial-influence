import {
  PRICING_PARAMETER_NAMES,
  resolveCreditsForParameterOption,
  resolveGenerationPricingQuote,
  buildPricingParametersFromRecord,
  buildImagePricingParameters,
} from '@/lib/generation-pricing';
import {
  getParameterDefault,
  isStringParameter,
  parseModelParameters,
  type Model,
  type ParameterDefinition,
} from '@/lib/types/models';

export const IMAGE_PRICING_PARAMETER_NAMES = new Set<string>(PRICING_PARAMETER_NAMES);

export function formatQualityOptionLabel(paramName: string, option: string): string {
  if (paramName !== 'quality') return option;

  switch (option) {
    case 'low':
      return '1k';
    case 'medium':
      return '2k';
    case 'high':
      return '4k';
    default:
      return option;
  }
}

export function getQualityOptionDescription(option: string): string {
  switch (option) {
    case 'low':
      return 'Fast · lower detail';
    case 'medium':
      return 'Balanced quality';
    case 'high':
      return 'Max quality';
    default:
      return '';
  }
}

export function getImageCountDescription(count: number): string {
  if (count === 1) return 'Single image';
  return `${count} variations`;
}

export function isPricingParameter(param: ParameterDefinition): boolean {
  if (param.affects_pricing) return true;
  return IMAGE_PRICING_PARAMETER_NAMES.has(param.name);
}

export function getImagePricingParameters(model: Model | null): ParameterDefinition[] {
  if (!model) return [];

  return parseModelParameters(model.parameters).filter((param) => {
    if (param.name === 'output_quality') return false;
    if (!isPricingParameter(param)) return false;
    return isStringParameter(param) && Array.isArray(param.enum) && param.enum.length > 0;
  });
}

export function formatPricingOptionLabel(
  model: Pick<Model, 'model_cost' | 'pricing_config'>,
  paramName: string,
  option: string,
): string {
  const baseLabel = formatQualityOptionLabel(paramName, option);
  const credits = resolveCreditsForParameterOption(model, paramName, option);
  if (credits == null) return baseLabel;
  return `${baseLabel} (${credits} cr)`;
}

export function getDefaultImageModelParameters(model: Model | null): Record<string, string | number | boolean | null> {
  if (!model) return {};

  return getImagePricingParameters(model).reduce<Record<string, string | number | boolean | null>>(
    (acc, param) => {
      acc[param.name] = getParameterDefault(param);
      return acc;
    },
    {},
  );
}

export function resolveImageCreditEstimate(
  model: Pick<Model, 'identifier' | 'type' | 'model_cost' | 'pricing_config'> | null,
  parameters: Record<string, unknown>,
  outputCount = 1,
): number | null {
  if (!model) return null;

  return resolveGenerationPricingQuote({
    model: {
      identifier: model.identifier,
      type: 'image',
      model_cost: model.model_cost,
      pricing_config: model.pricing_config,
    },
    parameters: buildImagePricingParameters({
      quality: typeof parameters.quality === 'string' ? parameters.quality : null,
      resolution: typeof parameters.resolution === 'string' ? parameters.resolution : null,
      size: typeof parameters.size === 'string' ? parameters.size : null,
      outputQuality:
        typeof parameters.output_quality === 'number' ? parameters.output_quality : null,
    }),
    outputCount,
  }).quotedCredits;
}

export function resolveVideoCreditEstimate(
  model: Pick<Model, 'identifier' | 'type' | 'model_cost' | 'model_cost_per_second' | 'pricing_config'> | null,
  parameters: Record<string, unknown>,
  options?: {
    sourceDurationSeconds?: number | null;
    hasInputVideo?: boolean;
    hasReferenceVideo?: boolean;
    characterOrientation?: string | null;
  },
): number | null {
  if (!model) return null;

  return resolveGenerationPricingQuote({
    model: {
      identifier: model.identifier,
      type: 'video',
      model_cost: model.model_cost,
      model_cost_per_second: model.model_cost_per_second,
      pricing_config: model.pricing_config,
    },
    parameters: buildPricingParametersFromRecord(parameters),
    durationSeconds:
      typeof parameters.duration === 'number' || typeof parameters.duration === 'string'
        ? parameters.duration
        : null,
    sourceDurationSeconds: options?.sourceDurationSeconds ?? null,
    hasInputVideo: options?.hasInputVideo,
    hasReferenceVideo: options?.hasReferenceVideo,
    characterOrientation: options?.characterOrientation ?? null,
  }).quotedCredits;
}

export function formatVideoPricingOptionLabel(
  model: Pick<Model, 'identifier' | 'type' | 'model_cost' | 'model_cost_per_second' | 'pricing_config'>,
  paramName: string,
  option: string,
  parameters: Record<string, unknown>,
  options?: {
    sourceDurationSeconds?: number | null;
    hasInputVideo?: boolean;
    hasReferenceVideo?: boolean;
    characterOrientation?: string | null;
  },
): string {
  const currentCreditsPerSecond = resolveGenerationPricingQuote({
    model: {
      identifier: model.identifier,
      type: 'video',
      model_cost: model.model_cost,
      model_cost_per_second: model.model_cost_per_second,
      pricing_config: model.pricing_config,
    },
    parameters: buildPricingParametersFromRecord(parameters),
    durationSeconds: 1,
    sourceDurationSeconds: options?.sourceDurationSeconds ?? null,
    hasInputVideo: options?.hasInputVideo,
    hasReferenceVideo: options?.hasReferenceVideo,
    characterOrientation: options?.characterOrientation ?? null,
  }).creditsPerUnit;

  const optionCreditsPerSecond = resolveGenerationPricingQuote({
    model: {
      identifier: model.identifier,
      type: 'video',
      model_cost: model.model_cost,
      model_cost_per_second: model.model_cost_per_second,
      pricing_config: model.pricing_config,
    },
    parameters: buildPricingParametersFromRecord({
      ...parameters,
      [paramName]: paramName === 'generate_audio' ? option === 'true' : option,
    }),
    durationSeconds: 1,
    sourceDurationSeconds: options?.sourceDurationSeconds ?? null,
    hasInputVideo: options?.hasInputVideo,
    hasReferenceVideo: options?.hasReferenceVideo,
    characterOrientation: options?.characterOrientation ?? null,
  }).creditsPerUnit;

  if (
    currentCreditsPerSecond != null &&
    optionCreditsPerSecond != null &&
    optionCreditsPerSecond !== currentCreditsPerSecond
  ) {
    const delta = optionCreditsPerSecond - currentCreditsPerSecond;
    const sign = delta > 0 ? '+' : '';
    return `${option} (${sign}${delta} cr/s)`;
  }

  if (optionCreditsPerSecond != null) {
    return `${option} (${optionCreditsPerSecond} cr/s)`;
  }

  return option;
}
