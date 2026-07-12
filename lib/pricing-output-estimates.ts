/** Marketing credit-to-output estimates for pricing cards (typical defaults). */

export const NANO_BANANA_2_LITE_CREDITS_PER_IMAGE = 2;
export const VEO_31_FAST_CREDITS_PER_SECOND = 6;

export type PricingEstimateUnit = 'image' | 'second';

export type PricingEstimateModel = {
  id: string;
  name: string;
  creditsPerUnit: number;
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
    creditsPerUnit: 4,
    unit: 'image',
  },
  {
    id: 'nano-banana-pro',
    name: 'Nano Banana Pro',
    creditsPerUnit: 4,
    unit: 'image',
  },
  {
    id: 'gpt-image-2',
    name: 'GPT Image 2',
    creditsPerUnit: 4,
    unit: 'image',
  },
  {
    id: 'seedream-5',
    name: 'Seedream 5.0',
    creditsPerUnit: 2,
    unit: 'image',
  },
  {
    id: 'veo-3.1-fast',
    name: 'Veo 3.1 Fast',
    creditsPerUnit: VEO_31_FAST_CREDITS_PER_SECOND,
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
    creditsPerUnit: 6,
    unit: 'second',
  },
  {
    id: 'happy-horse-1.1',
    name: 'Happy Horse 1.1',
    creditsPerUnit: 12,
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

export function getFeaturedPlanEstimates(credits: number) {
  const nanoBanana2LiteImages = estimateCount(credits, NANO_BANANA_2_LITE_CREDITS_PER_IMAGE);
  const veoSeconds = estimateCount(credits, VEO_31_FAST_CREDITS_PER_SECOND);
  return {
    nanoBanana2LiteImages,
    veoSeconds,
    imageLine: `Up to ${nanoBanana2LiteImages} NB2 ${nanoBanana2LiteImages === 1 ? 'image' : 'images'}`,
    videoLine: `Up to ${veoSeconds} ${veoSeconds === 1 ? 'second' : 'seconds'} of Veo 3.1 Fast`,
  };
}

export function getModelEstimateLines(credits: number) {
  return PRICING_ESTIMATE_MODELS.map((model) => {
    const count = estimateCount(credits, model.creditsPerUnit);
    return {
      ...model,
      count,
      label: `Up to ${formatEstimateAmount(count, model.unit)} of ${model.name}`,
    };
  });
}
