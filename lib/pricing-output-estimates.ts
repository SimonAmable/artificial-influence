/** Marketing credit-to-output estimates for pricing cards (typical defaults). */

export const NANO_BANANA_2_LITE_CREDITS_PER_IMAGE = 2;
export const VEO_31_FAST_CREDITS_PER_SECOND = 6;
/** Marketing default clip length for plan-card video estimates. */
export const VEO_31_FAST_FEATURED_CLIP_SECONDS = 5;
export const VEO_31_FAST_CREDITS_PER_5S_VIDEO =
  VEO_31_FAST_CREDITS_PER_SECOND * VEO_31_FAST_FEATURED_CLIP_SECONDS;

export type PricingEstimateUnit = 'image' | 'second';

export type PricingEstimateModel = {
  id: string;
  name: string;
  creditsPerUnit: number;
  /** When set, marketing copy uses a from–to range (quality tiers). */
  creditsPerUnitMax?: number;
  unit: PricingEstimateUnit;
};

/** Featured card lines + curated info-popover models. */
export const PRICING_ESTIMATE_MODELS = [
  {
    id: 'nano-banana-2-lite',
    name: 'Nano Banana 2 Lite',
    creditsPerUnit: NANO_BANANA_2_LITE_CREDITS_PER_IMAGE,
    unit: 'image',
  },
  {
    id: 'nano-banana-2',
    name: 'Nano Banana 2',
    creditsPerUnit: 2,
    creditsPerUnitMax: 8,
    unit: 'image',
  },
  {
    id: 'nano-banana-pro',
    name: 'Nano Banana Pro',
    creditsPerUnit: 4,
    creditsPerUnitMax: 10,
    unit: 'image',
  },
  {
    id: 'gpt-image-2',
    name: 'GPT Image 2',
    creditsPerUnit: 2,
    creditsPerUnitMax: 8,
    unit: 'image',
  },
  {
    id: 'seedream-5',
    name: 'Seedream 5.0',
    creditsPerUnit: 3,
    creditsPerUnitMax: 6,
    unit: 'image',
  },
  {
    id: 'veo-3.1-fast',
    name: 'Veo 3.1 Fast',
    creditsPerUnit: 4,
    creditsPerUnitMax: VEO_31_FAST_CREDITS_PER_SECOND,
    unit: 'second',
  },
  {
    id: 'seedance-2.0',
    name: 'Seedance 2.0',
    creditsPerUnit: 10,
    unit: 'second',
  },
  {
    id: 'kling-v2.6',
    name: 'Kling V2.6 Pro',
    creditsPerUnit: 3,
    creditsPerUnitMax: 6,
    unit: 'second',
  },
  {
    id: 'happy-horse-1.1',
    name: 'Happy Horse 1.1',
    creditsPerUnit: 6,
    creditsPerUnitMax: 12,
    unit: 'second',
  },
] as const satisfies readonly PricingEstimateModel[];

export function estimateCount(credits: number, creditsPerUnit: number): number {
  if (creditsPerUnit <= 0) return 0;
  return Math.floor(credits / creditsPerUnit);
}

export function formatEstimateAmount(count: number, unit: PricingEstimateUnit): string {
  if (unit === 'image') {
    return count === 1 ? '1 image' : `${count} images`;
  }
  return count === 1 ? '1 second' : `${count} seconds`;
}

export function formatTieredCreditsLabel(model: PricingEstimateModel): string {
  if (model.creditsPerUnitMax != null && model.creditsPerUnitMax !== model.creditsPerUnit) {
    const unit = model.unit === 'image' ? 'image' : 'sec';
    return `${model.creditsPerUnit}–${model.creditsPerUnitMax} cr/${unit}`;
  }

  const unit = model.unit === 'image' ? 'image' : 'sec';
  return `${model.creditsPerUnit} cr/${unit}`;
}

export function getFeaturedPlanEstimates(credits: number) {
  const nanoBanana2LiteImages = estimateCount(credits, NANO_BANANA_2_LITE_CREDITS_PER_IMAGE);
  const veoSeconds = estimateCount(credits, VEO_31_FAST_CREDITS_PER_SECOND);
  const veo5sVideos = estimateCount(credits, VEO_31_FAST_CREDITS_PER_5S_VIDEO);
  const videoNoun = veo5sVideos === 1 ? 'video' : 'videos';
  return {
    nanoBanana2LiteImages,
    veoSeconds,
    veo5sVideos,
    imageLine: `Up to ${nanoBanana2LiteImages} NB2 ${nanoBanana2LiteImages === 1 ? 'image' : 'images'}`,
    videoLine: `Approx. ${veo5sVideos} × 5s Veo 3.1 Fast ${videoNoun}`,
  };
}

export function getModelEstimateLines(credits: number) {
  return PRICING_ESTIMATE_MODELS.map((model) => {
    const count = estimateCount(credits, model.creditsPerUnit);
    const tierLabel = formatTieredCreditsLabel(model);
    return {
      ...model,
      count,
      tierLabel,
      label: `Up to ${formatEstimateAmount(count, model.unit)} of ${model.name} (${tierLabel})`,
    };
  });
}
