import Link from "next/link"
import { getActiveModelMetadata } from "@/lib/constants/model-metadata"
import { aiVendorIconSrc } from "@/lib/constants/ai-vendor-icons"
import { modelsBentoCopy } from "@/lib/constants/models-bento-content"
import {
  groupModelsByVendor,
  modelHrefForLanding,
  pickBentoCardMedia,
  summarizeVendorModels,
} from "@/lib/utils/models-vendor-grouping"
import { Button } from "@/components/ui/button"
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid"
import type { LandingBentoCardMedia } from "@/lib/types/landing"
import { cn } from "@/lib/utils"

const BENTO_MIN_H = "lg:min-h-[280px]"

/** 12-column spans that always fill each row (no orphan columns). */
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

function modelBentoLayoutClass(index: number, total: number): string {
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
  if (media.mediaType === "video") {
    return (
      <video
        src={encodeURI(media.src)}
        autoPlay
        loop
        muted
        playsInline
        className="h-full min-h-full w-full object-cover"
      />
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- dynamic public paths
    <img
      src={encodeURI(media.src)}
      alt=""
      className="h-full w-full bg-neutral-950 object-cover object-center"
    />
  )
}

export function ModelsBentoSection() {
  const models = getActiveModelMetadata().filter((m) => !m.deprecated)
  const groups = groupModelsByVendor(models)
  const totalGroups = groups.length

  return (
    <section
      id="models-bento"
      className="dark w-full border-t border-white/5 bg-neutral-950 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] bg-[length:20px_20px] py-16 text-neutral-50 sm:py-24"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xl">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {modelsBentoCopy.title}
            </h2>
            <p className="mt-2 text-sm text-neutral-400">{modelsBentoCopy.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-white/15 bg-transparent text-white hover:bg-white/10"
              asChild
            >
              <Link href={modelsBentoCopy.secondaryCtaHref}>{modelsBentoCopy.secondaryCtaLabel}</Link>
            </Button>
            <Button size="sm" className="bg-white text-neutral-950 hover:bg-neutral-200" asChild>
              <Link href={modelsBentoCopy.primaryCtaHref}>{modelsBentoCopy.primaryCtaLabel}</Link>
            </Button>
          </div>
        </div>

        <BentoGrid className="mt-10 auto-rows-[minmax(26rem,_auto)] grid-cols-1 md:grid-cols-2 md:auto-rows-[minmax(28rem,_auto)] lg:auto-rows-[minmax(30rem,_auto)] lg:grid-cols-12 lg:gap-4">
          {groups.map((group, index) => {
            const first = group.models[0]
            const href = first
              ? modelHrefForLanding(first.type, first.identifier)
              : "/pricing"
            const media = pickBentoCardMedia(group.vendorSlug)

            return (
              <BentoCard
                key={group.vendorSlug}
                name={group.displayName}
                logoSrc={aiVendorIconSrc(group.vendorSlug)}
                logoAlt={`${group.displayName} logo`}
                description={summarizeVendorModels(group.models)}
                href={href}
                cta="Open"
                className={cn(
                  "!aspect-auto min-h-[280px] border-white/10 md:aspect-auto",
                  modelBentoLayoutClass(index, totalGroups)
                )}
                background={<BentoMediaBackground media={media} />}
              />
            )
          })}
        </BentoGrid>
      </div>
    </section>
  )
}
