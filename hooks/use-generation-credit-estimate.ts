'use client';

import * as React from 'react';
import type { Model } from '@/lib/types/models';
import {
  resolveImageCreditEstimate,
  resolveVideoCreditEstimate,
} from '@/lib/pricing-parameter-ui';

interface UseGenerationCreditEstimateInput {
  model: Model | null;
  parameters?: Record<string, unknown>;
  outputCount?: number;
  sourceDurationSeconds?: number | null;
  hasInputVideo?: boolean;
  hasReferenceVideo?: boolean;
  characterOrientation?: string | null;
}

export function useGenerationCreditEstimate({
  model,
  parameters = {},
  outputCount = 1,
  sourceDurationSeconds,
  hasInputVideo,
  hasReferenceVideo,
  characterOrientation,
}: UseGenerationCreditEstimateInput): number | null {
  return React.useMemo(() => {
    if (!model) return null;

    if (model.type === 'video') {
      return resolveVideoCreditEstimate(model, parameters, {
        sourceDurationSeconds,
        hasInputVideo,
        hasReferenceVideo,
        characterOrientation,
      });
    }

    return resolveImageCreditEstimate(model, parameters, outputCount);
  }, [
    characterOrientation,
    hasInputVideo,
    hasReferenceVideo,
    model,
    outputCount,
    parameters,
    sourceDurationSeconds,
  ]);
}
