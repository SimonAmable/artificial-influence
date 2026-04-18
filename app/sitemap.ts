import type { MetadataRoute } from "next"

import { getSiteBaseUrl } from "@/lib/seo/site-url"
import { getSitemapEntries } from "@/lib/seo/sitemap-routes"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteBaseUrl()
  return getSitemapEntries().map((e) => ({
    url: `${base}${e.path}`,
    lastModified: e.lastModified,
    changeFrequency: e.changeFrequency,
    priority: e.priority,
  }))
}
