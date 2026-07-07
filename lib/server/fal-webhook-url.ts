/**
 * Public base URL for provider webhooks (Replicate, Fal).
 * Prefer REPLICATE_WEBHOOK_BASE_URL (already used for Replicate) so one env var covers both.
 */
export function getProviderWebhookBaseUrl(): string | null {
  const explicit =
    process.env.REPLICATE_WEBHOOK_BASE_URL?.trim() ||
    process.env.FAL_WEBHOOK_BASE_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()

  if (explicit) {
    return explicit.replace(/\/$/, "").startsWith("http")
      ? explicit.replace(/\/$/, "")
      : `https://${explicit.replace(/\/$/, "")}`
  }

  const vercelUrl = process.env.VERCEL_URL?.trim()
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/$/, "")}`
  }

  return null
}

export function getFalWebhookUrl(): string | null {
  const base = getProviderWebhookBaseUrl()
  return base ? `${base}/api/webhooks/fal` : null
}
