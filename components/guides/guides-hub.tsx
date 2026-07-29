"use client"

import Image from "next/image"
import { BookOpen, CheckCircle, MagnifyingGlass } from "@phosphor-icons/react"

import { GuidesProgressRow } from "@/components/guides/guides-progress-row"
import {
  AgentGenerationShowcase,
  FanvuePaidPostShowcase,
  InfluencerMergeShowcase,
  ShotsGridShowcase,
} from "@/components/guides/guide-hub-showcase-graphics"
import { useGuideProgress } from "@/components/guides/use-guide-progress"
import { Input } from "@/components/ui/input"
import { AuroraShaderBackground } from "@/components/ui/aurora-shader-background"
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

function McpGuideCardGraphic() {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-[inherit] bg-background">
      <AuroraShaderBackground animate className="rounded-[inherit]" />
      <div className="absolute inset-0 bg-background/30 backdrop-blur-[1px]" aria-hidden />

      <div className="absolute size-52 rounded-full border border-primary/20 animate-[spin_18s_linear_infinite] motion-reduce:animate-none">
        <span className="absolute left-1/2 top-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_18px_var(--primary)]" />
        <span className="absolute bottom-[12%] left-[8%] size-1.5 rounded-full bg-foreground/80" />
        <span className="absolute bottom-[12%] right-[8%] size-1.5 rounded-full bg-foreground/80" />
      </div>
      <div className="absolute size-36 rounded-full border border-dashed border-foreground/20 animate-[spin_12s_linear_infinite_reverse] motion-reduce:animate-none" />

      <div className="relative z-10 flex size-20 items-center justify-center rounded-3xl border border-foreground/15 bg-background/75 shadow-lg backdrop-blur-xl">
        <span className="absolute inset-0 rounded-[inherit] bg-primary/10 animate-pulse motion-reduce:animate-none" />
        <Image
          src={currentProduct.logo}
          alt=""
          width={40}
          height={40}
          className="relative size-10 object-contain"
        />
      </div>

      <span className="absolute left-[8%] top-[16%] rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground shadow-sm backdrop-blur-md">
        Plan
      </span>
      <span className="absolute right-[7%] top-[28%] rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground shadow-sm backdrop-blur-md">
        Create
      </span>
      <span className="absolute bottom-[13%] left-[15%] rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground shadow-sm backdrop-blur-md">
        Repeat
      </span>

      <div className="pointer-events-none absolute inset-x-[18%] bottom-[8%] h-px overflow-hidden bg-border/40">
        <span className="block h-full w-1/3 bg-primary animate-[mcp-flow_2.2s_ease-in-out_infinite] motion-reduce:animate-none" />
      </div>
      <style>{`
        @keyframes mcp-flow {
          0% { transform: translateX(-110%); opacity: 0; }
          30%, 70% { opacity: 1; }
          100% { transform: translateX(410%); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

function GuideHubCardView({
  card,
  animationDelay,
  complete,
}: {
  card: GuideHubCard
  animationDelay: number
  complete: boolean
}) {
  const showcase =
    card.slug === "create-ai-influencer" ? (
      <InfluencerMergeShowcase />
    ) : card.slug === "shoot-week-of-content" ? (
      <AgentGenerationShowcase />
    ) : card.slug === "carousel-multi-angle-shoot" ? (
      <ShotsGridShowcase />
    ) : card.slug === "publish-to-fanvue" ? (
      <FanvuePaidPostShowcase />
    ) : card.slug === "scale-with-agents" ? (
      <McpGuideCardGraphic />
    ) : undefined

  return (
    <div className="relative">
      <ShaderDemoCard
        href={card.available ? `/guides/${card.slug}` : undefined}
        disabled={!card.available}
        buttonLabel={card.available ? card.title : "Soon"}
        title={card.title}
        description={card.description}
        mediaSrc={card.mediaSrc}
        mediaContent={showcase}
        mediaAlt={card.mediaAlt}
        mediaFit="contain"
        mediaWater={Boolean(card.mediaSrc)}
        animationDelay={animationDelay}
      />
      {complete ? (
        <span
          className="pointer-events-none absolute right-3 top-3 z-10 inline-flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm ring-1 ring-border/60 backdrop-blur-sm"
          aria-label="Completed"
        >
          <CheckCircle className="size-4" weight="fill" aria-hidden />
        </span>
      ) : null}
    </div>
  )
}

function GuideSection({
  section,
  cards,
  animationOffset,
  isComplete,
}: {
  section: GuideSectionId
  cards: GuideHubCard[]
  animationOffset: number
  isComplete: (slug: string) => boolean
}) {
  if (cards.length === 0) return null

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {GUIDE_SECTION_LABELS[section]}
      </h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, index) => (
          <GuideHubCardView
            key={card.slug}
            card={card}
            animationDelay={animationOffset + index * 0.35}
            complete={card.available && isComplete(card.slug)}
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
  const { isComplete } = useGuideProgress()
  const showFanvueBadge = currentProduct.id === "presence-studio"
  const orderedCards = GUIDE_SECTION_ORDER.flatMap((section) =>
    cards.filter((card) => card.section === section),
  )

  return (
    <div className="flex w-full flex-col gap-12">
      <header className="flex w-full flex-col items-center text-center">
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

        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          Make better AI creator content, post more often, and learn what helps it
          spread.
        </p>

        <GuidesSearchTrigger className="mt-8 w-full max-w-xl text-left" />
      </header>

      <GuidesProgressRow cards={orderedCards} className="-mt-4" />

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
                isComplete={isComplete}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
