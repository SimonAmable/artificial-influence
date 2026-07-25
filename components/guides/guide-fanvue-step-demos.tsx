"use client"

import { useLayoutEffect, useRef } from "react"
import { gsap } from "gsap"
import { CurrencyDollar, LinkSimple, UploadSimple } from "@phosphor-icons/react"

import {
  GuideDemoShell,
  ModernPointerCursor,
} from "@/components/guides/guide-demo-shell"
import { cn } from "@/lib/utils"

export type FanvueGuideDemoId = "fanvue-connect" | "fanvue-media" | "fanvue-publish"

const DEMO_FRAME = "h-[220px]"
const FANVUE_LOGO = "/brand_icons/fanvue_logo.png"
const THUMB_SRC = "/carousel-shots-slides/slide-01.png"

function FanvueConnectDemo() {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      const button = root.querySelector<HTMLElement>("[data-demo-connect]")
      const success = root.querySelector<HTMLElement>("[data-demo-success]")
      const cursor = root.querySelector<HTMLElement>("[data-demo-cursor]")

      gsap.set(success, { opacity: 0, y: 8, scale: 0.94 })
      gsap.set(cursor, { opacity: 1, x: 0, y: 0, scale: 1, rotate: -6 })

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8 })

      tl.to(cursor, { x: 36, y: -28, duration: 0.5, ease: "power2.inOut" })
        .to(cursor, { scale: 0.88, duration: 0.1, yoyo: true, repeat: 1 })
        .to(button, { scale: 0.96, duration: 0.12, yoyo: true, repeat: 1 }, "<")
        .to(success, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: "back.out(1.4)" })
        .to({}, { duration: 1.1 })
        .to(success, { opacity: 0, y: 6, scale: 0.94, duration: 0.25 })
        .to(cursor, { x: 0, y: 0, duration: 0.4, ease: "power2.inOut" })
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <GuideDemoShell label="Demo: connect Fanvue" className={DEMO_FRAME}>
      <div ref={rootRef} className="relative flex h-full min-h-0 flex-col items-center justify-center gap-4 overflow-hidden">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-background/80 p-2 backdrop-blur-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={FANVUE_LOGO} alt="" className="size-full object-contain" />
        </div>

        <span
          data-demo-connect
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/85 px-3.5 py-2 text-[11px] font-semibold tracking-tight backdrop-blur-md"
        >
          <LinkSimple className="size-3.5" weight="bold" />
          Connect Fanvue
        </span>

        <span
          data-demo-success
          className="rounded-full border border-foreground/20 bg-foreground px-3 py-1 text-[10px] font-semibold text-background"
        >
          Account connected
        </span>

        <div
          data-demo-cursor
          className="pointer-events-none absolute bottom-8 left-[42%] z-20 origin-top-left text-foreground drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
          aria-hidden
        >
          <ModernPointerCursor className="size-6 -rotate-6" />
        </div>
      </div>
    </GuideDemoShell>
  )
}

