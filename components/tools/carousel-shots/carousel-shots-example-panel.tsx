"use client"

import { CAROUSEL_SHOTS_EXAMPLE } from "@/lib/carousel-shots/constants"

export function CarouselShotsExamplePanel() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-dashed border-muted-foreground/40 bg-muted/10 p-4 sm:p-6">
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-muted/20 p-3 sm:p-4">
        <div className="grid h-full max-h-full w-full max-w-md grid-cols-2 grid-rows-2 gap-2 sm:gap-3">
          {CAROUSEL_SHOTS_EXAMPLE.slideUrls.map((src, index) => (
            <div
              key={src}
              className="relative min-h-0 overflow-hidden rounded-lg border bg-muted/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Carousel shots example slide ${index + 1}`}
                className="h-full w-full object-contain"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 shrink-0 space-y-1.5 text-center">
        <h2 className="text-lg font-semibold tracking-tight">{CAROUSEL_SHOTS_EXAMPLE.title}</h2>
        <p className="text-sm text-muted-foreground">{CAROUSEL_SHOTS_EXAMPLE.description}</p>
      </div>
    </div>
  )
}
