"use client"

import { useLayoutEffect, useRef } from "react"
import Image from "next/image"
import { gsap } from "gsap"
import { Check, MagicWand, Paperclip, Play, Plus, Sparkle } from "@phosphor-icons/react"

import type { DashboardToolNavItem } from "@/lib/constants/navigation"
import { NAV_ICON_MAP, type NavIconComponent } from "@/lib/navigation/nav-icons"
import type { ToolShowcasePreview } from "@/components/dashboard/tool-showcase-preview-data"

type ToolShowcaseDemoProps = {
  tool: DashboardToolNavItem
  preview: ToolShowcasePreview
  reducedMotion: boolean
}

function DemoFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-5">
      <div className="relative w-full max-w-[17rem] overflow-hidden rounded-[20px] border border-border/70 bg-background/78 p-3 text-foreground shadow-lg backdrop-blur-xl">
        {children}
      </div>
    </div>
  )
}

function DemoMedia({
  preview,
  index,
  className,
}: {
  preview: ToolShowcasePreview
  index: number
  className?: string
}) {
  const media = preview.media[index % preview.media.length]
  const src = media.type === "video" ? media.poster : media.src

  if (!src) {
    return <span className={className} />
  }

  return (
    <span className={`relative block overflow-hidden ${className ?? ""}`}>
      <Image
        src={src}
        alt=""
        fill
        sizes="150px"
        className="object-cover"
        style={{ objectPosition: media.position }}
      />
    </span>
  )
}

function ResultBadge({ label }: { label: string }) {
  return (
    <div
      data-demo-result
      className="mt-3 flex items-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-[11px] font-semibold shadow-sm"
    >
      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="size-3" weight="bold" />
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </div>
  )
}

function ImageStudioDemo({ preview }: { preview: ToolShowcasePreview }) {
  return (
    <DemoFrame>
      <div className="grid grid-cols-4 gap-1.5">
        {Array.from({ length: 4 }).map((_, index) => (
          <span key={index} data-demo-step>
            <DemoMedia
              preview={preview}
              index={index}
              className="aspect-[3/4] rounded-md border border-border/60 bg-muted shadow-sm"
            />
          </span>
        ))}
      </div>
      <div className="mt-2 rounded-xl border border-border/70 bg-background/90 p-2 shadow-sm">
        <div className="min-h-8 text-[10px] leading-4 text-foreground">
          <span data-demo-typed />
          <span data-demo-caret className="ml-0.5 inline-block h-3 w-px bg-foreground" />
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="flex size-5 items-center justify-center rounded-full border border-border">
              <Plus className="size-2.5" weight="bold" />
            </span>
            <span className="rounded-full bg-muted px-2 py-1 text-[8px] font-medium">
              Image · 4
            </span>
          </div>
          <span
            data-demo-result
            className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm"
          >
            <Sparkle className="size-3" weight="fill" />
          </span>
        </div>
      </div>
      <div className="sr-only">{preview.resultLabel}</div>
    </DemoFrame>
  )
}

