/**
 * Submit image generation and wait for result.
 * Handles both sync (200) and async (202 + poll) responses.
 */

import { waitForGenerationStatus } from '@/lib/generation-poll-manager';

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

async function readApiResponsePayload(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await response.json().catch(() => ({}))) as Record<string, unknown>;
  }

  const text = await response.text();
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text, error: text };
  }
}

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

const CONTENT_MODERATION_CODE = 'Content moderation';

/** Match provider / API text when structured error codes are missing (e.g. async poll). */
export function isContentModerationMessage(message: string): boolean {
  const haystack = message.trim().toLowerCase();
  if (!haystack) return false;

  return (
    haystack.includes('content moderation') ||
    haystack.includes('content policy') ||
    haystack.includes('content filter') ||
    haystack.includes('flagged this request') ||
    haystack.includes('flagged this image') ||
    haystack.includes('flagged as') ||
    haystack.includes('content_policy_violation') ||
    haystack.includes('content checker') ||
    haystack.includes('flagged by a content') ||
    haystack.includes('violates our policy') ||
    haystack.includes('violates our content policy') ||
    haystack.includes('safety system') ||
    haystack.includes('safety filter') ||
    haystack.includes('safety checker') ||
    haystack.includes('nsfw') ||
    haystack.includes('not safe for work') ||
    haystack.includes('sensitive content') ||
    haystack.includes('inappropriate content') ||
    haystack.includes('blocked by moderation') ||
    haystack.includes('image moderation') ||
    haystack.includes('responsible ai') ||
    haystack.includes('rai policy') ||
    /\bmoderation\b/.test(haystack)
  );
}

/** Content moderation errors can arrive as API metadata or only as provider text after polling. */
export function isContentModerationError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;

  const apiError = err as Error & GenerateImageApiErrorDetails;
  if (apiError.code === CONTENT_MODERATION_CODE) return true;

  const haystack = [err.name, err.message, apiError.code, apiError.details]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ');

  return isContentModerationMessage(haystack);
}

export type GenerateImageResult =
  | { image: { url: string; mimeType?: string }; images?: undefined; generationIds?: string[] }
  | { images: { url: string; mimeType?: string }[]; image?: undefined; generationIds?: string[] };

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
    const d = await readApiResponsePayload(response);
    throw makeInsufficientCreditsError(
      (typeof d.message === 'string' && d.message) ||
        (typeof d.error === 'string' && d.error) ||
        'Insufficient credits'
    );
  }

  if (response.status === 429) {
    const d = await readApiResponsePayload(response);
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
    const d = await readApiResponsePayload(response);
    const fallback =
      response.status === 413
        ? 'Request is too large. Try using a smaller reference image or fewer references.'
        : 'Failed to generate image';
    throw makeApiError(d, fallback, response.status);
  }

  const data = await readApiResponsePayload(response);

  if (response.status === 202) {
    const predictionId = data.predictionId as string;
    const generationId =
      typeof data.generationId === 'string' && data.generationId.length > 0
        ? data.generationId
        : undefined;
    if (!predictionId) throw new Error('No predictionId in async response');

    acceptedCallback?.({ generationId, predictionId });
    onProgress?.('Generation started, waiting for result...');

    const pollResult = await waitForGenerationStatus<
      | { ok: true; result: GenerateImageResult; generationIds: string[] }
      | { ok: false; error: Error }
    >({
      predictionId,
      statusEndpoint: '/api/generate-image/status',
      timeoutMessage: 'Generation timed out',
      fetchErrorMessage: 'Failed to fetch generation status',
      mapCompleted: (statusData) => {
        if (statusData.status !== 'completed') {
          return null;
        }

        const generationIds = Array.isArray(statusData.generationIds)
          ? statusData.generationIds.filter(
              (id): id is string => typeof id === 'string' && id.length > 0,
            )
          : typeof statusData.generationId === 'string' && statusData.generationId.length > 0
            ? [statusData.generationId]
            : [];

        if (Array.isArray(statusData.images) && statusData.images.length > 0) {
          return {
            ok: true,
            generationIds,
            result: {
              images: (statusData.images as Array<{ url: string; mimeType?: string }>).map((img) => ({
                url: img.url,
                mimeType: img.mimeType || 'image/png',
              })),
            },
          };
        }
        const image = statusData.image as { url?: string; mimeType?: string } | undefined;
        if (image?.url) {
          return {
            ok: true,
            generationIds,
            result: {
              image: { url: image.url, mimeType: image.mimeType || 'image/png' },
            },
          };
        }
        return null;
      },
      mapFailed: (statusData) => ({
        ok: false,
        error: makeApiError(
          {
            error: statusData.errorCode,
            message: statusData.error,
            details: statusData.details,
          },
          typeof statusData.error === 'string' && statusData.error.trim().length > 0
            ? statusData.error
            : 'Generation failed',
          400,
        ),
      }),
    });

    if (!pollResult.ok) {
      throw pollResult.error;
    }

    return {
      ...pollResult.result,
      generationIds: pollResult.generationIds,
    };
  }

  const image = data.image as { url?: string; mimeType?: string } | undefined;
  if (image?.url) {
    return { image: { url: image.url, mimeType: image.mimeType } };
  }

  const images = data.images as Array<{ url: string; mimeType?: string }> | undefined;
  if (images?.length) {
    return {
      images: images.map((img) => ({
        url: img.url,
        mimeType: img.mimeType || 'image/png',
      })),
    };
  }
  throw new Error('No image URL returned from API');
}
