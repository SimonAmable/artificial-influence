import { loadLegalDoc, type LegalSlug } from "@/lib/legal/load-legal-doc"

import { LegalMarkdown } from "./legal-markdown"

export function LegalPage({ slug }: { slug: LegalSlug }) {
  const { data, content } = loadLegalDoc(slug)

  return (
    <article>
      <header className="mb-10 border-b border-border pb-8">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{data.title}</h1>
        {data.lastUpdated ? (
          <p className="mt-3 text-sm text-muted-foreground">Last updated: {data.lastUpdated}</p>
        ) : null}
      </header>
      <LegalMarkdown content={content} />
    </article>
  )
}
