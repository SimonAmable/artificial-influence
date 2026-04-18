/**
 * Fallback typical wall-clock ranges when DB sample size is too small.
 * Real queue + provider latency varies by region, load, and prompt complexity.
 */
export const GENERATION_TIME_FALLBACK_DISCLAIMER =
  "Typical ranges only; actual time depends on provider queue depth and job complexity."

export const FALLBACK_LATENCY_SECONDS_BY_KIND: Record<
  "image" | "video",
  { p50: number; p90: number }
> = {
  image: { p50: 25, p90: 90 },
  video: { p50: 120, p90: 360 },
}