function FanvueMediaDemo() {
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
      gsap.set(drag, { opacity: 1, x: 0, y: 0, scale: 1 })
      gsap.set(cursor, { opacity: 1, x: 0, y: 0, scale: 1, rotate: -6 })

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.75 })

      tl.to(cursor, { x: 8, y: 6, duration: 0.35, ease: "power2.inOut" })
        .to(cursor, { scale: 0.86, duration: 0.12 })
        .to(drag, { scale: 0.94, duration: 0.12 }, "<")
        .to([cursor, drag], { x: 54, y: -78, duration: 0.75, ease: "power2.inOut" }, "+=0.05")
        .to(card, { borderStyle: "solid", scale: 1.02, duration: 0.25 }, "-=0.25")
        .to(cursor, { scale: 1, duration: 0.12 })
        .to(drag, { opacity: 0, scale: 0.7, duration: 0.28, ease: "power2.in" }, "<")
        .to(empty, { opacity: 0, duration: 0.2 }, "-=0.1")
        .to(preview, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(1.35)" })
        .to(card, { scale: 1, duration: 0.2 }, "<")
        .to(cursor, { x: 72, y: -40, duration: 0.35, ease: "power2.out" }, "-=0.15")
        .to({}, { duration: 1.05 })
        .to(preview, { opacity: 0, scale: 0.92, duration: 0.25 })
        .to(empty, { opacity: 1, duration: 0.2 }, "-=0.1")
        .to(card, { borderStyle: "dashed", duration: 0.2 }, "<")
        .set(drag, { opacity: 1, x: 0, y: 0, scale: 1 })
        .to(cursor, { x: 0, y: 0, duration: 0.4, ease: "power2.inOut" })
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <GuideDemoShell label="Demo: select vault media" className={DEMO_FRAME}>
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
            <span className="text-[10px] font-semibold tracking-tight">Vault media</span>
            <span className="text-[9px]">Upload or select</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            data-demo-preview
            src={THUMB_SRC}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        </div>

        <div
          data-demo-drag
          className="pointer-events-none absolute bottom-2 left-3 z-10 size-14 overflow-hidden rounded-xl border-2 border-background shadow-lg ring-1 ring-border/60"
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={THUMB_SRC} alt="" className="size-full object-cover" />
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

function FanvuePublishDemo() {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      const ppv = root.querySelector<HTMLElement>("[data-demo-ppv]")
      const price = root.querySelector<HTMLElement>("[data-demo-price]")
      const publish = root.querySelector<HTMLElement>("[data-demo-publish]")
      const done = root.querySelector<HTMLElement>("[data-demo-done]")
      const cursor = root.querySelector<HTMLElement>("[data-demo-cursor]")

      gsap.set(price, { opacity: 0.35, scale: 0.98 })
      gsap.set(done, { opacity: 0, y: 8, scale: 0.94 })
      gsap.set(cursor, { opacity: 1, x: 0, y: 0, scale: 1, rotate: -6 })

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.75 })

      tl.to(cursor, { x: 8, y: -56, duration: 0.45, ease: "power2.inOut" })
        .to(cursor, { scale: 0.88, duration: 0.1, yoyo: true, repeat: 1 })
        .to(ppv, { scale: 1.04, duration: 0.15, yoyo: true, repeat: 1 }, "<")
        .to(price, { opacity: 1, scale: 1, duration: 0.3 })
        .to(cursor, { x: 42, y: -8, duration: 0.45, ease: "power2.inOut" })
        .to(cursor, { scale: 0.88, duration: 0.1, yoyo: true, repeat: 1 })
        .to(publish, { scale: 0.96, duration: 0.12, yoyo: true, repeat: 1 }, "<")
        .to(done, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: "back.out(1.4)" })
        .to({}, { duration: 1.05 })
        .to(done, { opacity: 0, y: 6, duration: 0.25 })
        .to(price, { opacity: 0.35, scale: 0.98, duration: 0.2 }, "<")
        .to(cursor, { x: 0, y: 0, duration: 0.4, ease: "power2.inOut" })
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <GuideDemoShell label="Demo: set PPV and publish" className={DEMO_FRAME}>
      <div ref={rootRef} className="relative flex h-full min-h-0 flex-col justify-center gap-3 overflow-hidden px-1">
        <div className="mx-auto flex w-full max-w-[240px] items-center gap-2 rounded-xl border border-border/60 bg-background/80 p-1.5 backdrop-blur-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={THUMB_SRC} alt="" className="size-12 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-semibold tracking-tight">Vault still</p>
            <p className="truncate text-[9px] text-muted-foreground">Ready to post</p>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-[240px] flex-wrap items-center gap-1.5">
          <span
            data-demo-ppv
            className={cn(
              "rounded-full border border-foreground bg-foreground px-2.5 py-1 text-[10px] font-semibold text-background"
            )}
          >
            Paid post (PPV)
          </span>
          <span
            data-demo-price
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-2.5 py-1 text-[10px] font-semibold"
          >
            <CurrencyDollar className="size-3" weight="bold" />
            9.99
          </span>
        </div>

        <div className="relative mx-auto flex w-full max-w-[240px] justify-center">
          <span
            data-demo-publish
            className="inline-flex items-center rounded-full border border-white/20 bg-black/55 px-4 py-1.5 text-[11px] font-semibold tracking-tight text-white backdrop-blur-md"
          >
            Publish now
          </span>
        </div>

        <span
          data-demo-done
          className="mx-auto rounded-full border border-foreground/20 bg-foreground px-3 py-1 text-[10px] font-semibold text-background"
        >
          Posted to Fanvue
        </span>

        <div
          data-demo-cursor
          className="pointer-events-none absolute bottom-7 left-[38%] z-20 origin-top-left text-foreground drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
          aria-hidden
        >
          <ModernPointerCursor className="size-6 -rotate-6" />
        </div>
      </div>
    </GuideDemoShell>
  )
}

export function GuideFanvueStepDemo({ demoId }: { demoId: FanvueGuideDemoId }) {
  switch (demoId) {
    case "fanvue-connect":
      return <FanvueConnectDemo />
    case "fanvue-media":
      return <FanvueMediaDemo />
    case "fanvue-publish":
      return <FanvuePublishDemo />
    default: {
      const _exhaustive: never = demoId
      return _exhaustive
    }
  }
}
