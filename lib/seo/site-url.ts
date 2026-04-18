/**
 * Canonical site origin for metadata, sitemap, robots, and JSON-LD.
 * Set NEXT_PUBLIC_SITE_URL in production (e.g. https://unican.app).
 */
export function getSiteBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "https://unican.app"
  return raw.replace(/\/$/, "")
}
