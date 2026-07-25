import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { GuideArticleView } from "@/components/guides/guide-article"
import {
  getAvailableGuideSlugs,
  getGuideArticleBySlug,
  getGuideHubCardsForProduct,
} from "@/lib/guides/content"
import { currentProduct } from "@/lib/product/current"

type GuidePageProps = {
  params: Promise<{
    slug: string
  }>
}

export function generateStaticParams() {
  return getAvailableGuideSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params
  const article = getGuideArticleBySlug(slug)

  if (!article) {
    return { title: "Guide" }
  }

  return {
    title: article.title,
    description: article.result,
  }
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params
  const article = getGuideArticleBySlug(slug)

  if (!article) {
    notFound()
  }

  const hubCard = getGuideHubCardsForProduct(currentProduct.id).find(
    (card) => card.slug === article.slug,
  )

  // Missing hub card should not 404 a valid article; only hide explicitly unavailable guides.
  if (hubCard?.available === false) {
    notFound()
  }

  return <GuideArticleView article={article} />
}
