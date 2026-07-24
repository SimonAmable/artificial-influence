"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { presenceLandingCopy } from "@/lib/constants/presence-landing-content"
import { cn } from "@/lib/utils"

const MONETIZE_CARD_WIDTH = "clamp(220px, 22vw, 280px)"
const MONETIZE_CARD_HEIGHT = "clamp(300px, 34vw, 380px)"

function MonetizeMediaCard({
  title,
  href,
  imageSrc,
  ctaLabel,
  placeholderImageSrc,
  className,
}: {
  title: string
  href: string
  imageSrc: string
  ctaLabel: string
  placeholderImageSrc: string
  className?: string
}) {
  const isPlaceholder = imageSrc === placeholderImageSrc

  return (
    <Link
      href={href}
      className={cn(
        "group relative shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 shadow-lg",
        "transition-transform duration-300 hover:scale-[1.01]",
        className,
      )}
      style={{
        width: MONETIZE_CARD_WIDTH,
        height: MONETIZE_CARD_HEIGHT,
      }}
    >
      {isPlaceholder ? (
        <div className="absolute inset-0 bg-neutral-900">
          <Image
            src={imageSrc}
            alt=""
            fill
            className="object-contain p-14 opacity-35 brightness-0 invert transition-transform duration-500 group-hover:scale-105"
            sizes="(min-width: 1024px) 280px, 42vw"
          />
        </div>
      ) : (
        <Image
          src={imageSrc}
          alt=""
          fill
          className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
          sizes="(min-width: 1024px) 280px, 42vw"
        />
      )}

      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/20 to-black/70"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
      />

      <div className="relative z-10 flex h-full flex-col justify-between p-5 sm:p-6">
        <h3 className="max-w-[14ch] text-balance text-xl font-semibold leading-tight tracking-tight text-white sm:text-2xl">
          {title}
        </h3>

        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-colors group-hover:bg-white/92">
          {ctaLabel}
          <ArrowRight className="size-4" aria-hidden />
        </span>
      </div>
    </Link>
  )
}

export function PresenceMonetizeSection() {
  const { monetize } = presenceLandingCopy

  return (
    <section id="monetize" className="w-full overflow-hidden bg-background py-16 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
            {monetize.title}
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">{monetize.description}</p>
        </div>
      </div>

      <div className="relative mt-10 sm:mt-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-20 w-[clamp(48px,14vw,160px)] bg-gradient-to-l from-background via-background/90 to-transparent"
        />

        <div
          className={cn(
            "no-scrollbar flex gap-4 overflow-x-auto overscroll-x-contain pb-2",
            "snap-x snap-mandatory scroll-smooth",
            "pl-4 pr-8 sm:pl-6 sm:pr-12 lg:pl-[max(2rem,calc((100vw-80rem)/2+2rem))] lg:pr-16",
          )}
        >
          {monetize.tiles.map((tile) => (
            <MonetizeMediaCard
              key={tile.title}
              title={tile.title}
              href={tile.href}
              imageSrc={tile.imageSrc ?? monetize.placeholderImageSrc}
              ctaLabel={monetize.ctaLabel}
              placeholderImageSrc={monetize.placeholderImageSrc}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
