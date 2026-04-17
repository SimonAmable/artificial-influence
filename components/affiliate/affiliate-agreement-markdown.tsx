'use client'

import ReactMarkdown from 'react-markdown'

export function AffiliateAgreementMarkdown({ source }: { source: string }) {
  return (
    <article className="text-sm text-muted-foreground leading-relaxed space-y-3 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-medium [&_h2]:mt-4 [&_h2]:first:mt-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:text-foreground [&_em]:italic [&_p]:mb-2 [&_p]:last:mb-0">
      <ReactMarkdown>{source}</ReactMarkdown>
    </article>
  )
}
