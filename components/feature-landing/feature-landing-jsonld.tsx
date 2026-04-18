import type { FeatureLandingConfig } from "@/lib/types/feature-landing"
import { getSiteBaseUrl } from "@/lib/seo/site-url"

type JsonLdProps = {
  config: FeatureLandingConfig
}

function toQuestionEntities(config: FeatureLandingConfig) {
  const pairs: Array<{ question: string; answer: string }> = [
    ...config.answerCapsules.map((c) => ({ question: c.question, answer: c.answer })),
    ...config.faq.items.map((f) => ({ question: f.question, answer: f.answer })),
  ]
  return pairs.map((p) => ({
    "@type": "Question" as const,
    name: p.question,
    acceptedAnswer: {
      "@type": "Answer" as const,
      text: p.answer,
    },
  }))
}

export function FeatureLandingJsonLd({ config }: JsonLdProps) {
  const base = getSiteBaseUrl()
  const path = `/${config.slug}`
  const canonical = config.seo.canonical ?? `${base}${path}`
  const ogImage = config.seo.ogImage ?? `${base}/logo.svg`
  const structured = config.seo.structuredData

  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebPage",
      "@id": `${canonical}#webpage`,
      url: canonical,
      name: config.seo.title,
      description: config.seo.description,
      datePublished: config.datePublished,
      dateModified: config.lastUpdated,
      isPartOf: { "@id": `${base}#website` },
      primaryImageOfPage: {
        "@type": "ImageObject",
        url: ogImage,
      },
    },
  ]

  if (structured?.breadcrumb?.length) {
    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${canonical}#breadcrumb`,
      itemListElement: structured.breadcrumb.map((b, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: b.name,
        item: b.url.startsWith("http") ? b.url : `${base}${b.url.startsWith("/") ? "" : "/"}${b.url}`,
      })),
    })
  }

  const faqEntities = toQuestionEntities(config)
  if (faqEntities.length > 0) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${canonical}#faq`,
      mainEntity: faqEntities,
    })
  }

  if (structured?.includeSoftwareApplication !== false) {
    graph.push({
      "@type": "SoftwareApplication",
      name: "UniCan",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: base,
      offers: {
        "@type": "Offer",
        url: `${base}/pricing`,
      },
    })
  }

  if (structured?.includeHowTo && config.howTo) {
    graph.push({
      "@type": "HowTo",
      name: config.howTo.name,
      description: config.howTo.description,
      step: config.howTo.steps.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s.name,
        text: s.text,
      })),
    })
  }

  const payload = {
    "@context": "https://schema.org",
    "@graph": graph,
  }

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- JSON-LD is server-rendered
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  )
}
