"use client"

import { useLayoutEffect, useRef } from "react"
import Image from "next/image"
import { ArrowUp, Check, CurrencyDollar, LockKey, Plus } from "@phosphor-icons/react"
import { gsap } from "gsap"

import { AuroraShaderBackground } from "@/components/ui/aurora-shader-background"

const INFLUENCER_BASE = "/docs/new/influencer/base.png"
const INFLUENCER_REFS = [
  "/docs/new/influencer/merge_ref_1.jpg",
  "/docs/new/influencer/merge_ref_2.jpg",
] as const

const AGENT_BASE = "/docs/new/ez_agent_content/base.png"
const AGENT_OUTPUTS = [
  "/docs/new/ez_agent_content/1_car.png",
  "/docs/new/ez_agent_content/2_restauraunt.png",
  "/docs/new/ez_agent_content/3_bedroom.png",
  "/docs/new/ez_agent_content/4_outdoor..png",
] as const

const SHOTS_OUTPUTS = [
  "/docs/new/shots/slide-01.png",
  "/docs/new/shots/slide-02.png",
  "/docs/new/shots/slide-04.png",
  "/docs/new/shots/slide-05.png",
  "/docs/new/shots/slide-03.png",
  "/docs/new/shots/slide-06.png",
  "/docs/new/shots/slide-07.png",
  "/docs/new/shots/slide-08.png",
  "/docs/new/shots/slide-09.png",
] as const

function ShowcaseSurface({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[inherit] bg-[#0a0a0a]">
      <AuroraShaderBackground animate className="rounded-[inherit]" />
      <div className="absolute inset-0 bg-background/45" aria-hidden />
      <div className="relative z-10 size-full">{children}</div>
    </div>
  )
}

export function InfluencerMergeShowcase() {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const context = gsap.context(() => {
      const left = root.querySelector<HTMLElement>("[data-merge-left]")
      const right = root.querySelector<HTMLElement>("[data-merge-right]")
      const result = root.querySelector<HTMLElement>("[data-merge-result]")
      const plus = root.querySelector<HTMLElement>("[data-merge-plus]")
      const label = root.querySelector<HTMLElement>("[data-merge-label]")

      gsap.set(left, { x: 0, rotate: -7, opacity: 1, scale: 1 })
      gsap.set(right, { x: 0, rotate: 7, opacity: 1, scale: 1 })
      gsap.set(result, { opacity: 0, scale: 0.72, rotate: -2 })
      gsap.set(label, { opacity: 0, y: 5 })

      const timeline = gsap.timeline({ repeat: -1, repeatDelay: 0.7 })
      timeline
        .to(left, { x: 54, rotate: 0, scale: 0.88, duration: 0.7, ease: "power3.inOut" })
        .to(right, { x: -54, rotate: 0, scale: 0.88, duration: 0.7, ease: "power3.inOut" }, "<")
        .to(plus, { opacity: 0, scale: 0.5, duration: 0.2 }, "-=0.25")
        .to([left, right], { opacity: 0, scale: 0.68, duration: 0.35 }, "-=0.1")
        .to(result, { opacity: 1, scale: 1, rotate: 0, duration: 0.55, ease: "back.out(1.35)" }, "-=0.25")
        .to(label, { opacity: 1, y: 0, duration: 0.3 }, "-=0.2")
        .to({}, { duration: 1.15 })
        .to([result, label], { opacity: 0, scale: 0.9, duration: 0.3 })
        .set(left, { x: 0, rotate: -7, scale: 1, opacity: 1 })
        .set(right, { x: 0, rotate: 7, scale: 1, opacity: 1 })
        .set(plus, { opacity: 1, scale: 1 })
    }, root)

    return () => context.revert()
  }, [])

  return (
    <ShowcaseSurface>
      <div ref={rootRef} className="relative flex size-full items-center justify-center">
        <div
          data-merge-left
          className="absolute left-[12%] top-[20%] h-[62%] w-[34%] overflow-hidden rounded-xl border border-white/15 shadow-xl"
        >
          <Image src={INFLUENCER_REFS[0]} alt="" fill sizes="20vw" className="object-cover" />
        </div>
        <div
          data-merge-right
          className="absolute right-[12%] top-[20%] h-[62%] w-[34%] overflow-hidden rounded-xl border border-white/15 shadow-xl"
        >
          <Image src={INFLUENCER_REFS[1]} alt="" fill sizes="20vw" className="object-cover" />
        </div>
        <span
          data-merge-plus
          className="absolute z-20 inline-flex size-8 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white shadow-lg backdrop-blur-md"
        >
          <Plus className="size-4" weight="bold" />
        </span>
        <div
          data-merge-result
          className="absolute top-[12%] h-[70%] w-[46%] overflow-hidden rounded-2xl border border-white/20 shadow-2xl"
        >
          <Image src={INFLUENCER_BASE} alt="" fill sizes="24vw" className="object-cover object-top" />
        </div>
        <span
          data-merge-label
          className="absolute bottom-[7%] rounded-full border border-white/15 bg-black/65 px-3 py-1 text-[10px] font-semibold text-white shadow-lg backdrop-blur-md"
        >
          AI influencer created
        </span>
      </div>
    </ShowcaseSurface>
  )
}

