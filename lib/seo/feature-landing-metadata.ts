import type { Metadata } from "next"

import type { FeatureLandingConfig } from "@/lib/types/feature-landing"
import { productOgImage } from "@/lib/product/branding"
import { currentProduct } from "@/lib/product/current"
import { getSiteBaseUrl } from "@/lib/seo/site-url"

export function buildFeatureLandingMetadata(config: FeatureLandingConfig): Metadata {
  const base = getSiteBaseUrl()
  const path = `/${config.slug}`
  const canonical = config.seo.canonical ?? `${base}${path}`
  const ogImage = config.seo.ogImage ?? `${base}${productOgImage}`
  const title = config.seo.title

  return {
    title,
    description: config.seo.description,
    keywords: config.seo.keywords,
    alternates: { canonical },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description: config.seo.description,
      siteName: currentProduct.name,
      locale: "en_US",
      images: [{ url: ogImage, width: 1200, height: 630, alt: config.hero.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: config.seo.description,
      images: [ogImage],
    },
  }
}
