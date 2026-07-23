import type {
  GenerationPricingModelInput,
  GenerationPricingQuote,
  GenerationPricingQuoteInput,
  ModelPricingConfig,
  PerSecondPricing,
  PricingSnapshot,
  TieredPerOutputPricing,
} from './types/pricing';
import { resolvePredictedDurationSeconds } from './video-duration';

export const PRICING_PARAMETER_NAMES = [
  'quality',
  'resolution',
  'size',
  'output_quality',
  'mode',
  'draft',
  'generate_audio',
] as const;

export type PricingParameterName = (typeof PRICING_PARAMETER_NAMES)[number];

function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeEnumKey(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value).trim().toLowerCase();
}

export function parsePricingConfig(raw: unknown): ModelPricingConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const config = raw as Record<string, unknown>;
  const strategy = config.strategy;

  if (strategy === 'flat_per_output') {
    const credits = toFiniteNumber(config.credits as number | string | null | undefined);
    if (credits == null || credits <= 0) return null;
    return { strategy: 'flat_per_output', credits };
  }

  if (strategy === 'tiered_per_output') {
    const defaultCredits = toFiniteNumber(
      config.defaultCredits as number | string | null | undefined,
    );
    const dimensions = config.dimensions;
    if (defaultCredits == null || defaultCredits <= 0 || !Array.isArray(dimensions)) {
      return null;
    }

    const parsedDimensions: TieredPerOutputPricing['dimensions'] = [];
    for (const dimension of dimensions) {
      if (!dimension || typeof dimension !== 'object') continue;
      const record = dimension as Record<string, unknown>;
      const parameter = typeof record.parameter === 'string' ? record.parameter : null;
      const values = record.values;
      if (!parameter || !values || typeof values !== 'object') continue;

      const normalizedValues: Record<string, number> = {};
      for (const [key, creditValue] of Object.entries(values as Record<string, unknown>)) {
        const credits = toFiniteNumber(creditValue as number | string | null | undefined);
        if (credits != null && credits > 0) {
          normalizedValues[normalizeEnumKey(key) ?? key] = credits;
        }
      }

      if (Object.keys(normalizedValues).length > 0) {
        parsedDimensions.push({ parameter, values: normalizedValues });
      }
    }

    if (parsedDimensions.length === 0) return null;
    return {
      strategy: 'tiered_per_output',
      defaultCredits,
      dimensions: parsedDimensions,
    };
  }

  if (strategy === 'per_second') {
    const defaultCreditsPerSecond = toFiniteNumber(
      config.defaultCreditsPerSecond as number | string | null | undefined,
    );
    const tiers = config.tiers;
    if (defaultCreditsPerSecond == null || defaultCreditsPerSecond <= 0 || !Array.isArray(tiers)) {
      return null;
    }

    const parsedTiers: PerSecondPricing['tiers'] = [];
    for (const tier of tiers) {
      if (!tier || typeof tier !== 'object') continue;
      const record = tier as Record<string, unknown>;
      const match = record.match;
      const creditsPerSecond = toFiniteNumber(
        record.creditsPerSecond as number | string | null | undefined,
      );
      if (!match || typeof match !== 'object' || creditsPerSecond == null || creditsPerSecond <= 0) {
        continue;
      }
      parsedTiers.push({
        match: match as Record<string, string | number | boolean>,
        creditsPerSecond,
      });
    }

    return {
      strategy: 'per_second',
      defaultCreditsPerSecond,
      tiers: parsedTiers,
    };
  }

  return null;
}

function getParameterValue(
  parameters: Record<string, unknown>,
  parameterName: string,
): unknown {
  if (parameterName in parameters) {
    return parameters[parameterName];
  }

  const normalizedName = parameterName.toLowerCase();
  for (const [key, value] of Object.entries(parameters)) {
    if (key.toLowerCase() === normalizedName) {
      return value;
    }
  }

  return undefined;
}

function resolveTieredCreditsPerOutput(
  config: TieredPerOutputPricing,
  parameters: Record<string, unknown>,
): { creditsPerUnit: number; matchedTier: Record<string, unknown> | null } {
  for (const dimension of config.dimensions) {
    const rawValue = getParameterValue(parameters, dimension.parameter);
    const normalizedValue = normalizeEnumKey(rawValue);
    if (!normalizedValue) continue;

    const credits = dimension.values[normalizedValue];
    if (credits != null && credits > 0) {
      return {
        creditsPerUnit: credits,
        matchedTier: {
          parameter: dimension.parameter,
          value: rawValue,
          credits,
        },
      };
    }
  }

  return {
    creditsPerUnit: config.defaultCredits,
    matchedTier: null,
  };
}

function normalizeMatchValue(value: unknown): string | number | boolean | null {
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    const asNumber = Number(trimmed);
    if (trimmed.length > 0 && Number.isFinite(asNumber)) return asNumber;
    return trimmed.toLowerCase();
  }
  return null;
}

