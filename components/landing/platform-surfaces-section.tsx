"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"

import { platformSurfaceCards } from "@/lib/constants/landing-content"
import type { LandingPlatformSurfaceCard } from "@/lib/types/landing"
import { AutomationLogoConnection } from "@/components/landing/automation-logo-connection"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

/** Full-bleed layer on top of media, uses design-system largest depth (`--shadow-l` via `shadow-lg` in globals.css). */
const mediaSurfaceOverlayClass =
  "pointer-events-none absolute inset-0 z-10 rounded-xl shadow-lg"

function PlatformSurfaceImagePanel({
  card,
}: {
  card: Extract<LandingPlatformSurfaceCard, { kind: "image" }>
}) {
  return (
    <div className="flex w-full flex-col gap-4">
      <Link
        href={card.href}
        className="relative block w-full rounded-xl outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`Open ${card.name}`}
      >
        <div className="overflow-hidden rounded-xl">
          <Image
            src={encodeURI(card.imageSrc)}
            alt={card.imageAlt}
            width={1200}
            height={700}
            className="relative z-0 block h-auto w-full object-cover object-top"
            sizes="(max-width: 896px) 100vw, 896px"
            priority={card.id === "generator"}
          />
        </div>
        <div className={mediaSurfaceOverlayClass} aria-hidden />
      </Link>
      <p className="w-full text-sm text-muted-foreground sm:text-base">{card.description}</p>
    </div>
  )
}

function PlatformSurfaceAutomationPanel({
  card,
}: {
  card: Extract<LandingPlatformSurfaceCard, { kind: "automation" }>
}) {
  return (
    <div className="flex w-full flex-col gap-4">
      <Link
        href={card.href}
        className="relative block w-full rounded-xl outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`Open ${card.name}`}
      >
        <div
          className="relative overflow-hidden rounded-xl"
          style={{ aspectRatio: "1203/753" }}
        >
          <div className="absolute inset-0 z-0 min-h-0">
            <AutomationLogoConnection fillContainer className="h-full rounded-none" />
          </div>
        </div>
        <div className={mediaSurfaceOverlayClass} aria-hidden />
      </Link>
      <p className="w-full text-sm text-muted-foreground sm:text-base">{card.description}</p>
    </div>
  )
}

function renderActivePanel(card: LandingPlatformSurfaceCard) {
  return card.kind === "image" ? (
    <PlatformSurfaceImagePanel card={card} />
  ) : (
    <PlatformSurfaceAutomationPanel card={card} />
  )
}

export function PlatformSurfacesSection() {
  const defaultTab = platformSurfaceCards[0]?.id ?? "generator"
  const [tab, setTab] = React.useState(defaultTab)
  const [reduceMotion, setReduceMotion] = React.useState(false)
  const sectionGutterClass = "px-4 sm:px-6 lg:px-8"

  const prevIndexRef = React.useRef(0)

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduceMotion(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  const activeIndex = Math.max(
    0,
    platformSurfaceCards.findIndex((c) => c.id === tab),
  )
  const slideCount = platformSurfaceCards.length
  const segmentPercent = 100 / slideCount

  React.useLayoutEffect(() => {
    prevIndexRef.current = activeIndex
  }, [activeIndex])

  const indexDelta = Math.abs(activeIndex - prevIndexRef.current)
  const transitionDuration =
    reduceMotion ? 0.01 : indexDelta === 0 ? 0 : Math.min(1.1, 0.28 + indexDelta * 0.22)

  const activeCard = platformSurfaceCards[activeIndex]
  const blurbTransition = { duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] as const }

  return (
    <section className="w-full bg-background py-16 sm:py-24">
      <div className={`mx-auto w-full max-w-7xl ${sectionGutterClass}`}>
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
            Get every tool in one place
          </h2>
          {activeCard ? (
            <div className="mt-4" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={tab}
                  className="text-muted-foreground"
                  initial={reduceMotion ? false : { opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                  transition={blurbTransition}
                >
                  {activeCard.sectionBlurb}
                </motion.p>
              </AnimatePresence>
            </div>
          ) : null}
        </div>
      </div>

      <div className="relative mt-10 sm:mt-12">
        <Tabs
          value={tab}
          onValueChange={setTab}
          className="mx-auto flex w-full max-w-7xl flex-col items-stretch"
        >
          <div className={`mx-auto w-full max-w-4xl ${sectionGutterClass}`}>
            <TabsList
              variant="default"
              className="!mx-auto grid !h-auto min-h-12 w-full max-w-4xl grid-cols-2 gap-1 rounded-4xl border-0 bg-transparent p-1 sm:min-h-11 sm:grid-cols-4"
            >
              {platformSurfaceCards.map((card) => (
                <TabsTrigger
                  key={card.id}
                  value={card.id}
                  id={`platform-surface-tab-${card.id}`}
                  aria-controls="platform-surface-panel"
                  className="flex min-h-10 w-full shrink-0 items-center justify-center rounded-2xl border border-transparent px-2 py-2 text-center text-xs font-medium text-muted-foreground transition-[color,box-shadow,border-color,background-color] hover:text-foreground data-active:border-border/80 data-active:bg-background data-active:text-foreground data-active:shadow-sm dark:data-active:border-border/60 dark:data-active:bg-card/90 sm:min-h-9 sm:px-3 sm:text-sm"
                >
                  {card.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div
            role="tabpanel"
            id="platform-surface-panel"
            aria-labelledby={`platform-surface-tab-${tab}`}
            className="relative mt-8 w-full overflow-hidden outline-none sm:mt-10"
          >
            <motion.div
              className="flex"
              style={{ width: `${slideCount * 100}%` }}
              animate={{
                x: `-${activeIndex * segmentPercent}%`,
              }}
              transition={{
                duration: transitionDuration,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {platformSurfaceCards.map((card) => (
                <div
                  key={card.id}
                  className="shrink-0 px-0"
                  style={{ width: `${segmentPercent}%` }}
                  aria-hidden={card.id !== tab}
                  inert={card.id !== tab ? true : undefined}
                >
                  {renderActivePanel(card)}
                </div>
              ))}
            </motion.div>
          </div>
        </Tabs>
      </div>
    </section>
  )
}
