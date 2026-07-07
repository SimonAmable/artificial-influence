import { currentProduct } from "@/lib/product/current"
import { getSiteBaseUrl } from "@/lib/seo/site-url"

/**
 * Sitewide Organization + WebSite (SearchAction) JSON-LD for crawlers and AI systems.
 */
export function SitewideJsonLd() {
  const base = getSiteBaseUrl()
  const graph = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: currentProduct.name,
      url: base,
      logo: `${base}${currentProduct.logo}`,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: currentProduct.name,
      url: base,
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${base}/chat?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ]
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  )
}
