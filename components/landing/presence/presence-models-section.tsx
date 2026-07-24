"use client"

import Link from "next/link"
import { aiVendorIconSrc } from "@/lib/constants/ai-vendor-icons"
import {
  HOMEPAGE_BENTO_VENDOR_MODEL_NAME_LIMIT,
} from "@/lib/constants/models-bento-content"
import { presenceLandingCopy } from "@/lib/constants/presence-landing-content"
import {
  getHomepageBentoVendorGroups,
  pickBentoCardMedia,
  summarizeVendorModels,
  vendorSlugFromIdentifier,
} from "@/lib/utils/models-vendor-grouping"
import { Button } from "@/components/ui/button"
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid"
import { BlurFade } from "@/components/ui/blur-fade"
import type { LandingBentoCardMedia } from "@/lib/types/landing"
import { cn } from "@/lib/utils"

const BENTO_MIN_H = "lg:min-h-[280px]"
const { modelsBento } = presenceLandingCopy

function modelBentoColSpans(total: number): number[] {
  if (total <= 0) return []
  if (total === 1) return [12]
  if (total === 2) return [8, 4]
  if (total === 3) return [8, 4, 12]
  if (total === 4) return [8, 4, 6, 6]
  if (total === 5) return [8, 4, 4, 4, 4]
  if (total === 6) return [8, 4, 4, 4, 4, 12]
  return [8, 4, ...modelBentoColSpans(total - 2)]
}

const NARROW_VENDOR_SLUGS = new Set(["kwaivgi", "xai"])

function modelBentoLayoutClass(index: number, total: number, vendorSlug: string): string {
  if (NARROW_VENDOR_SLUGS.has(vendorSlug)) {
    return cn("lg:col-span-4", BENTO_MIN_H)
  }
  const spans = modelBentoColSpans(total)
  const span = spans[index]
  if (span === undefined) {
    return cn("lg:col-span-12", BENTO_MIN_H)
  }
  switch (span) {
    case 4:
      return cn("lg:col-span-4", BENTO_MIN_H)
    case 6:
      return cn("lg:col-span-6", BENTO_MIN_H)
    case 8:
      return cn("lg:col-span-8", BENTO_MIN_H)
    case 12:
      return cn("lg:col-span-12", BENTO_MIN_H)
    default:
      return cn("lg:col-span-12", BENTO_MIN_H)
  }
}

function BentoMediaBackground({ media }: { media: LandingBentoCardMedia }) {
  const mediaNode =
    media.mediaType === "video" ? (
      <video
        src={encodeURI(media.src)}
        autoPlay
        loop
        muted
        playsInline
        className="h-full min-h-full w-full object-cover"
      />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element -- dynamic public paths
      <img
        src={encodeURI(media.src)}
        alt=""
        className="h-full w-full bg-neutral-950 object-cover object-center"
      />
    )

  return (
    <>
      {mediaNode}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl shadow-lg"
      />
    </>
  )
}

export function PresenceModelsSection() {
  const groups = getHomepageBentoVendorGroups()
  const totalGroups = groups.length

  return (
    <section id="models-bento" className="w-full bg-background py-16 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <BlurFade inView blur="10px" direction="up" offset={14} duration={0.5} className="w-full">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
                {modelsBento.title}
              </h2>
              <p className="mt-4 text-muted-foreground">{modelsBento.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:shrink-0">
              <Button variant="outline" asChild>
                <Link href={modelsBento.secondaryCtaHref}>{modelsBento.secondaryCtaLabel}</Link>
              </Button>
              <Button asChild>
                <Link href={modelsBento.primaryCtaHref}>{modelsBento.primaryCtaLabel}</Link>
              </Button>
            </div>
          </div>
        </BlurFade>

        <BentoGrid className="mt-10 auto-rows-[minmax(26rem,_auto)] grid-cols-1 md:grid-cols-2 md:auto-rows-[minmax(28rem,_auto)] lg:auto-rows-[minmax(26rem,_auto)] lg:grid-cols-12 lg:gap-4">
          {groups.map((group, index) => {
            const first = group.models[0]
            const primaryModel = first
            const vendorSlug =
              (primaryModel && vendorSlugFromIdentifier(primaryModel.identifier)) ?? group.vendorSlug
            const media = pickBentoCardMedia(vendorSlug)

            return (
              <BlurFade
                key={group.vendorSlug}
                inView
                inViewMargin="-12% 0px"
                blur="12px"
                direction="up"
                offset={16}
                duration={0.45}
                delay={index * 0.05}
                className={cn(
                  "h-full",
                  modelBentoLayoutClass(index, totalGroups, vendorSlug),
                )}
              >
                <BentoCard
                  name={group.displayName}
                  logoSrc={aiVendorIconSrc(vendorSlug)}
                  logoAlt={`${group.displayName} logo`}
                  description={summarizeVendorModels(
                    group.models,
                    HOMEPAGE_BENTO_VENDOR_MODEL_NAME_LIMIT,
                  )}
                  className="h-full !aspect-auto min-h-[280px] border-white/10 md:aspect-auto"
                  background={<BentoMediaBackground media={media} />}
                />
              </BlurFade>
            )
          })}
        </BentoGrid>
      </div>
    </section>
  )
}
