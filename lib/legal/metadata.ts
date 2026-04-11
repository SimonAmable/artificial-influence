import type { Metadata } from "next"

import { loadLegalDoc, type LegalSlug } from "@/lib/legal/load-legal-doc"

const SITE_NAME = "UniCan"

export function getLegalMetadata(slug: LegalSlug): Metadata {
  const { data } = loadLegalDoc(slug)
  const title = `${data.title} | ${SITE_NAME}`

  return {
    title,
    description: data.description,
    openGraph: {
      title,
      description: data.description,
    },
    twitter: {
      card: "summary",
      title,
      description: data.description,
    },
  }
}
