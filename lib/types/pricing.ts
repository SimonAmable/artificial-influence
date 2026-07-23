/**
 * Pricing configuration stored in models.pricing_config (JSONB).
 */

export type FlatPerOutputPricing = {
  strategy: 'flat_per_output';
  credits: number;
};

export type TieredPerOutputPricing = {
  strategy: 'tiered_per_output';
  defaultCredits: number;
  dimensions: Array<{
    parameter: string;
    values: Record<string, number>;
  }>;
};

export type PerSecondPricing = {
  strategy: 'per_second';
  defaultCreditsPerSecond: number;
  tiers: Array<{
    match: Record<string, string | number | boolean>;
    creditsPerSecond: number;
  }>;
};

export type ModelPricingConfig =
  | FlatPerOutputPricing
  | TieredPerOutputPricing
  | PerSecondPricing;

export interface PricingSnapshot {
  strategy: ModelPricingConfig['strategy'] | 'legacy_fallback';
  matchedTier?: Record<string, unknown> | null;
  parameters: Record<string, unknown>;
  creditsPerUnit: number | null;
  outputCount?: number;
}

export interface GenerationPricingQuote {
  quotedCredits: number;
  creditsPerUnit: number | null;
  predictedDurationSeconds: number | null;
  pricingSnapshot: PricingSnapshot;
}

export interface GenerationPricingModelInput {
  identifier: string;
  type: 'image' | 'video' | 'audio' | 'upscale';
  model_cost?: number | null;
  model_cost_per_second?: number | null;
  pricing_config?: ModelPricingConfig | null;
}

export interface GenerationPricingQuoteInput {
  model: GenerationPricingModelInput;
  parameters?: Record<string, unknown>;
  outputCount?: number;
  durationSeconds?: number | string | null;
  sourceDurationSeconds?: number | null;
  hasInputVideo?: boolean;
  hasReferenceVideo?: boolean;
  characterOrientation?: string | null;
}
