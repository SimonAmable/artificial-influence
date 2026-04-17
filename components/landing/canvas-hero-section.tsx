"use client"

import * as React from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { motion } from "framer-motion"
import { landingHero } from "@/lib/constants/landing-content"
import { Button } from "@/components/ui/button"
import { MorphingText } from "@/components/ui/morphing-text"
import { HeroMockPromptBox } from "@/components/landing/hero-mock-prompt-box"
import { cn } from "@/lib/utils"

const heroEase = [0.22, 1, 0.36, 1] as const

const heroList = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.06,
    },
  },
}

const heroFadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: heroEase },
  },
}
const CanvasHeroFlow = dynamic(
  () => import("@/components/landing/canvas-hero-flow").then((mod) => mod.CanvasHeroFlow),
  { ssr: false }
)

const heroMorphingClassName = cn(
  "!mx-0 inline-flex h-[1.15em] min-h-[2.5rem] w-auto min-w-[12ch] max-w-none flex-none justify-center text-4xl font-extrabold uppercase leading-none tracking-tight text-foreground sm:min-h-[3rem] sm:text-5xl md:min-h-[3.75rem] md:text-6xl lg:h-[1.15em] lg:text-6xl"
)

function HeroHeadline({ layout }: { layout: "mobile" | "desktop" }) {
  return (
    <motion.h1
      variants={heroFadeUp}
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-balance font-extrabold uppercase leading-tight text-foreground sm:flex-row sm:flex-wrap sm:gap-x-3 sm:gap-y-1",
        layout === "mobile"
          ? "w-full max-w-3xl text-center text-4xl sm:text-5xl md:text-6xl"
          : "text-4xl sm:text-5xl md:text-6xl"
      )}
    >
      <span className="shrink-0">{landingHero.titlePrefix}</span>
      <MorphingText texts={landingHero.morphingTexts} className={heroMorphingClassName} />
    </motion.h1>
  )
}

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
        <motion.div
          className="relative z-20 flex min-h-[100svh] flex-col items-center justify-center px-4 pb-10 pt-28"
          initial="hidden"
          animate="visible"
          variants={heroList}
        >
          <HeroHeadline layout="mobile" />
          <motion.p
            variants={heroFadeUp}
            className="mx-auto -mt-2 w-full max-w-2xl text-pretty text-center text-sm text-muted-foreground sm:text-base"
          >
            {landingHero.description}
          </motion.p>
          <motion.div
            variants={heroFadeUp}
            className="mt-8 flex w-full max-w-3xl flex-col items-center justify-center gap-3 sm:flex-row"
          >
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
          </motion.div>

          <motion.div
            variants={heroFadeUp}
            className="mt-8 w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card/90 shadow-xl backdrop-blur-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mobileWorkflowPreview} alt="Workflow preview" className="h-auto w-full object-cover" />
          </motion.div>

          <motion.div variants={heroFadeUp} className="mx-auto mt-8 w-full max-w-4xl px-0">
            <HeroMockPromptBox />
          </motion.div>
        </motion.div>
      ) : (
        <div className="relative h-[100svh] w-full">
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4">
            <motion.div
              className="max-w-3xl text-center"
              initial="hidden"
              animate="visible"
              variants={heroList}
            >
              <HeroHeadline layout="desktop" />
              <motion.p
                variants={heroFadeUp}
                className="mx-auto -mt-2 max-w-xl text-pretty text-sm text-muted-foreground sm:text-base"
              >
                {landingHero.description}
              </motion.p>
              <motion.div
                variants={heroFadeUp}
                className="pointer-events-auto mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
              >
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
              </motion.div>
            </motion.div>
          </div>
          {/* Temporarily hidden: example prompt bar at bottom of hero
          <div className="pointer-events-none absolute bottom-0 left-1/2 z-30 w-full max-w-4xl -translate-x-1/2 px-4 pb-[env(safe-area-inset-bottom)] pt-0">
            <div className="pointer-events-auto pb-2">
              <HeroMockPromptBox />
            </div>
          </div>
          */}
          <CanvasHeroFlow />
        </div>
      )}
    </section>
  )
}
