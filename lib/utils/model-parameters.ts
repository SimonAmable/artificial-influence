/**
 * Model parameter utilities for detecting dimension vs aspect-ratio models
 * and converting aspect ratio to width/height when needed.
 */

import { parseModelParameters } from '@/lib/types/models';

/** Aspect ratio string to width, height. Base size 1024 for longest side. */
const ASPECT_RATIO_TO_DIMENSIONS: Record<string, [number, number]> = {
  '1:1': [1024, 1024],
  '16:9': [1344, 768],
  '9:16': [768, 1344],
  '4:3': [1152, 864],
  '3:4': [864, 1152],
  '3:2': [1200, 800],
  '2:3': [800, 1200],
  '2:1': [1344, 672],
  '1:2': [672, 1344],
  '19.5:9': [1408, 640],
  '9:19.5': [640, 1408],
  '20:9': [1422, 640],
  '9:20': [640, 1422],
};

/**
 * Check if a model uses width/height dimensions instead of aspect_ratio.
 * Models like prunaai/z-image-turbo use width/height; models like nano-banana use aspect_ratio.
 */
export function modelUsesDimensions(parameters: unknown): boolean {
  let parsed: unknown = parameters;
  if (typeof parameters === 'string') {
    try {
      parsed = JSON.parse(parameters);
    } catch {
      return false;
    }
  }
  const params = parseModelParameters(parsed);
  const names = new Set(params.map((p) => p.name));
  const hasWidth = names.has('width');
  const hasHeight = names.has('height');
  const hasAspectRatio = names.has('aspect_ratio') || names.has('aspectRatio');
  // Uses dimensions when it has width+height and no aspect_ratio param
  return hasWidth && hasHeight && !hasAspectRatio;
}

const MIN_DIM = 64;
const MAX_DIM = 2048;
const DIM_ALIGN = 16; // Replicate requires dimensions divisible by 16

function alignTo16(n: number): number {
  const rounded = Math.round(n);
  const aligned = Math.round(rounded / DIM_ALIGN) * DIM_ALIGN;
  return Math.max(MIN_DIM, Math.min(MAX_DIM, aligned));
}

/**
 * Map aspect ratio string to [width, height].
 * For match_input_image/auto, returns default 1024x1024.
 * Dimensions are clamped to 64-2048 for Replicate compatibility.
 */
export function aspectRatioToDimensions(
  aspectRatio: string,
  maxSize = 1024
): { width: number; height: number } {
  const normalized = aspectRatio.trim().toLowerCase();
  if (normalized === 'match_input_image' || normalized === 'auto') {
    return { width: alignTo16(maxSize), height: alignTo16(maxSize) };
  }
  const dims = ASPECT_RATIO_TO_DIMENSIONS[aspectRatio];
  if (dims) {
    const [w, h] = dims;
    const scale = maxSize / Math.max(w, h);
    return {
      width: alignTo16(w * scale),
      height: alignTo16(h * scale),
    };
  }
  // Parse "16:9" format
  const match = aspectRatio.match(/^(\d+):(\d+)$/);
  if (match) {
    const numW = parseInt(match[1]!, 10);
    const numH = parseInt(match[2]!, 10);
    if (numW > 0 && numH > 0) {
      const scale = maxSize / Math.max(numW, numH);
      return {
        width: alignTo16(numW * scale),
        height: alignTo16(numH * scale),
      };
    }
  }
  return { width: alignTo16(maxSize), height: alignTo16(maxSize) };
}
