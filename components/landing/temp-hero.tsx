"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const heroBackgroundMedia = [
  { kind: "video" as const, src: "/hero_showcase_images/demo_hero_vids/compressed/d1.webm" },
  { kind: "video" as const, src: "/hero_showcase_images/demo_hero_vids/compressed/d2.webm" },
  { kind: "video" as const, src: "/hero_showcase_images/demo_hero_vids/compressed/d3.webm" },
  { kind: "video" as const, src: "/hero_showcase_images/demo_hero_vids/compressed/d4.webm" },
]

const heroEase = [0.22, 1, 0.36, 1] as const

export function TempHero() {
  const [activeMediaIndex, setActiveMediaIndex] = React.useState(0)
  const activeMedia = heroBackgroundMedia[activeMediaIndex]
  const prefersReducedMotion = useReducedMotion()

  const showNextMedia = React.useCallback(() => {
    setActiveMediaIndex((currentIndex) => (currentIndex + 1) % heroBackgroundMedia.length)
  }, [])

  const fadeUp = React.useCallback(
    (delay: number) => ({
      initial: { opacity: 0, y: prefersReducedMotion ? 0 : 18 },
      animate: {
        opacity: 1,
        y: 0,
        transition: {
          duration: prefersReducedMotion ? 0.01 : 0.72,
          delay: prefersReducedMotion ? 0 : delay,
          ease: heroEase,
        },
      },
    }),
    [prefersReducedMotion]
  )

  return (
    <section className="relative isolate overflow-visible bg-background px-0 pb-[10rem] pt-0 text-foreground md:px-6 md:pb-[24rem] md:pt-[60px]">
      <div className="relative mx-auto flex min-h-[100svh] w-full flex-col items-center overflow-hidden rounded-none border-0 bg-background shadow-none md:h-[calc(100svh-7.5rem)] md:min-h-0 md:w-[min(calc((100svh-7.5rem)*0.62),42rem)] md:rounded-[2.5rem] md:border md:border-border/60 md:shadow-[0_28px_90px_rgba(15,23,42,0.12)] dark:md:shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: prefersReducedMotion ? 0.01 : 0.9, ease: heroEase }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeMedia.src}
              initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.985 }}
              transition={{ duration: prefersReducedMotion ? 0.01 : 0.45, ease: heroEase }}
              className="absolute inset-0"
            >
              <video
                autoPlay
                muted
                playsInline
                preload="auto"
                onEnded={showNextMedia}
                className="absolute inset-0 h-full w-full object-cover object-center"
              >
                <source src={activeMedia.src} type="video/webm" />
              </video>
            </motion.div>
          </AnimatePresence>
          <motion.div
            className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_34%)] dark:bg-[radial-gradient(circle_at_top,rgba(85,145,255,0.26),transparent_34%)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.7, delay: prefersReducedMotion ? 0 : 0.04, ease: heroEase }}
          />
          <motion.div
            className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/35 to-background/95 dark:from-background/15 dark:via-background/45 dark:to-background/95"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.7, delay: prefersReducedMotion ? 0 : 0.08, ease: heroEase }}
          />
          <motion.div
            className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-sky-300/20 via-transparent to-transparent dark:from-sky-400/28"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.7, delay: prefersReducedMotion ? 0 : 0.12, ease: heroEase }}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.7, delay: prefersReducedMotion ? 0 : 0.16, ease: heroEase }}
          />
        </motion.div>

        <div className="relative z-20 flex w-full flex-1 flex-col items-center px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-24 md:px-7 md:pb-24 md:pt-14 lg:px-8">
          <div className="mx-auto mt-7 max-w-5xl">
            <motion.h1
              {...fadeUp(0.08)}
              className="text-balance text-3xl font-semibold leading-[0.94] tracking-[-0.05em] text-primary-foreground sm:text-4xl md:text-4xl lg:text-5xl xl:text-5xl dark:text-white"
            >
              Introducing vibe marketing
            </motion.h1>
            <motion.div {...fadeUp(0.2)} className="relative mt-5 w-full">
              <div className="pointer-events-none absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 bg-black/28 backdrop-blur-[2px] dark:bg-black/38" />
              <p className="relative mx-auto max-w-2xl px-4 py-0.5 text-pretty text-sm font-semibold leading-6 text-primary-foreground/90 sm:px-6 sm:text-base md:text-base dark:text-white/84">
                Like Cursor, but for marketing. Create AI UGC, AI influencer content, brainrot,
                CGI-style campaigns, and static ads with natural language, and even schedule posts
                to Instagram automatically.
              </p>
            </motion.div>
          </div>

          <motion.div
            {...fadeUp(0.32)}
            className="mt-8 flex w-full max-w-md flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link href="/login?mode=signup" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="h-12 w-full rounded-full bg-background/92 px-6 text-sm font-semibold text-foreground shadow-lg shadow-black/10 backdrop-blur-sm hover:bg-background dark:bg-white dark:text-black dark:hover:bg-white/90"
              >
                Start free
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </Link>
            <Link href="/#pricing" className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="h-12 w-full rounded-full border-border/70 bg-background/10 px-6 text-sm font-semibold text-primary-foreground backdrop-blur-sm hover:bg-background/20 dark:border-white/20 dark:bg-black/20 dark:text-white dark:hover:bg-white/10"
              >
                View pricing
              </Button>
            </Link>
          </motion.div>

        </div>
      </div>

      <motion.div
        {...fadeUp(0.46)}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-0 md:px-6"
      >
        <div className="w-full max-w-6xl translate-y-[24%] md:translate-y-[20%]">
          <div className="relative mx-auto hidden aspect-[16/9.2] w-full max-w-[1120px] overflow-hidden rounded-[1.75rem] border border-border/60 bg-card/95 shadow-[0_22px_70px_rgba(15,23,42,0.12)] dark:shadow-[0_22px_70px_rgba(0,0,0,0.55)] md:block">
            <Image
              src="/page_screenshots_or_screenrecordings/agent.png"
              alt="UniCan agent screenshot"
              fill
              className="object-contain object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/18 via-transparent to-transparent dark:from-black/28" />
          </div>

          <div className="relative mx-auto aspect-[16/9.2] w-[min(92vw,30rem)] overflow-hidden rounded-[1.4rem] border border-border/60 bg-card/95 shadow-[0_22px_70px_rgba(15,23,42,0.12)] dark:shadow-[0_22px_70px_rgba(0,0,0,0.55)] md:hidden">
            <Image
              src="/page_screenshots_or_screenrecordings/agent.png"
              alt="UniCan desktop preview"
              fill
              className="object-contain object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/18 via-transparent to-transparent dark:from-black/32" />
          </div>
        </div>
      </motion.div>
    </section>
  )
}
