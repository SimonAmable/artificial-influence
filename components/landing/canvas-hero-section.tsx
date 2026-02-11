"use client"

import * as React from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { landingHero, canvasSeeds } from "@/lib/constants/landing-content"
import { Button } from "@/components/ui/button"
const CanvasHeroFlow = dynamic(
  () => import("@/components/landing/canvas-hero-flow").then((mod) => mod.CanvasHeroFlow),
  { ssr: false }
)

export function CanvasHeroSection() {
  const [isMobile, setIsMobile] = React.useState(false)
  const mobileWorkflowPreview = "/canvas_landing_page_assets/icon%20creation.png"

  React.useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)")
    const sync = () => setIsMobile(query.matches)
    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])

  return (
    <section className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      {isMobile ? (
        <div className="relative z-20 flex min-h-[100svh] flex-col items-center justify-center px-4 pb-10 pt-28">
          <div className="max-w-3xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-300">
              {landingHero.eyebrow}
            </p>
            <h1 className="text-balance text-4xl font-semibold leading-tight text-white sm:text-5xl md:text-6xl">
              {landingHero.title}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm text-zinc-300 sm:text-base">
              {landingHero.description}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href={landingHero.primaryCtaHref}>
                <Button size="lg" className="w-full sm:w-auto">
                  {landingHero.primaryCtaLabel}
                </Button>
              </Link>
              <Link href={landingHero.secondaryCtaHref}>
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  {landingHero.secondaryCtaLabel}
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-8 w-full max-w-sm overflow-hidden rounded-2xl border border-white/20 bg-zinc-950/70 shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mobileWorkflowPreview} alt="Workflow preview" className="h-auto w-full object-cover" />
          </div>
        </div>
      ) : (
        <div className="relative h-[100svh] w-full">
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4">
            <div className="max-w-3xl text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-300">
                {landingHero.eyebrow}
              </p>
              <h1 className="text-balance text-4xl font-semibold leading-tight text-white sm:text-5xl md:text-6xl">
                {landingHero.title}
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm text-zinc-300 sm:text-base">
                {landingHero.description}
              </p>
              <div className="pointer-events-auto mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href={landingHero.primaryCtaHref}>
                  <Button size="lg" className="w-full sm:w-auto">
                    {landingHero.primaryCtaLabel}
                  </Button>
                </Link>
                <Link href={landingHero.secondaryCtaHref}>
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    {landingHero.secondaryCtaLabel}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
          <CanvasHeroFlow />
        </div>
      )}
    </section>
  )
}
