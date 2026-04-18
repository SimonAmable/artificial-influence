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
      name: "UniCan",
      url: base,
      logo: `${base}/logo.svg`,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "UniCan",
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
      // eslint-disable-next-line react/no-danger -- JSON-LD is server-rendered and static
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  )
}
