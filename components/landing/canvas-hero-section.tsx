"use client"

import * as React from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { motion } from "framer-motion"
import { landingHero } from "@/lib/constants/landing-content"
import { Button } from "@/components/ui/button"

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
          <motion.p
            variants={heroFadeUp}
            className="mb-3 w-full max-w-3xl text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            {landingHero.eyebrow}
          </motion.p>
          <motion.h1
            variants={heroFadeUp}
            className="w-full max-w-3xl text-balance text-center text-4xl font-extrabold uppercase tracking-tighter leading-tight text-foreground sm:text-5xl md:text-6xl"
          >
            {landingHero.title}
          </motion.h1>
          <motion.p
            variants={heroFadeUp}
            className="mx-auto mt-4 w-full max-w-2xl text-pretty text-center text-sm text-muted-foreground sm:text-base"
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
              <motion.p
                variants={heroFadeUp}
                className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
              >
                {landingHero.eyebrow}
              </motion.p>
              <motion.h1
                variants={heroFadeUp}
                className="text-balance text-4xl font-extrabold uppercase tracking-tighter leading-tight text-foreground sm:text-5xl md:text-6xl"
              >
                {landingHero.title}
              </motion.h1>
              <motion.p
                variants={heroFadeUp}
                className="mx-auto mt-4 max-w-2xl text-pretty text-sm text-muted-foreground sm:text-base"
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
          <CanvasHeroFlow />
        </div>
      )}
    </section>
  )
}
