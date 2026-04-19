import Image from "next/image"
import Link from "next/link"

import type { AnswerCapsule, FeatureLandingConfig } from "@/lib/types/feature-landing"
import { FeatureLandingAnswerCapsules } from "@/components/feature-landing/feature-landing-answer-capsules"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type HeroProps = {
  hero: FeatureLandingConfig["hero"]
  answerCapsules: AnswerCapsule[]
  answerCapsulesSectionTitle?: string
}

const heroSurfaceClass =
  "bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] bg-[length:20px_20px]"

export function FeatureLandingHero({ hero, answerCapsules, answerCapsulesSectionTitle }: HeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-background via-background to-muted/25"
        aria-hidden
      />
      <div className={cn("pointer-events-none absolute inset-0 opacity-70", heroSurfaceClass)} aria-hidden />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(55%,420px)] bg-linear-to-b from-primary/5 to-transparent"
        aria-hidden
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-14 pt-24 md:pb-20 md:pt-28 lg:px-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          {hero.eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{hero.eyebrow}</p>
          ) : null}
          <h1
            className={cn(
              "mt-3 text-balance font-extrabold uppercase leading-[1.08] tracking-tight text-foreground",
              "text-4xl sm:text-5xl md:text-6xl"
            )}
          >
            {hero.title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-base text-muted-foreground sm:mt-5 sm:text-lg">
            {hero.tagline}
          </p>

          <p className="mt-8 max-w-3xl text-pretty text-center text-sm leading-relaxed text-muted-foreground sm:text-base">
            {hero.tldr}
          </p>

          <div className="mt-8 flex w-full max-w-xl flex-col items-stretch gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href={hero.primaryCta.href}>{hero.primaryCta.label}</Link>
            </Button>
            {hero.secondaryCta ? (
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link href={hero.secondaryCta.href}>{hero.secondaryCta.label}</Link>
              </Button>
            ) : null}
          </div>
        </div>

        {hero.media ? (
          <div className="mx-auto mt-12 w-full max-w-4xl">
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-[0_24px_48px_-8px_rgba(0,0,0,0.45)] ring-1 ring-border/40 backdrop-blur-sm dark:shadow-[0_28px_56px_-6px_rgba(0,0,0,0.65)]">
              <div className="relative aspect-video w-full">
                {hero.media.kind === "image" ? (
                  <Image
                    src={hero.media.src}
                    alt={hero.media.alt}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 768px) 100vw, 896px"
                    priority
                  />
                ) : (
                  <video
                    src={hero.media.src}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    autoPlay
                    loop
                    controls={false}
                    aria-label={hero.media.alt}
                  />
                )}
              </div>
            </div>
          </div>
        ) : null}

        <FeatureLandingAnswerCapsules
          capsules={answerCapsules}
          sectionTitle={answerCapsulesSectionTitle ?? "At a glance"}
          className="mt-16 md:mt-20"
        />
      </div>
    </section>
  )
}
