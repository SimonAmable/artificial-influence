"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"
import useEmblaCarousel from "embla-carousel-react"
import { dashboardFeatures } from "@/lib/constants/dashboard-features"

export function FeatureShowcaseCarousel() {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    slidesToScroll: 1,
    loop: true,
  })

  const scrollPrev = React.useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev()
  }, [emblaApi])

  const scrollNext = React.useCallback(() => {
    if (emblaApi) emblaApi.scrollNext()
  }, [emblaApi])

  return (
    <div className="w-full space-y-4">
      <div className="relative w-full">
        {/* Carousel Container */}
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex gap-4">
            {dashboardFeatures.map((feature) => (
              <div
                key={feature.slug}
                className="flex-[0_0_100%] min-w-0 sm:flex-[0_0_calc(50%-8px)] lg:flex-[0_0_calc(33.333%-11px)]"
              >
                <Link href={feature.toolHref} className="group block">
                  <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/10 bg-muted/20">
                    {feature.media.type === "video" ? (
                      <video
                        src={feature.media.src}
                        poster={feature.media.poster}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Image
                        src={feature.media.src}
                        alt={feature.title}
                        fill
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="flex flex-col items-start justify-start p-3 text-left">
                    <p className="text-xl font-semibold text-foreground leading-tight">
                      {feature.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">
                      {feature.description}
                    </p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Left Navigation Area */}
        <button
          onClick={scrollPrev}
          className="absolute left-0 top-0 h-full w-12 z-10 flex items-center justify-center transition hover:bg-white/5"
          aria-label="Previous"
        >
          <div className="rounded-full p-2 transition hover:bg-white/10">
            <ChevronLeft size={24} className="text-white" />
          </div>
        </button>

        {/* Right Navigation Area */}
        <button
          onClick={scrollNext}
          className="absolute right-0 top-0 h-full w-12 z-10 flex items-center justify-center transition hover:bg-white/5"
          aria-label="Next"
        >
          <div className="rounded-full p-2 transition hover:bg-white/10">
            <ChevronRight size={24} className="text-white" />
          </div>
        </button>
      </div>
    </div>
  )
}