export function AgentGenerationShowcase() {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const context = gsap.context(() => {
      const outputs = root.querySelectorAll<HTMLElement>("[data-agent-output]")
      const typed = root.querySelector<HTMLElement>("[data-agent-typed]")
      const caret = root.querySelector<HTMLElement>("[data-agent-caret]")
      const prompt = "Create four candid lifestyle shots with this character"
      const proxy = { count: 0 }

      gsap.set(outputs, { opacity: 0, y: 10, scale: 0.9 })
      if (typed) typed.textContent = ""

      const timeline = gsap.timeline({ repeat: -1, repeatDelay: 0.8 })
      timeline
        .to(proxy, {
          count: prompt.length,
          duration: 1.25,
          ease: "none",
          onUpdate: () => {
            if (typed) typed.textContent = prompt.slice(0, Math.floor(proxy.count))
          },
        })
        .to(caret, { opacity: 0, duration: 0.12 }, "+=0.1")
        .to(outputs, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.38,
          stagger: 0.12,
          ease: "power2.out",
        })
        .to({}, { duration: 1.15 })
        .to(outputs, { opacity: 0, y: 7, scale: 0.94, duration: 0.25, stagger: 0.04 })
        .add(() => {
          proxy.count = 0
          if (typed) typed.textContent = ""
        })
        .to(caret, { opacity: 1, duration: 0.12 })
    }, root)

    return () => context.revert()
  }, [])

  return (
    <ShowcaseSurface>
      <div ref={rootRef} className="flex size-full flex-col gap-2 p-3">
        <div className="grid min-h-0 flex-1 grid-cols-4 items-center gap-1.5">
          {AGENT_OUTPUTS.map((src) => (
            <div
              key={src}
              data-agent-output
              className="relative aspect-[4/5] w-full"
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="12vw"
                className="object-cover drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]"
              />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-white/15 bg-background/85 p-2 shadow-xl backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-2">
            <span className="relative size-8 shrink-0 overflow-hidden rounded-lg border border-border/70">
              <Image src={AGENT_BASE} alt="" fill sizes="32px" className="object-contain" />
            </span>
            <p className="min-w-0 flex-1 text-[9px] leading-4 text-foreground/90 sm:text-[10px]">
              <span data-agent-typed />
              <span
                data-agent-caret
                className="ml-0.5 inline-block h-2.5 w-px translate-y-0.5 bg-foreground"
                aria-hidden
              />
            </p>
            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
              <ArrowUp className="size-3.5" weight="bold" />
            </span>
          </div>
        </div>
      </div>
    </ShowcaseSurface>
  )
}

export function ShotsGridShowcase() {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const context = gsap.context(() => {
      const shots = Array.from(root.querySelectorAll<HTMLElement>("[data-shots-frame]"))
      const center = shots[4]
      const others = shots.filter((_, index) => index !== 4)
      const badge = root.querySelector<HTMLElement>("[data-shots-badge]")

      gsap.set(others, { opacity: 0, scale: 0.72 })
      gsap.set(center, { scale: 2.75, zIndex: 20 })
      gsap.set(badge, { opacity: 0, y: 5 })

      const timeline = gsap.timeline({ repeat: -1, repeatDelay: 0.75 })
      timeline
        .to({}, { duration: 0.7 })
        .to(center, { scale: 1, zIndex: 1, duration: 0.65, ease: "power3.inOut" })
        .to(
          others,
          {
            opacity: 1,
            scale: 1,
            duration: 0.38,
            stagger: { each: 0.055, from: "center" },
            ease: "back.out(1.25)",
          },
          "-=0.18",
        )
        .to(badge, { opacity: 1, y: 0, duration: 0.28 }, "-=0.16")
        .to({}, { duration: 1.15 })
        .to([badge, ...others], { opacity: 0, scale: 0.78, duration: 0.28 })
        .to(center, { scale: 2.75, zIndex: 20, duration: 0.5, ease: "power3.inOut" }, "-=0.12")
    }, root)

    return () => context.revert()
  }, [])

  return (
    <ShowcaseSurface>
      <div ref={rootRef} className="relative flex size-full items-center justify-center p-3">
        <div className="grid h-full max-h-full aspect-[4/5] grid-cols-3 grid-rows-3 gap-1.5">
          {SHOTS_OUTPUTS.map((src) => (
            <div
              key={src}
              data-shots-frame
              className="relative aspect-[4/5] overflow-hidden rounded-md border border-white/15 bg-black/65 shadow-md"
            >
              <Image src={src} alt="" fill sizes="10vw" className="object-contain" />
            </div>
          ))}
        </div>
        <span
          data-shots-badge
          className="absolute bottom-2.5 rounded-full border border-white/15 bg-black/70 px-2.5 py-1 text-[9px] font-semibold text-white shadow-lg backdrop-blur-md"
        >
          9 matching shots
        </span>
      </div>
    </ShowcaseSurface>
  )
}

