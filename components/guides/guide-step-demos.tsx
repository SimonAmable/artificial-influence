"use client"

import { useLayoutEffect, useRef } from "react"
import { gsap } from "gsap"
import { Check, MagicWand, Plus, X } from "@phosphor-icons/react"

import { GuideCarouselStepDemo } from "@/components/guides/guide-carousel-step-demos"
import { GuideFanvueStepDemo } from "@/components/guides/guide-fanvue-step-demos"
import {
  GuideDemoPromptToolbar,
  GuideDemoShell,
  ModernPointerCursor,
} from "@/components/guides/guide-demo-shell"
import type { GuideStepDemoId } from "@/lib/guides/types"

const CHARACTER_SRC = "/docs/new/ez_agent_content/base.png"

const BATCH_SHOTS = [
  "/docs/new/ez_agent_content/1_car.png",
  "/docs/new/ez_agent_content/2_restauraunt.png",
  "/docs/new/ez_agent_content/3_bedroom.png",
  "/docs/new/ez_agent_content/4_outdoor..png",
] as const

const CULL_SHOTS = BATCH_SHOTS

function MentionDemo() {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      const face = root.querySelector<HTMLElement>("[data-demo-face]")
      const cursor = root.querySelector<HTMLElement>("[data-demo-cursor]")
      const chip = root.querySelector<HTMLElement>("[data-demo-chip]")
      const mention = root.querySelector<HTMLElement>("[data-demo-mention]")
      const promptRest = root.querySelector<HTMLElement>("[data-demo-prompt-rest]")

      gsap.set([chip, mention], { opacity: 0, scale: 0.85 })
      gsap.set(promptRest, { opacity: 0.35 })
      gsap.set(cursor, { opacity: 1, x: 0, y: 0, scale: 1, rotate: -6 })

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.75 })

      tl.to(cursor, {
        x: 46,
        y: -34,
        duration: 0.55,
        ease: "power2.inOut",
      })
        .to(cursor, { scale: 0.88, duration: 0.1, yoyo: true, repeat: 1 })
        .to(face, { scale: 0.94, duration: 0.12, yoyo: true, repeat: 1 }, "<")
        .to(
          [chip, mention],
          { opacity: 1, scale: 1, duration: 0.35, stagger: 0.06, ease: "back.out(1.6)" },
          "-=0.05"
        )
        .to(promptRest, { opacity: 1, duration: 0.25 }, "-=0.2")
        .to({}, { duration: 1.1 })
        .to([chip, mention], { opacity: 0, scale: 0.9, duration: 0.25 })
        .to(promptRest, { opacity: 0.35, duration: 0.2 }, "<")
        .to(cursor, { x: 0, y: 0, duration: 0.4, ease: "power2.inOut" })
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <GuideDemoShell label="Demo: tap a character to insert an @ mention" className="min-h-[220px]">
      <div ref={rootRef} className="relative flex h-full min-h-[196px] flex-col gap-3">
        <div className="flex gap-2">
          <div className="flex aspect-square w-14 flex-col items-center justify-center rounded-xl border border-dashed border-primary/45 bg-background/50 backdrop-blur-sm">
            <Plus className="size-3.5 text-primary" weight="bold" />
            <span className="mt-0.5 text-[8px] font-bold">Create</span>
          </div>
          <div
            data-demo-face
            className="relative aspect-square w-14 overflow-hidden rounded-xl border-2 border-foreground ring-2 ring-foreground/70"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={CHARACTER_SRC} alt="" className="size-full object-cover object-top" />
          </div>
          <div className="aspect-square w-14 rounded-xl border border-border/40 bg-background/30 backdrop-blur-sm" />
        </div>

        <div className="relative flex-1 rounded-[18px] border border-border/60 bg-background/85 p-2.5 backdrop-blur-md">
          <div
            data-demo-chip
            className="mb-2 inline-flex overflow-hidden rounded-lg border border-border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={CHARACTER_SRC} alt="" className="h-10 w-10 object-cover object-top" />
          </div>
          <p className="text-[11px] leading-5 text-foreground/90">
            <span
              data-demo-mention
              className="mr-1 inline-flex items-center gap-1 rounded-sm bg-muted/70 px-1 py-0.5 align-middle"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={CHARACTER_SRC}
                alt=""
                className="size-3.5 rounded-full object-cover object-top"
              />
              <span className="font-medium">@maya</span>
            </span>
            <span data-demo-prompt-rest className="text-muted-foreground">
              coffee-shop still, soft window light, vertical 4:5
            </span>
          </p>
          <GuideDemoPromptToolbar />
        </div>

        <div
          data-demo-cursor
          className="pointer-events-none absolute left-[4.1rem] top-[3.4rem] z-20 origin-top-left text-foreground drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
          aria-hidden
        >
          <ModernPointerCursor className="size-6 -rotate-6" />
        </div>
      </div>
    </GuideDemoShell>
  )
}