function AgentDemo({ preview }: { preview: ToolShowcasePreview }) {
  return (
    <DemoFrame>
      <div className="flex items-center gap-2 text-[9px] font-semibold text-muted-foreground">
        <Sparkle className="size-3 text-primary" weight="fill" />
        UniCan Agent
      </div>
      <div className="mt-2 ml-auto max-w-[82%] rounded-[14px] rounded-br-sm bg-muted px-2.5 py-2 text-[9px] leading-4">
        <span data-demo-typed />
        <span data-demo-caret className="ml-0.5 inline-block h-3 w-px bg-foreground" />
      </div>
      <div className="mt-2 flex gap-1.5">
        {Array.from({ length: 3 }).map((_, index) => (
          <DemoMedia
            key={index}
            preview={preview}
            index={index}
            className="aspect-square flex-1 rounded-lg border border-border/60 bg-muted"
          />
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-border/70 bg-background/90 px-2 py-1.5">
        <Paperclip className="size-3 text-muted-foreground" />
        <span className="flex-1 text-[8px] text-muted-foreground">Ask anything…</span>
        <span data-demo-result className="size-4 rounded-full bg-primary" />
      </div>
    </DemoFrame>
  )
}

function SearchDemo({ preview }: { preview: ToolShowcasePreview }) {
  return (
    <DemoFrame>
      <div className="rounded-full border border-border/70 bg-background/90 px-3 py-2 text-[10px]">
        <span data-demo-typed />
        <span data-demo-caret className="ml-0.5 inline-block h-3 w-px bg-foreground" />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {Array.from({ length: 3 }).map((_, index) => (
          <DemoMedia
            key={index}
            preview={preview}
            index={index}
            className="aspect-[4/5] rounded-lg border border-border/60 bg-muted"
          />
        ))}
      </div>
      <ResultBadge label={preview.resultLabel} />
    </DemoFrame>
  )
}

function FlowDemo({
  inputLabel,
  resultLabel,
  icon: Icon,
}: Pick<ToolShowcasePreview, "inputLabel" | "resultLabel"> & {
  icon: NavIconComponent
}) {
  return (
    <DemoFrame>
      <div className="mb-3 truncate text-[11px] font-medium text-muted-foreground">
        {inputLabel}
      </div>
      <div className="relative flex items-center justify-between gap-1">
        {[Icon, MagicWand, Check].map((StepIcon, index) => (
          <div key={index} className="relative flex flex-1 items-center">
            <span
              data-demo-step
              className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background shadow-sm"
            >
              <StepIcon className="size-4 text-foreground" weight={index === 2 ? "bold" : "regular"} />
            </span>
            {index < 2 ? (
              <span className="mx-1 h-px flex-1 overflow-hidden bg-border">
                <span
                  data-demo-line
                  className="block h-full origin-left bg-primary"
                />
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <ResultBadge label={resultLabel} />
    </DemoFrame>
  )
}

function TransformDemo({
  preview,
}: {
  preview: ToolShowcasePreview
}) {
  return (
    <DemoFrame>
      <div className="mb-2 truncate text-[11px] font-medium text-muted-foreground">
        {preview.inputLabel}
      </div>
      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div data-demo-source>
          <DemoMedia
            preview={preview}
            index={0}
            className="aspect-[4/5] rounded-xl border border-border/60 bg-muted shadow-sm"
          />
        </div>
        <MagicWand data-demo-wand className="size-5 text-primary" weight="fill" />
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-border/60 bg-muted shadow-sm">
          <DemoMedia preview={preview} index={1} className="absolute inset-0" />
          <div
            data-demo-reveal
            className="absolute inset-y-0 left-0 w-px bg-foreground shadow-[0_0_14px_var(--primary)]"
          />
        </div>
      </div>
      <ResultBadge label={preview.resultLabel} />
    </DemoFrame>
  )
}

function WorkflowDemo({ preview }: { preview: ToolShowcasePreview }) {
  return (
    <DemoFrame>
      <div className="relative h-32 overflow-hidden rounded-xl border border-border/60 bg-muted/25">
        <svg className="absolute inset-0 size-full" viewBox="0 0 260 128" aria-hidden>
          <path
            data-demo-line
            d="M62 34 C 98 34, 94 65, 130 65"
            fill="none"
            stroke="currentColor"
            className="text-primary"
            strokeWidth="2"
          />
          <path
            data-demo-line
            d="M160 65 C 196 65, 190 96, 224 96"
            fill="none"
            stroke="currentColor"
            className="text-primary"
            strokeWidth="2"
          />
        </svg>
        {[
          { label: "Prompt", className: "left-3 top-4" },
          { label: "Generate", className: "left-[6.4rem] top-[3.1rem]" },
          { label: "Save", className: "right-3 bottom-3" },
        ].map((node, index) => (
          <span
            key={node.label}
            data-demo-step
            className={`absolute ${node.className} flex w-16 items-center gap-1.5 rounded-lg border border-border bg-background/90 p-1.5 text-[8px] font-semibold shadow-sm`}
          >
            <span className="size-3 rounded bg-primary/70" />
            {node.label}
            {index === 2 ? <Check className="ml-auto size-2.5" weight="bold" /> : null}
          </span>
        ))}
      </div>
      <ResultBadge label={preview.resultLabel} />
    </DemoFrame>
  )
}

function CarouselDemo({ preview }: { preview: ToolShowcasePreview }) {
  return (
    <DemoFrame>
      <div className="flex items-center gap-2">
        <DemoMedia
          preview={preview}
          index={0}
          className="aspect-[3/4] w-16 shrink-0 rounded-xl border-2 border-primary bg-muted"
        />
        <span data-demo-line className="h-px flex-1 origin-left bg-primary" />
        <div className="grid flex-1 grid-cols-2 gap-1">
          {Array.from({ length: 4 }).map((_, index) => (
            <span key={index} data-demo-step>
              <DemoMedia
                preview={preview}
                index={index}
                className="aspect-[3/4] rounded-md border border-border/60 bg-muted"
              />
            </span>
          ))}
        </div>
      </div>
      <div className="mt-2 rounded-xl border border-border/70 bg-background/90 p-2">
        <div className="text-[9px] text-muted-foreground">{preview.inputLabel}</div>
        <div className="mt-1 flex items-center justify-between">
          <span className="rounded-full bg-muted px-2 py-1 text-[8px]">4 shots</span>
          <span data-demo-result className="rounded-full bg-primary px-2 py-1 text-[8px] font-semibold text-primary-foreground">
            Generate
          </span>
        </div>
      </div>
    </DemoFrame>
  )
}

function VideoStudioDemo({ preview }: { preview: ToolShowcasePreview }) {
  return (
    <DemoFrame>
      <div className="relative aspect-video overflow-hidden rounded-xl border border-border/60 bg-muted">
        <DemoMedia preview={preview} index={0} className="absolute inset-0" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-8 items-center justify-center rounded-full bg-background/80 shadow-sm backdrop-blur">
            <Play className="size-3.5" weight="fill" />
          </span>
        </span>
      </div>
      <div className="relative mt-2 flex h-6 gap-1 overflow-hidden rounded-lg bg-muted/60 p-1">
        {Array.from({ length: 3 }).map((_, index) => (
          <span key={index} data-demo-step className="flex-1 rounded bg-primary/55" />
        ))}
        <span data-demo-playhead className="absolute inset-y-1 left-1 w-px bg-foreground" />
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-border/70 bg-background/90 px-2 py-2">
        <Plus className="size-3 text-muted-foreground" />
        <span className="flex-1 truncate text-[8px] text-muted-foreground">{preview.inputLabel}</span>
        <span data-demo-result className="size-5 rounded-full bg-primary" />
      </div>
    </DemoFrame>
  )
}

function TimelineDemo({
  inputLabel,
  resultLabel,
}: Pick<ToolShowcasePreview, "inputLabel" | "resultLabel">) {
  return (
    <DemoFrame>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="truncate">{inputLabel}</span>
        <Play className="size-3.5" weight="fill" />
      </div>
      <div className="relative mt-3 space-y-1.5 overflow-hidden rounded-xl border border-border/60 bg-muted/35 p-2">
        {[["w-1/3", "w-1/2", "w-1/4"], ["w-1/2", "w-1/3"]].map((widths, row) => (
          <div key={row} className="flex h-7 gap-1">
            {widths.map((width, index) => (
              <span
                key={index}
                data-demo-step
                className={`${width} rounded-md border border-border/60 bg-primary/65`}
              />
            ))}
          </div>
        ))}
        <span
          data-demo-playhead
          className="absolute bottom-1 top-1 left-2 w-px bg-foreground shadow-[0_0_8px_var(--foreground)]"
        />
      </div>
      <ResultBadge label={resultLabel} />
    </DemoFrame>
  )
}

function SignalDemo({
  inputLabel,
  resultLabel,
}: Pick<ToolShowcasePreview, "inputLabel" | "resultLabel">) {
  const bars = [10, 18, 28, 16, 34, 22, 12, 30, 20, 14, 26, 11]

  return (
    <DemoFrame>
      <div className="truncate text-[11px] font-medium text-muted-foreground">
        {inputLabel}
      </div>
      <div className="relative mt-3 flex h-20 items-center justify-center gap-1 overflow-hidden rounded-xl border border-border/60 bg-muted/35 px-3">
        {bars.map((height, index) => (
          <span
            key={index}
            data-demo-bar
            className="w-1 rounded-full bg-primary"
            style={{ height }}
          />
        ))}
        <span
          data-demo-playhead
          className="absolute bottom-2 top-2 left-3 w-px bg-foreground"
        />
      </div>
      <ResultBadge label={resultLabel} />
    </DemoFrame>
  )
}

function OrganizeDemo({ preview }: { preview: ToolShowcasePreview }) {
  return (
    <DemoFrame>
      <div className="truncate text-[11px] font-medium text-muted-foreground">
        {preview.inputLabel}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <span
            key={index}
            data-demo-step
          >
            <DemoMedia
              preview={preview}
              index={index}
              className="aspect-[4/5] rounded-lg border border-border/60 bg-muted shadow-sm"
            />
          </span>
        ))}
      </div>
      <ResultBadge label={preview.resultLabel} />
    </DemoFrame>
  )
}

export function ToolShowcaseDemo({
  tool,
  preview,
  reducedMotion,
}: ToolShowcaseDemoProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const Icon = NAV_ICON_MAP[tool.icon]

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || reducedMotion) return

    const ctx = gsap.context(() => {
      const steps = root.querySelectorAll<HTMLElement>("[data-demo-step]")
      const lines = root.querySelectorAll<HTMLElement>("[data-demo-line]")
      const result = root.querySelector<HTMLElement>("[data-demo-result]")
      const playhead = root.querySelector<HTMLElement>("[data-demo-playhead]")
      const source = root.querySelector<HTMLElement>("[data-demo-source]")
      const reveal = root.querySelector<HTMLElement>("[data-demo-reveal]")
      const wand = root.querySelector<HTMLElement>("[data-demo-wand]")
      const bars = root.querySelectorAll<HTMLElement>("[data-demo-bar]")
      const typed = root.querySelector<HTMLElement>("[data-demo-typed]")
      const caret = root.querySelector<HTMLElement>("[data-demo-caret]")
      const typeProxy = { n: 0 }

      gsap.set(steps, { opacity: 0, y: 8, scale: 0.9 })
      gsap.set(lines, { scaleX: 0, transformOrigin: "left center" })
      gsap.set(result, { opacity: 0, y: 8, scale: 0.94 })
      if (playhead) gsap.set(playhead, { x: 0 })
      if (reveal) gsap.set(reveal, { x: 0 })
      if (typed) typed.textContent = ""

      const timeline = gsap.timeline({ repeat: -1, repeatDelay: 0.65 })

      if (preview.motion === "prompt" && typed) {
        timeline.to(typeProxy, {
          n: preview.inputLabel.length,
          duration: 1.1,
          ease: "none",
          onUpdate: () => {
            typed.textContent = preview.inputLabel.slice(0, Math.floor(typeProxy.n))
          },
        })
        if (caret) timeline.to(caret, { opacity: 0, duration: 0.12 }, "+=0.1")
      }

      if (preview.motion === "transform") {
        timeline
          .fromTo(source, { x: 0, scale: 1 }, { x: 4, scale: 1.04, duration: 0.45 })
          .to(wand, { rotate: 18, scale: 1.18, duration: 0.25, yoyo: true, repeat: 1 }, "<")
          .to(reveal, { x: 102, duration: 0.75, ease: "power2.inOut" }, "-=0.15")
      } else if (preview.motion === "signal") {
        timeline
          .to(bars, {
            scaleY: () => gsap.utils.random(0.45, 1.35),
            duration: 0.25,
            stagger: { each: 0.035, from: "center" },
            yoyo: true,
            repeat: 3,
          })
          .to(playhead, { x: 205, duration: 1.1, ease: "none" }, 0)
      } else if (preview.motion === "timeline") {
        timeline
          .to(steps, {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.3,
            stagger: 0.08,
            ease: "back.out(1.4)",
          })
          .to(playhead, { x: 215, duration: 1.25, ease: "none" })
      } else {
        timeline.to(steps, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.32,
          stagger: 0.09,
          ease: "back.out(1.5)",
        })
        if (lines.length) {
          timeline.to(lines, { scaleX: 1, duration: 0.35, stagger: 0.12 }, "-=0.35")
        }
      }

      timeline
        .to(result, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "back.out(1.5)" })
        .to({}, { duration: 1 })
        .to(result, { opacity: 0, y: 6, duration: 0.2 })
        .to(steps, { opacity: 0, y: 6, scale: 0.94, duration: 0.22, stagger: 0.03 }, "<")
        .add(() => {
          typeProxy.n = 0
          if (typed) typed.textContent = ""
          if (caret) gsap.set(caret, { opacity: 1 })
          if (playhead) gsap.set(playhead, { x: 0 })
          if (reveal) gsap.set(reveal, { x: 0 })
        })
    }, root)

    return () => ctx.revert()
  }, [preview, reducedMotion])

  let content: React.ReactNode

  if (tool.label === "Image Studio") {
    content = <ImageStudioDemo preview={preview} />
  } else if (tool.label === "Agent") {
    content = <AgentDemo preview={preview} />
  } else if (tool.label === "Resources") {
    content = <SearchDemo preview={preview} />
  } else if (tool.label === "Workflow") {
    content = <WorkflowDemo preview={preview} />
  } else if (tool.label === "Carousel Shots") {
    content = <CarouselDemo preview={preview} />
  } else if (tool.label === "Video Studio" || tool.label === "Video Editor") {
    content = <VideoStudioDemo preview={preview} />
  } else {
    switch (preview.motion) {
      case "prompt":
        content = <SearchDemo preview={preview} />
        break
      case "flow":
        content = (
          <FlowDemo
            inputLabel={preview.inputLabel}
            resultLabel={preview.resultLabel}
            icon={Icon}
          />
        )
        break
      case "transform":
        content = <TransformDemo preview={preview} />
        break
      case "timeline":
        content = <TimelineDemo inputLabel={preview.inputLabel} resultLabel={preview.resultLabel} />
        break
      case "signal":
        content = <SignalDemo inputLabel={preview.inputLabel} resultLabel={preview.resultLabel} />
        break
      case "organize":
        content = <OrganizeDemo preview={preview} />
        break
      default: {
        const _exhaustive: never = preview.motion
        content = _exhaustive
      }
    }
  }

  return (
    <div ref={rootRef} className="absolute inset-0">
      {content}
    </div>
  )
}
