import Link from "next/link"

import { landingHero, platformSurfaceCards } from "@/lib/constants/landing-content"
import type { LandingPlatformSurfaceCard } from "@/lib/types/landing"
import { AutomationLogoConnection } from "@/components/landing/automation-logo-connection"
import { Button } from "@/components/ui/button"
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid"
import { cn } from "@/lib/utils"

function ImageSurfaceBackground({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- dynamic landing screenshots
    <img
      src={encodeURI(src)}
      alt={alt}
      className="h-full w-full bg-neutral-950 object-contain object-center"
    />
  )
}

function renderCardBackground(card: LandingPlatformSurfaceCard) {
  switch (card.kind) {
    case "image":
      return <ImageSurfaceBackground src={card.imageSrc} alt={card.imageAlt} />
    case "automation":
      return <AutomationLogoConnection />
    default: {
      const _never: never = card
      return _never
    }
  }
}

export function PlatformSurfacesSection() {
  return (
    <section className="w-full bg-background py-16 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
              Every tool in one place
            </h2>
            <div className="mt-4 space-y-1 text-muted-foreground">
              <p>
                <strong className="font-semibold text-foreground">Generator</strong>
                {": "}20+ SOTA models for images and video.
              </p>
              <p>
                <strong className="font-semibold text-foreground">Agent</strong>
                {": "}Plain-language chat for images, video, edits, and multi-step projects. No canvas.
              </p>
              <p>
                <strong className="font-semibold text-foreground">Workflows</strong>
                {": "}reusable node flows you edit, group, and rerun.
              </p>
              <p>
                <strong className="font-semibold text-foreground">Automation</strong>
                {": "}connect Instagram and publish on your schedule.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:shrink-0">
            <Button variant="outline" asChild>
              <Link href="/pricing">View Pricing</Link>
            </Button>
            <Button asChild>
              <Link href={landingHero.primaryCtaHref}>{landingHero.primaryCtaLabel}</Link>
            </Button>
          </div>
        </div>

        <BentoGrid className="mt-10 auto-rows-[minmax(26rem,_auto)] grid-cols-1 md:grid-cols-2 md:auto-rows-[minmax(28rem,_auto)] lg:auto-rows-[minmax(32rem,_auto)] lg:grid-cols-12 lg:gap-4">
          {platformSurfaceCards.map((card) => (
            <BentoCard
              key={card.id}
              name={card.name}
              description={card.description}
              href={card.href}
              cta={card.cta}
              className={cn(
                "!aspect-auto min-h-[280px] border-white/10 md:aspect-auto",
                card.layoutClass
              )}
              background={renderCardBackground(card)}
            />
          ))}
        </BentoGrid>
      </div>
    </section>
  )
}
