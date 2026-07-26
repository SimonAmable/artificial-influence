"use client"

import Image from "next/image"
import { BookOpen, MagnifyingGlass } from "@phosphor-icons/react"

import { Input } from "@/components/ui/input"
import { ShaderDemoCard } from "@/components/ui/shader-demo-card"
import {
  GUIDE_SECTION_LABELS,
  GUIDE_SECTION_ORDER,
  getGuideHubCardsForProduct,
} from "@/lib/guides/content"
import type { GuideHubCard, GuideSectionId } from "@/lib/guides/types"
import { openGlobalSearch } from "@/lib/navigation/open-global-search"
import { currentProduct } from "@/lib/product/current"

const FANVUE_LOGO_SRC = "/brand_icons/fanvue_logo.png"

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
      buttonLabel={card.available ? card.title : "Soon"}
      title={card.title}
      description={card.description}
      mediaSrc={card.mediaSrc}
      mediaAlt={card.mediaAlt}
      mediaFit="contain"
      mediaWater={Boolean(card.mediaSrc)}
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
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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

function GuidesSearchTrigger({
  className,
  placeholder = "Search guides...",
}: {
  className?: string
  placeholder?: string
}) {
  return (
    <button
      type="button"
      onClick={() => openGlobalSearch({ query: "guide" })}
      className={className}
      aria-label="Search guides"
    >
      <span className="relative block w-full">
        <MagnifyingGlass
          className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          readOnly
          tabIndex={-1}
          placeholder={placeholder}
          className="pointer-events-none h-11 rounded-full bg-input/40 pl-11 pr-4"
        />
      </span>
    </button>
  )
}

export function GuidesHub() {
  const cards = getGuideHubCardsForProduct(currentProduct.id)
  const showFanvueBadge = currentProduct.id === "presence-studio"

  return (
    <div className="flex w-full flex-col gap-12">
      <header className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
        {showFanvueBadge ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-[#49F264] px-3 py-1.5 text-xs font-semibold tracking-tight text-black">
            <span className="flex items-center gap-1.5" aria-hidden>
              <BookOpen className="size-3.5 shrink-0 text-black" weight="bold" />
              <Image
                src={FANVUE_LOGO_SRC}
                alt=""
                width={16}
                height={16}
                className="size-4 rounded-sm"
              />
            </span>
            Made for Fanvue Creators
          </span>
        ) : null}

        <h1
          className={`${showFanvueBadge ? "mt-5" : ""} text-3xl font-semibold tracking-tight sm:text-4xl`}
        >
          Learn {currentProduct.name}
        </h1>

        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
          How to make the most realistic AI influencer content — with guides written
          alongside the biggest creators in the industry.
        </p>

        <GuidesSearchTrigger className="mt-8 w-full max-w-xl text-left" />
      </header>

      <div className="flex flex-col gap-12">
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No guides available yet.</p>
        ) : (
          GUIDE_SECTION_ORDER.map((section, sectionIndex) => {
            const sectionCards = cards.filter((card) => card.section === section)
            return (
              <GuideSection
                key={section}
                section={section}
                cards={sectionCards}
                animationOffset={sectionIndex * 0.2}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
