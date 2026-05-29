/**
 * Submit image generation and wait for result.
 * Handles both sync (200) and async (202 + poll) responses.
 */

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 240; // ~10 min

/** POST /api/generate-image 402, plain Error so devtools don’t surface a custom class name. */
function makeInsufficientCreditsError(message: string): Error {
  const err = new Error(message);
  err.name = 'InsufficientCreditsError';
  return err;
}

type GenerateImageApiErrorDetails = {
  status: number;
  code?: string;
  details?: string;
};

function makeApiError(
  payload: { error?: unknown; message?: unknown; details?: unknown } | null | undefined,
  fallbackMessage: string,
  status: number
): Error {
  const message =
    typeof payload?.message === 'string' && payload.message.trim().length > 0
      ? payload.message
      : typeof payload?.error === 'string' && payload.error.trim().length > 0
        ? payload.error
        : fallbackMessage;
  const err = new Error(message) as Error & GenerateImageApiErrorDetails;
  err.status = status;
  if (typeof payload?.error === 'string' && payload.error.trim().length > 0) {
    err.code = payload.error;
  }
  if (typeof payload?.details === 'string' && payload.details.trim().length > 0) {
    err.details = payload.details;
  }
  return err;
}

/** Detect 402-style credit messages when only a string is available (e.g. canvas node error). */
export function isInsufficientCreditsMessage(message: string): boolean {
  const t = message.trim();
  if (!t) return false;
  const l = t.toLowerCase();
  if (l.includes('insufficient credit')) return true;
  if (/requires\s+\d+\s+credits?\b/i.test(t)) return true;
  if (/not enough\s+credits?\b/i.test(l)) return true;
  return false;
}

/** Prefer over `instanceof`, safe across chunk splits; 402 errors use `name === 'InsufficientCreditsError'`. */
export function isInsufficientCreditsError(err: unknown): boolean {
  return err instanceof Error && err.name === 'InsufficientCreditsError';
}

/** Content moderation errors can arrive as API metadata or only as provider text after polling. */
export function isContentModerationError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;

  const apiError = err as Error & GenerateImageApiErrorDetails;
  const haystack = [err.name, err.message, apiError.code, apiError.details]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase();

  return (
    apiError.code === 'Content moderation' ||
    haystack.includes('content moderation') ||
    haystack.includes('content policy') ||
    haystack.includes('flagged this request') ||
    haystack.includes('flagged this image') ||
    haystack.includes('violates our policy') ||
    haystack.includes('violates our content policy') ||
    haystack.includes('safety system') ||
    haystack.includes('safety filter')
  );
}

export type GenerateImageResult =
  | { image: { url: string; mimeType?: string }; images?: undefined }
  | { images: { url: string; mimeType?: string }[]; image?: undefined };

export interface GenerateImageAcceptedPayload {
  generationId?: string;
  predictionId: string;
}

interface GenerateImageCallbacks {
  onAccepted?: (payload: GenerateImageAcceptedPayload) => void;
  onProgress?: (message: string) => void;
}

function normalizeCallbacks(
  optionsOrProgress?: GenerateImageCallbacks | ((message: string) => void),
  onAccepted?: (payload: GenerateImageAcceptedPayload) => void
): GenerateImageCallbacks {
  if (typeof optionsOrProgress === 'function') {
    return { onAccepted, onProgress: optionsOrProgress };
  }

  return {
    onAccepted: optionsOrProgress?.onAccepted ?? onAccepted,
    onProgress: optionsOrProgress?.onProgress,
  };
}

export async function generateImageAndWait(
  formData: FormData,
  optionsOrProgress?: GenerateImageCallbacks | ((message: string) => void),
  onAccepted?: (payload: GenerateImageAcceptedPayload) => void
): Promise<GenerateImageResult> {
  const { onAccepted: acceptedCallback, onProgress } = normalizeCallbacks(optionsOrProgress, onAccepted);
  const response = await fetch('/api/generate-image', { method: 'POST', body: formData });

  if (response.status === 402) {
    const d = await response.json();
    throw makeInsufficientCreditsError(d.message || d.error || 'Insufficient credits');
  }

  if (response.status === 429) {
    const d = await response.json();
    const active = typeof d.activeGenerations === 'number' ? d.activeGenerations : undefined;
    const limit = typeof d.limit === 'number' ? d.limit : undefined;
    const tier = typeof d.tier === 'string' ? d.tier : undefined;
    const fallback =
      active != null && limit != null
        ? `Concurrency limit reached (${active}/${limit}${tier ? `, ${tier} tier` : ''}).`
        : 'Concurrency limit reached. Please wait and try again.';
    const detail = d.message || d.error || fallback;
    throw new Error(`Concurrency limit reached: ${detail}`);
  }

  if (!response.ok) {
    const d = await response.json();
    throw makeApiError(d, 'Failed to generate image', response.status);
  }

  const data = await response.json();

  if (response.status === 202) {
    const predictionId = data.predictionId as string;
    const generationId =
      typeof data.generationId === 'string' && data.generationId.length > 0
        ? data.generationId
        : undefined;
    if (!predictionId) throw new Error('No predictionId in async response');

    acceptedCallback?.({ generationId, predictionId });
    onProgress?.('Generation started, waiting for result...');
    for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const statusRes = await fetch(`/api/generate-image/status?predictionId=${encodeURIComponent(predictionId)}`);
      if (!statusRes.ok) throw new Error('Failed to fetch generation status');
      const statusData = await statusRes.json();

      if (statusData.status === 'completed') {
        if (statusData.images?.length) {
          return {
            images: statusData.images.map((img: { url: string; mimeType?: string }) => ({
              url: img.url,
              mimeType: img.mimeType || 'image/png',
            })),
          };
        }
        if (statusData.image?.url) {
          return { image: { url: statusData.image.url, mimeType: statusData.image.mimeType || 'image/png' } };
        }
        throw new Error('Completed but no image URL');
      }
      if (statusData.status === 'failed') {
        throw new Error(statusData.error || 'Generation failed');
      }
      onProgress?.(`Waiting for result... (${i + 1})`);
    }
    throw new Error('Generation timed out');
  }

  if (data.image?.url) return { image: { url: data.image.url, mimeType: data.image.mimeType } };
  if (data.images?.length) {
    return {
      images: data.images.map((img: { url: string; mimeType?: string }) => ({
        url: img.url,
        mimeType: img.mimeType || 'image/png',
      })),
    };
  }
  throw new Error('No image URL returned from API');
}