function BatchDemo() {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      const typed = root.querySelector<HTMLElement>("[data-demo-typed]")
      const caret = root.querySelector<HTMLElement>("[data-demo-caret]")
      const shots = root.querySelectorAll<HTMLElement>("[data-demo-shot]")
      const full = "5 scene briefs · coffee, gym, night, mirror, street"

      if (typed) typed.textContent = ""
      gsap.set(shots, { opacity: 0, y: 10, scale: 0.92 })
      gsap.set(caret, { opacity: 1 })

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.9 })
      const typeProxy = { n: 0 }

      tl.to(typeProxy, {
        n: full.length,
        duration: 1.6,
        ease: "none",
        onUpdate: () => {
          if (typed) typed.textContent = full.slice(0, Math.floor(typeProxy.n))
        },
      })
        .to(caret, { opacity: 0, duration: 0.15 }, "+=0.15")
        .to(shots, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.35,
          stagger: 0.1,
          ease: "power2.out",
        })
        .to({}, { duration: 1.2 })
        .to(shots, { opacity: 0, y: 6, duration: 0.25, stagger: 0.04 })
        .add(() => {
          if (typed) typed.textContent = ""
        })
        .to(caret, { opacity: 1, duration: 0.15 })
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <GuideDemoShell label="Demo: type a week brief then generate five stills" className="min-h-[220px]">
      <div ref={rootRef} className="flex min-h-[196px] flex-col gap-3">
        <div className="grid grid-cols-4 gap-1.5">
          {BATCH_SHOTS.map((src) => (
            <div
              key={src}
              data-demo-shot
              className="aspect-[3/4] overflow-hidden rounded-lg border border-border/50 bg-background/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="size-full object-cover object-top" />
            </div>
          ))}
        </div>

        <div className="rounded-[18px] border border-border/60 bg-background/85 p-2.5 backdrop-blur-md">
          <p className="min-h-10 text-[11px] leading-5 text-foreground/90">
            <span className="mr-1 inline-flex items-center gap-1 rounded-sm bg-muted/70 px-1 py-0.5 align-middle">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={CHARACTER_SRC}
                alt=""
                className="size-3.5 rounded-full object-cover object-top"
              />
              <span className="font-medium">@maya</span>
            </span>
            <span data-demo-typed />
            <span
              data-demo-caret
              className="ml-0.5 inline-block h-3 w-px translate-y-0.5 bg-foreground"
              aria-hidden
            />
          </p>
          <GuideDemoPromptToolbar showAttach={false} />
        </div>
      </div>
    </GuideDemoShell>
  )
}

