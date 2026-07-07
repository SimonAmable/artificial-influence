import { getCurrentProductSiteUrl } from "@/lib/product/current"

/**
 * Canonical site origin for metadata, sitemap, robots, and JSON-LD.
 * Set NEXT_PUBLIC_SITE_URL in production (e.g. https://unican.ai).
 */
export function getSiteBaseUrl(): string {
  return getCurrentProductSiteUrl()
}
