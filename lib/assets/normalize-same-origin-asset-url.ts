/**
 * Collapse absolute URLs that point at this deployment to a path + search.
 * Preset thumbnails are resolved to full origin URLs for fetch/autofill; storing
 * or returning them that way breaks `next/image` unless localhost is allowlisted.
 */
export function normalizeSameOriginAssetUrl(url: string, siteOrigin: string): string {
  const origin = siteOrigin.replace(/\/$/, "")
  const trimmed = String(url ?? "").trim()
  if (!trimmed) return trimmed
  try {
    const parsed = new URL(trimmed)
    if (parsed.origin === origin) {
      return `${parsed.pathname}${parsed.search}`
    }
  } catch {
    // Relative path or non-URL string — return as-is
  }
  return trimmed
}
