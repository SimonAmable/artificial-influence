import type { Metadata } from "next"

import { loadLegalDoc, type LegalSlug } from "@/lib/legal/load-legal-doc"
import { currentProduct } from "@/lib/product/current"

export function getLegalMetadata(slug: LegalSlug): Metadata {
  const { data } = loadLegalDoc(slug)
  const title = `${data.title} | ${currentProduct.name}`

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
