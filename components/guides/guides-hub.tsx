"use client"

import { ShaderDemoCard } from "@/components/ui/shader-demo-card"
import {
  GUIDE_SECTION_LABELS,
  GUIDE_SECTION_ORDER,
  getGuideHubCardsForProduct,
} from "@/lib/guides/content"
import type { GuideHubCard, GuideSectionId } from "@/lib/guides/types"
import { currentProduct } from "@/lib/product/current"

function GuideHubCardView({
  card,
  animationDelay,
}: {
  card: GuideHubCard
  animationDelay: number
}) {
  return (
    <ShaderDemoCard
      href={card.available ? `/guides/${card.slug}` : undefined}
      disabled={!card.available}
      buttonLabel={card.available ? "Open guide" : "Soon"}
      title={card.title}
      description={card.description}
      mediaSrc={card.mediaSrc}
      mediaAlt={card.mediaAlt}
      mediaFit={card.mediaSrc ? "contain" : "cover"}
      animationDelay={animationDelay}
    />
  )
}

function GuideSection({
  section,
  cards,
  animationOffset,
}: {
  section: GuideSectionId
  cards: GuideHubCard[]
  animationOffset: number
}) {
  if (cards.length === 0) return null

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {GUIDE_SECTION_LABELS[section]}
      </h2>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card, index) => (
          <GuideHubCardView
            key={card.slug}
            card={card}
            animationDelay={animationOffset + index * 0.35}
          />
        ))}
      </div>
    </section>
  )
}

export function GuidesHub() {
  const cards = getGuideHubCardsForProduct(currentProduct.id)

  return (
    <div className="flex w-full flex-col gap-12">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Guides</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
          Short playbooks. Do them in the product.
        </p>
      </header>

      <div className="flex flex-col gap-12">
        {GUIDE_SECTION_ORDER.map((section, sectionIndex) => {
          const sectionCards = cards.filter((card) => card.section === section)
          return (
            <GuideSection
              key={section}
              section={section}
              cards={sectionCards}
              animationOffset={sectionIndex * 0.2}
            />
          )
        })}
      </div>
    </div>
  )
}
