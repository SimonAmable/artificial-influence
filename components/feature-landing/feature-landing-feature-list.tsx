import Image from "next/image"
import Link from "next/link"

import type { FeatureLandingConfig } from "@/lib/types/feature-landing"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type FeaturesProps = {
  features: NonNullable<FeatureLandingConfig["features"]>
}

export function FeatureLandingFeatureList({ features }: FeaturesProps) {
  return (
    <section className="border-b border-border/60 bg-background py-12 sm:py-16" aria-labelledby="features-heading">
      <div className="mx-auto w-full max-w-6xl space-y-12 px-4 lg:px-8">
        <h2 id="features-heading" className="text-balance text-2xl font-semibold text-foreground sm:text-3xl">
          {features.heading}
        </h2>
        <ul className="space-y-16">
          {features.items.map((item, index) => (
            <li
              key={item.title}
              className={cn(
                "flex flex-col gap-8 md:flex-row md:items-center md:gap-12",
                index % 2 === 1 && "md:flex-row-reverse"
              )}
            >
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/60 bg-black p-4 shadow-md md:w-1/2 sm:p-6">
                <div className="relative h-full w-full">
                  {item.mediaType === "image" ? (
                    <Image
                      src={item.mediaSrc}
                      alt={item.mediaAlt}
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  ) : (
                    <video
                      src={item.mediaSrc}
                      className="h-full w-full object-contain"
                      muted
                      playsInline
                      autoPlay
                      loop
                      aria-label={item.mediaAlt}
                    />
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <h3 className="text-xl font-semibold text-foreground sm:text-2xl">{item.title}</h3>
                <p className="text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">{item.description}</p>
                {item.href && item.ctaLabel ? (
                  <Button asChild variant="outline" size="sm" className="mt-2">
                    <Link href={item.href}>{item.ctaLabel}</Link>
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