function parameterMatchesTier(
  parameters: Record<string, unknown>,
  match: Record<string, string | number | boolean>,
): boolean {
  for (const [key, expected] of Object.entries(match)) {
    const actual = getParameterValue(parameters, key);
    const normalizedActual = normalizeMatchValue(actual);
    const normalizedExpected = normalizeMatchValue(expected);

    if (key === 'generate_audio' && actual === undefined) {
      if (normalizedExpected !== true) {
        return false;
      }
      continue;
    }

    if (normalizedActual !== normalizedExpected) {
      return false;
    }
  }

  return true;
}

function resolveCreditsPerSecondFromConfig(
  config: PerSecondPricing,
  parameters: Record<string, unknown>,
): { creditsPerSecond: number; matchedTier: Record<string, unknown> | null } {
  for (const tier of config.tiers) {
    if (parameterMatchesTier(parameters, tier.match)) {
      return {
        creditsPerSecond: tier.creditsPerSecond,
        matchedTier: tier.match,
      };
    }
  }

  return {
    creditsPerSecond: config.defaultCreditsPerSecond,
    matchedTier: null,
  };
}

function legacyResolveCreditsPerSecond(
  model: GenerationPricingModelInput,
  parameters: Record<string, unknown>,
): number | null {
  const modelIdentifier = model.identifier;
  const base = toFiniteNumber(model.model_cost_per_second);
  const generateAudioRaw = getParameterValue(parameters, 'generate_audio');
  const generateAudio = generateAudioRaw === undefined ? true : generateAudioRaw === true;
  const resolution = normalizeEnumKey(getParameterValue(parameters, 'resolution'));
  const draft = getParameterValue(parameters, 'draft') === true;
  const mode = normalizeEnumKey(getParameterValue(parameters, 'mode'));

  switch (modelIdentifier) {
    case 'google/veo-3.1-fast':
      return generateAudio ? 6 : 4;
    case 'kwaivgi/kling-v2.6':
      return generateAudio ? 6 : 3;
    case 'kwaivgi/kling-v2.6-motion-control':
      return mode === 'std' ? 3 : 5;
    case 'kwaivgi/kling-v3-motion-control':
      return mode === 'std' ? 6 : 7;
    case 'kwaivgi/kling-v3-video':
    case 'kwaivgi/kling-v3-omni-video': {
      const isStandard = mode === 'standard';
      if (isStandard && generateAudio) return 11;
      if (isStandard && !generateAudio) return 7;
      if (!isStandard && generateAudio) return 14;
      return 10;
    }
    case 'alibaba/happy-horse':
    case 'alibaba/happy-horse/v1.1':
      return resolution === '720p' ? 6 : 12;
    case 'google/gemini-omni-flash':
      return 10;
    case 'veed/fabric-1.0':
      return resolution === '480p' ? 4 : 6;
    case 'xai/grok-imagine-video':
      return resolution === '480p' ? 2 : 3;
    case 'xai/grok-imagine-video-1.5':
      return resolution === '480p' ? 3 : 5;
    case 'minimax/hailuo-2.3-fast':
      return resolution === '1080p' ? 2.2 : 1.2;
    case 'prunaai/p-video':
      if (resolution === '1080p') {
        return draft ? 1 : 4;
      }
      return draft ? 0.5 : 2;
    default:
      return base && base > 0 ? base : null;
  }
}

function resolveImageCreditsPerUnit(
  model: GenerationPricingModelInput,
  parameters: Record<string, unknown>,
): { creditsPerUnit: number; snapshot: PricingSnapshot } {
  const pricingConfig = parsePricingConfig(model.pricing_config);

  if (pricingConfig?.strategy === 'flat_per_output') {
    return {
      creditsPerUnit: pricingConfig.credits,
      snapshot: {
        strategy: pricingConfig.strategy,
        matchedTier: null,
        parameters,
        creditsPerUnit: pricingConfig.credits,
      },
    };
  }

  if (pricingConfig?.strategy === 'tiered_per_output') {
    const { creditsPerUnit, matchedTier } = resolveTieredCreditsPerOutput(pricingConfig, parameters);
    return {
      creditsPerUnit,
      snapshot: {
        strategy: pricingConfig.strategy,
        matchedTier,
        parameters,
        creditsPerUnit,
      },
    };
  }

  const fallbackCredits = Math.max(1, toFiniteNumber(model.model_cost) ?? 1);
  return {
    creditsPerUnit: fallbackCredits,
    snapshot: {
      strategy: 'legacy_fallback',
      matchedTier: null,
      parameters,
      creditsPerUnit: fallbackCredits,
    },
  };
}

function resolveVideoCreditsPerSecond(
  model: GenerationPricingModelInput,
  parameters: Record<string, unknown>,
): { creditsPerSecond: number | null; snapshot: PricingSnapshot } {
  const pricingConfig = parsePricingConfig(model.pricing_config);

  if (pricingConfig?.strategy === 'per_second') {
    const { creditsPerSecond, matchedTier } = resolveCreditsPerSecondFromConfig(
      pricingConfig,
      parameters,
    );
    return {
      creditsPerSecond,
      snapshot: {
        strategy: pricingConfig.strategy,
        matchedTier,
        parameters,
        creditsPerUnit: creditsPerSecond,
      },
    };
  }

  const legacyCreditsPerSecond = legacyResolveCreditsPerSecond(model, parameters);
  return {
    creditsPerSecond: legacyCreditsPerSecond,
    snapshot: {
      strategy: 'legacy_fallback',
      matchedTier: null,
      parameters,
      creditsPerUnit: legacyCreditsPerSecond,
    },
  };
}