export function FanvuePaidPostShowcase() {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const context = gsap.context(() => {
      const price = root.querySelector<HTMLElement>("[data-fanvue-price]")
      const button = root.querySelector<HTMLElement>("[data-fanvue-publish]")
      const success = root.querySelector<HTMLElement>("[data-fanvue-success]")
      const composer = root.querySelector<HTMLElement>("[data-fanvue-composer]")
      const lock = root.querySelector<HTMLElement>("[data-fanvue-lock]")

      gsap.set(price, { opacity: 0, scale: 0.82 })
      gsap.set(success, { opacity: 0, y: 8, scale: 0.92 })
      gsap.set(lock, { opacity: 0, scale: 0.7 })

      const timeline = gsap.timeline({ repeat: -1, repeatDelay: 0.8 })
      timeline
        .to(price, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(1.5)" }, "+=0.45")
        .to(lock, { opacity: 1, scale: 1, duration: 0.28, ease: "back.out(1.6)" }, "-=0.18")
        .to(button, { scale: 0.94, duration: 0.12, yoyo: true, repeat: 1 }, "+=0.35")
        .to(composer, { opacity: 0.22, scale: 0.96, duration: 0.35 })
        .to(success, { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: "back.out(1.35)" }, "-=0.2")
        .to({}, { duration: 1.1 })
        .to(success, { opacity: 0, y: 6, scale: 0.94, duration: 0.25 })
        .to(composer, { opacity: 1, scale: 1, duration: 0.3 }, "-=0.08")
        .to([price, lock], { opacity: 0, scale: 0.82, duration: 0.22 })
    }, root)

    return () => context.revert()
  }, [])

  return (
    <ShowcaseSurface>
      <div ref={rootRef} className="relative flex size-full items-center justify-center p-3">
        <div
          data-fanvue-composer
          className="flex h-full w-full gap-2.5 rounded-xl border border-white/15 bg-background/85 p-2.5 shadow-xl backdrop-blur-md"
        >
          <div className="relative aspect-[4/5] h-full shrink-0 overflow-hidden rounded-lg border border-border/70 bg-black/65">
            <Image
              src="/docs/new/shots/slide-05.png"
              alt=""
              fill
              sizes="15vw"
              className="object-contain"
            />
            <span
              data-fanvue-lock
              className="absolute inset-0 flex items-center justify-center bg-black/45"
            >
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-black/75 text-white ring-1 ring-white/20">
                <LockKey className="size-4" weight="fill" />
              </span>
            </span>
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-1.5">
              <Image
                src="/brand_icons/fanvue_logo.png"
                alt=""
                width={18}
                height={18}
                className="size-4 rounded-sm"
              />
              <span className="text-[9px] font-semibold sm:text-[10px]">New paid post</span>
            </div>
            <p className="mt-2 line-clamp-2 text-[8px] leading-3 text-muted-foreground sm:text-[9px]">
              New set just dropped. Unlock the full post.
            </p>
            <div className="mt-auto flex flex-col gap-1.5">
              <span
                data-fanvue-price
                className="inline-flex w-fit items-center gap-0.5 rounded-full border border-border bg-muted/70 px-2 py-1 text-[9px] font-semibold"
              >
                <CurrencyDollar className="size-3" weight="bold" />
                14.99 PPV
              </span>
              <span
                data-fanvue-publish
                className="inline-flex h-7 items-center justify-center rounded-lg bg-[#49F264] px-2 text-[9px] font-bold text-black shadow-sm"
              >
                Publish
              </span>
            </div>
          </div>
        </div>

        <div
          data-fanvue-success
          className="absolute inset-x-[16%] top-1/2 z-20 flex -translate-y-1/2 items-center gap-2 rounded-xl border border-white/15 bg-black/85 p-3 text-white shadow-2xl backdrop-blur-md"
        >
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[#49F264] text-black">
            <Check className="size-4" weight="bold" />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold">Paid post published</span>
            <span className="mt-0.5 block text-[8px] text-white/60">$14.99 PPV · Live on Fanvue</span>
          </span>
        </div>
      </div>
    </ShowcaseSurface>
  )
}
