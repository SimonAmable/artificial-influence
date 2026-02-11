/**
 * Submit image generation and wait for result.
 * Handles both sync (200) and async (202 + poll) responses.
 */

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 240; // ~10 min

export type GenerateImageResult =
  | { image: { url: string; mimeType?: string }; images?: undefined }
  | { images: { url: string; mimeType?: string }[]; image?: undefined };

export async function generateImageAndWait(
  formData: FormData,
  onProgress?: (message: string) => void
): Promise<GenerateImageResult> {
  const response = await fetch('/api/generate-image', { method: 'POST', body: formData });

  if (response.status === 402) {
    const d = await response.json();
    throw new Error(d.message || d.error || 'Insufficient credits');
  }

  if (!response.ok) {
    const d = await response.json();
    throw new Error(d.message || d.error || 'Failed to generate image');
  }

  const data = await response.json();

  if (response.status === 202) {
    const predictionId = data.predictionId as string;
    if (!predictionId) throw new Error('No predictionId in async response');

    onProgress?.('Generation started, waiting for result…');
    for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const statusRes = await fetch(`/api/generate-image/status?predictionId=${encodeURIComponent(predictionId)}`);
      if (!statusRes.ok) throw new Error('Failed to fetch generation status');
      const statusData = await statusRes.json();

      if (statusData.status === 'completed') {
        if (statusData.image?.url) {
          return { image: { url: statusData.image.url, mimeType: statusData.image.mimeType || 'image/png' } };
        }
        throw new Error('Completed but no image URL');
      }
      if (statusData.status === 'failed') {
        throw new Error(statusData.error || 'Generation failed');
      }
      onProgress?.(`Waiting for result… (${i + 1})`);
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