export function buildPricingParametersFromRecord(
  source: Record<string, unknown>,
): Record<string, unknown> {
  const parameters: Record<string, unknown> = {};

  for (const name of PRICING_PARAMETER_NAMES) {
    if (name in source && source[name] !== undefined && source[name] !== null && source[name] !== '') {
      parameters[name] = source[name];
    }
  }

  if ('duration' in source && source.duration !== undefined && source.duration !== null && source.duration !== '') {
    parameters.duration = source.duration;
  }

  if ('character_orientation' in source && source.character_orientation) {
    parameters.character_orientation = source.character_orientation;
  }

  return parameters;
}

export function buildImagePricingParameters(input: {
  quality?: string | null;
  resolution?: string | null;
  size?: string | null;
  outputQuality?: number | null;
  resolutionPreset?: string | null;
}): Record<string, unknown> {
  return buildPricingParametersFromRecord({
    quality: input.quality?.toLowerCase() ?? null,
    resolution: input.resolution ?? input.resolutionPreset ?? null,
    size: input.size ?? input.resolutionPreset ?? null,
    output_quality: input.outputQuality ?? null,
  });
}

export function resolveCreditsForParameterOption(
  model: Pick<GenerationPricingModelInput, 'model_cost' | 'pricing_config'>,
  parameterName: string,
  optionValue: string,
): number | null {
  const pricingConfig = parsePricingConfig(model.pricing_config);
  if (pricingConfig?.strategy === 'tiered_per_output') {
    const dimension = pricingConfig.dimensions.find((entry) => entry.parameter === parameterName);
    if (!dimension) return null;
    const normalized = normalizeEnumKey(optionValue);
    if (!normalized) return null;
    return dimension.values[normalized] ?? null;
  }

  if (pricingConfig?.strategy === 'flat_per_output') {
    return pricingConfig.credits;
  }

  const fallback = toFiniteNumber(model.model_cost);
  return fallback != null && fallback > 0 ? fallback : null;
}

export function resolveGenerationPricingQuote(
  input: GenerationPricingQuoteInput,
): GenerationPricingQuote {
  const parameters = input.parameters ?? {};
  const outputCount = Math.max(1, input.outputCount ?? 1);

  if (input.model.type === 'image') {
    const { creditsPerUnit, snapshot } = resolveImageCreditsPerUnit(input.model, parameters);
    const quotedCredits = Math.max(1, Math.ceil(creditsPerUnit * outputCount));

    return {
      quotedCredits,
      creditsPerUnit,
      predictedDurationSeconds: null,
      pricingSnapshot: {
        ...snapshot,
        outputCount,
      },
    };
  }

  if (input.model.type === 'video') {
    const { creditsPerSecond, snapshot } = resolveVideoCreditsPerSecond(input.model, parameters);
    const predictedDurationSeconds = resolvePredictedDurationSeconds({
      modelIdentifier: input.model.identifier,
      duration:
        input.durationSeconds ??
        (() => {
          const rawDuration = getParameterValue(parameters, 'duration');
          if (typeof rawDuration === 'number' || typeof rawDuration === 'string') {
            return rawDuration;
          }
          return null;
        })(),
      sourceDurationSeconds: input.sourceDurationSeconds,
      hasInputVideo: input.hasInputVideo,
      hasReferenceVideo: input.hasReferenceVideo,
      characterOrientation:
        input.characterOrientation ??
        (typeof getParameterValue(parameters, 'character_orientation') === 'string'
          ? (getParameterValue(parameters, 'character_orientation') as string)
          : null),
    });

    if (
      creditsPerSecond != null &&
      creditsPerSecond > 0 &&
      predictedDurationSeconds != null &&
      predictedDurationSeconds > 0
    ) {
      const quotedCredits = Math.max(1, Math.ceil(creditsPerSecond * predictedDurationSeconds));
      return {
        quotedCredits,
        creditsPerUnit: creditsPerSecond,
        predictedDurationSeconds,
        pricingSnapshot: snapshot,
      };
    }

    const legacyFlatCost = toFiniteNumber(input.model.model_cost);
    return {
      quotedCredits: Math.max(1, Math.ceil(legacyFlatCost ?? 10)),
      creditsPerUnit: null,
      predictedDurationSeconds,
      pricingSnapshot: {
        strategy: 'legacy_fallback',
        matchedTier: null,
        parameters,
        creditsPerUnit: null,
      },
    };
  }

  const fallbackCredits = Math.max(1, toFiniteNumber(input.model.model_cost) ?? 1);
  return {
    quotedCredits: fallbackCredits,
    creditsPerUnit: fallbackCredits,
    predictedDurationSeconds: null,
    pricingSnapshot: {
      strategy: 'legacy_fallback',
      matchedTier: null,
      parameters,
      creditsPerUnit: fallbackCredits,
    },
  };
}