function CullDemo() {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      const shots = Array.from(root.querySelectorAll<HTMLElement>("[data-demo-shot]"))
      const rejects = Array.from(root.querySelectorAll<HTMLElement>("[data-demo-reject]"))
      const keepMarks = Array.from(root.querySelectorAll<HTMLElement>("[data-demo-keep]"))
      const badge = root.querySelector<HTMLElement>("[data-demo-badge]")
      const enhance = root.querySelector<HTMLElement>("[data-demo-enhance]")
      const hero = root.querySelector<HTMLElement>("[data-demo-hero]")
      const keepers = shots.filter((shot) => shot.dataset.demoKeeper === "true")

      gsap.set(shots, { opacity: 1, scale: 1, filter: "grayscale(0)" })
      gsap.set([...rejects, ...keepMarks, badge, enhance], { opacity: 0, scale: 0.85 })
      gsap.set(hero, { opacity: 0, y: 8, scale: 0.96 })

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.75 })

      tl.to(shots.filter((s) => s.dataset.demoKeeper !== "true"), {
        opacity: 0.3,
        scale: 0.9,
        filter: "grayscale(1)",
        duration: 0.4,
        stagger: 0.07,
        ease: "power2.out",
      })
        .to(rejects, { opacity: 1, scale: 1, duration: 0.25, stagger: 0.06 }, "-=0.15")
        .to(keepers, { scale: 1.05, duration: 0.28, stagger: 0.05, ease: "power2.out" }, "-=0.2")
        .to(keepMarks, { opacity: 1, scale: 1, duration: 0.25, stagger: 0.05 }, "-=0.1")
        .to(badge, { opacity: 1, scale: 1, duration: 0.28 }, "-=0.05")
        .to(enhance, { opacity: 1, scale: 1, duration: 0.28 }, "-=0.15")
        .to(enhance, { scale: 1.06, duration: 0.18, yoyo: true, repeat: 1 })
        .to(hero, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: "power2.out" }, "-=0.1")
        .to({}, { duration: 1.15 })
        .to([badge, enhance, hero, ...rejects, ...keepMarks], {
          opacity: 0,
          scale: 0.9,
          duration: 0.25,
        })
        .to(shots, {
          opacity: 1,
          scale: 1,
          filter: "grayscale(0)",
          duration: 0.35,
        })
    }, root)

    return () => ctx.revert()
  }, [])

  const heroSrc = CULL_SHOTS[1]

  return (
    <GuideDemoShell label="Demo: cull weak shots and enhance keepers" className="min-h-[220px]">
      <div ref={rootRef} className="relative flex min-h-[196px] flex-col gap-2.5">
        <div className="grid grid-cols-4 gap-1.5">
          {CULL_SHOTS.map((src, index) => {
            const isKeeper = index < 3
            return (
              <div
                key={src}
                data-demo-shot
                data-demo-keeper={isKeeper ? "true" : undefined}
                className="relative aspect-[3/4] overflow-hidden rounded-lg border border-border/50 bg-background/40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="size-full object-cover object-top" />
                {isKeeper ? (
                  <span
                    data-demo-keep
                    className="absolute right-0.5 top-0.5 inline-flex size-4 items-center justify-center rounded-full bg-foreground text-background"
                  >
                    <Check className="size-2.5" weight="bold" />
                  </span>
                ) : (
                  <span
                    data-demo-reject
                    className="absolute right-0.5 top-0.5 inline-flex size-4 items-center justify-center rounded-full bg-background/90 text-foreground"
                  >
                    <X className="size-2.5" weight="bold" />
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <div
          data-demo-hero
          className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/85 p-1.5 backdrop-blur-md"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroSrc} alt="" className="size-11 rounded-lg object-cover object-top" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-semibold tracking-tight">Keeper enhanced</p>
            <p className="truncate text-[9px] text-muted-foreground">Ready for Library</p>
          </div>
          <span className="mr-1 inline-flex size-6 items-center justify-center rounded-full bg-foreground text-background">
            <MagicWand className="size-3" weight="bold" />
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span
            data-demo-badge
            className="rounded-full border border-border bg-background/85 px-2.5 py-1 text-[10px] font-semibold tracking-tight backdrop-blur-sm"
          >
            7+ keepers saved
          </span>
          <span
            data-demo-enhance
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background/85 px-2.5 py-1 text-[10px] font-medium text-muted-foreground backdrop-blur-sm"
          >
            <MagicWand className="size-3" weight="bold" />
            Enhance
          </span>
        </div>
      </div>
    </GuideDemoShell>
  )
}

export function GuideStepDemo({ demoId }: { demoId: GuideStepDemoId }) {
  switch (demoId) {
    case "mention":
      return <MentionDemo />
    case "batch":
      return <BatchDemo />
    case "cull":
      return <CullDemo />
    case "shots-upload":
    case "shots-settings":
    case "shots-generate":
      return <GuideCarouselStepDemo demoId={demoId} />
    case "fanvue-connect":
    case "fanvue-media":
    case "fanvue-publish":
      return <GuideFanvueStepDemo demoId={demoId} />
    default: {
      const _exhaustive: never = demoId
      return _exhaustive
    }
  }
}
