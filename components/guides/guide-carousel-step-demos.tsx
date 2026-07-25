"use client"

import { useLayoutEffect, useRef } from "react"
import { gsap } from "gsap"
import { UploadSimple } from "@phosphor-icons/react"

import {
  GuideDemoShell,
  ModernPointerCursor,
} from "@/components/guides/guide-demo-shell"
import { CAROUSEL_SHOTS_EXAMPLE } from "@/lib/carousel-shots/constants"
import { cn } from "@/lib/utils"

export type CarouselGuideDemoId = "shots-upload" | "shots-settings" | "shots-generate"

const DEMO_FRAME = "h-[220px]"

const REF_SRC = CAROUSEL_SHOTS_EXAMPLE.slideUrls[0]
const GRID_SRC = CAROUSEL_SHOTS_EXAMPLE.slideUrls

function ShotsUploadDemo() {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      const card = root.querySelector<HTMLElement>("[data-demo-card]")
      const preview = root.querySelector<HTMLElement>("[data-demo-preview]")
      const empty = root.querySelector<HTMLElement>("[data-demo-empty]")
      const drag = root.querySelector<HTMLElement>("[data-demo-drag]")
      const cursor = root.querySelector<HTMLElement>("[data-demo-cursor]")

      gsap.set(preview, { opacity: 0, scale: 0.92 })
      gsap.set(empty, { opacity: 1 })
      gsap.set(card, { borderStyle: "dashed", borderColor: "color-mix(in oklab, var(--border) 70%, transparent)" })
      gsap.set(drag, { opacity: 1, x: 0, y: 0, scale: 1, rotate: -4 })
      gsap.set(cursor, { opacity: 1, x: 0, y: 0, scale: 1, rotate: -6 })

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.75 })

      // Move to the floating thumbnail and "grab" it
      tl.to(cursor, { x: 8, y: 6, duration: 0.4, ease: "power2.inOut" })
        .to(cursor, { scale: 0.86, duration: 0.12 })
        .to(drag, { scale: 0.94, duration: 0.12 }, "<")
        // Drag thumbnail + cursor into the drop zone together
        .to(
          [cursor, drag],
          {
            x: 54,
            y: -78,
            duration: 0.75,
            ease: "power2.inOut",
          },
          "+=0.05"
        )
        .to(
          card,
          {
            borderStyle: "solid",
            borderColor: "var(--foreground)",
            scale: 1.02,
            duration: 0.25,
            ease: "power2.out",
          },
          "-=0.25"
        )
        // Drop: release cursor, thumbnail merges into zone
        .to(cursor, { scale: 1, duration: 0.12 })
        .to(drag, { opacity: 0, scale: 0.7, duration: 0.28, ease: "power2.in" }, "<")
        .to(empty, { opacity: 0, duration: 0.2 }, "-=0.1")
        .to(preview, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(1.35)" })
        .to(card, { scale: 1, duration: 0.2 }, "<")
        .to(cursor, { x: 72, y: -40, duration: 0.35, ease: "power2.out" }, "-=0.15")
        .to({}, { duration: 1.1 })
        // Reset
        .to(preview, { opacity: 0, scale: 0.92, duration: 0.25 })
        .to(empty, { opacity: 1, duration: 0.2 }, "-=0.1")
        .to(card, {
          borderStyle: "dashed",
          borderColor: "color-mix(in oklab, var(--border) 70%, transparent)",
          duration: 0.2,
        }, "<")
        .set(drag, { opacity: 1, x: 0, y: 0, scale: 1 })
        .to(cursor, { x: 0, y: 0, duration: 0.4, ease: "power2.inOut" })
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <GuideDemoShell label="Demo: drag a reference photo into the upload area" className={DEMO_FRAME}>
      <div ref={rootRef} className="relative flex h-full min-h-0 flex-col justify-center gap-3 overflow-hidden">
        <div
          data-demo-card
          className="relative mx-auto flex h-36 w-full max-w-[200px] items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border/70 bg-background/70 backdrop-blur-md"
        >
          <div
            data-demo-empty
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground"
          >
            <UploadSimple className="size-6" weight="bold" />
            <span className="text-[10px] font-semibold tracking-tight">Reference photo</span>
            <span className="text-[9px]">Drop image here</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            data-demo-preview
            src={REF_SRC}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        </div>

        {/* Draggable source thumbnail — starts bottom-left */}
        <div
          data-demo-drag
          className="pointer-events-none absolute bottom-2 left-3 z-10 size-14 overflow-hidden rounded-xl border-2 border-background shadow-lg ring-1 ring-border/60"
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={REF_SRC} alt="" className="size-full object-cover" />
        </div>

        <div
          data-demo-cursor
          className="pointer-events-none absolute bottom-4 left-12 z-20 origin-top-left text-foreground drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
          aria-hidden
        >
          <ModernPointerCursor className="size-6 -rotate-6" />
        </div>
      </div>
    </GuideDemoShell>
  )
}

function ShotsSettingsDemo() {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      const pills = Array.from(root.querySelectorAll<HTMLElement>("[data-demo-pill]"))
      gsap.set(pills, { outlineWidth: 0, scale: 1 })

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.55 })
      pills.forEach((pill) => {
        tl.to(pill, {
          scale: 1.05,
          outlineColor: "currentColor",
          outlineStyle: "solid",
          outlineWidth: 1.5,
          outlineOffset: 2,
          duration: 0.28,
          ease: "power2.out",
        }).to(pill, {
          scale: 1,
          outlineWidth: 0,
          duration: 0.22,
          delay: 0.35,
        })
      })
    }, root)

    return () => ctx.revert()
  }, [])

  const rows = [
    { label: "Grid size", options: ["4 shots", "9 shots"], active: 0 },
    { label: "Panel aspect", options: ["9:16", "4:5", "3:4"], active: 0 },
    { label: "Variation", options: ["Subtle", "Natural", "Creative"], active: 1 },
  ] as const

  return (
    <GuideDemoShell label="Demo: pick grid, aspect, and variation" className={DEMO_FRAME}>
      <div ref={rootRef} className="flex h-full min-h-0 flex-col justify-center gap-3">
        {rows.map((row) => (
          <div key={row.label} className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {row.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {row.options.map((option, index) => (
                <span
                  key={option}
                  data-demo-pill={index === row.active ? "active" : undefined}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-tight",
                    index === row.active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border/70 bg-background/70 text-muted-foreground"
                  )}
                >
                  {option}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </GuideDemoShell>
  )
}

function ShotsGenerateDemo() {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      const button = root.querySelector<HTMLElement>("[data-demo-generate]")
      const shots = root.querySelectorAll<HTMLElement>("[data-demo-shot]")
      const cursor = root.querySelector<HTMLElement>("[data-demo-cursor]")

      gsap.set(shots, { opacity: 0, scale: 0.9 })
      gsap.set(cursor, { opacity: 1, x: 0, y: 0, scale: 1, rotate: -6 })

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.85 })

      tl.to(cursor, { x: 18, y: -8, duration: 0.45, ease: "power2.inOut" })
        .to(cursor, { scale: 0.88, duration: 0.1, yoyo: true, repeat: 1 })
        .to(button, { scale: 0.96, duration: 0.12, yoyo: true, repeat: 1 }, "<")
        .to(shots, {
          opacity: 1,
          scale: 1,
          duration: 0.4,
          stagger: 0.12,
          ease: "power2.out",
        })
        .to({}, { duration: 1.2 })
        .to(shots, { opacity: 0, scale: 0.92, duration: 0.28, stagger: 0.05 })
        .to(cursor, { x: 0, y: 0, duration: 0.35, ease: "power2.inOut" })
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <GuideDemoShell label="Demo: generate a matching shot set" className={DEMO_FRAME}>
      <div ref={rootRef} className="relative flex h-full min-h-0 flex-col gap-2">
        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-1.5">
          {GRID_SRC.map((src) => (
            <div
              key={src}
              data-demo-shot
              className="min-h-0 overflow-hidden rounded-lg border border-border/50 bg-background/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="size-full object-cover" />
            </div>
          ))}
        </div>

        <div className="relative flex shrink-0 justify-center pb-0.5">
          <span
            data-demo-generate
            className="inline-flex items-center rounded-full border border-white/20 bg-black/55 px-4 py-1.5 text-[11px] font-semibold tracking-tight text-white backdrop-blur-md"
          >
            Generate
          </span>
          <div
            data-demo-cursor
            className="pointer-events-none absolute left-[58%] top-0.5 origin-top-left text-foreground drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
            aria-hidden
          >
            <ModernPointerCursor className="size-6 -rotate-6" />
          </div>
        </div>
      </div>
    </GuideDemoShell>
  )
}

export function GuideCarouselStepDemo({ demoId }: { demoId: CarouselGuideDemoId }) {
  switch (demoId) {
    case "shots-upload":
      return <ShotsUploadDemo />
    case "shots-settings":
      return <ShotsSettingsDemo />
    case "shots-generate":
      return <ShotsGenerateDemo />
    default: {
      const _exhaustive: never = demoId
      return _exhaustive
    }
  }
}
