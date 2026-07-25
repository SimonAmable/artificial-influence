"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"

import { AuroraShaderBackground } from "@/components/ui/aurora-shader-background"
import { cn } from "@/lib/utils"

const LOOP_SECONDS = 2.1

/** Compact modern pointer — solid tip, no stem/tail. */
function ModernPointerCursor({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <path d="M3.1 2.15c-.55-.32-1.2.2-1.05.82l2.7 11.7c.16.7 1.08.9 1.55.32l2.55-3.15 4.55.55c.72.09 1.12-.78.62-1.28L3.1 2.15Z" />
    </svg>
  )
}

export type ShaderDemoCardProps = {
  /** Required when the card is interactive. Ignored when `disabled`. */
  href?: string
  /** Center control label (and media-mode title fallback). */
  buttonLabel: string
  title?: string
  description?: string
  /** When set, shows media instead of the shader + cursor demo. */
  mediaSrc?: string
  mediaAlt?: string
  animationDelay?: number
  /** Non-interactive “Soon” state — shader still shows, no link/cursor loop. */
  disabled?: boolean
  /** Where title/description sit relative to the media. Default: below. */
  copyPlacement?: "above" | "below"
  /** How media fills the frame. Default: cover. */
  mediaFit?: "cover" | "contain"
  className?: string
}

/**
 * Reusable demo card.
 * Default (no media): aurora shader background, centered CTA, looping click cursor.
 * With media: image card (hub-style).
 */
export function ShaderDemoCard({
  href,
  buttonLabel,
  title,
  description,
  mediaSrc,
  mediaAlt,
  animationDelay = 0,
  disabled = false,
  copyPlacement = "below",
  mediaFit = "cover",
  className,
}: ShaderDemoCardProps) {
  const prefersReducedMotion = useReducedMotion()
  const cardRef = React.useRef<HTMLElement | null>(null)
  const [pressed, setPressed] = React.useState(false)
  const showShaderDemo = !mediaSrc
  const displayTitle = title ?? buttonLabel
  const isInteractive = !disabled && Boolean(href)

  React.useEffect(() => {
    if (prefersReducedMotion || !showShaderDemo || !isInteractive) return

    let cancelled = false
    let timeoutId: number | undefined
    let intervalId: number | undefined

    const runClickPulse = () => {
      if (cancelled) return
      setPressed(true)
      window.setTimeout(() => {
        if (!cancelled) setPressed(false)
      }, 130)
    }

    // Click lands when the cursor reaches center (~38% into the loop)
    timeoutId = window.setTimeout(() => {
      runClickPulse()
      intervalId = window.setInterval(runClickPulse, LOOP_SECONDS * 1000)
    }, animationDelay * 1000 + LOOP_SECONDS * 1000 * 0.38)

    return () => {
      cancelled = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      if (intervalId !== undefined) window.clearInterval(intervalId)
    }
  }, [animationDelay, isInteractive, prefersReducedMotion, showShaderDemo])

  const mediaClassName = cn(
    "group relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border border-border/50 bg-muted/30",
    disabled && "opacity-80",
  )

  const mediaContent = showShaderDemo ? (
    <>
      <AuroraShaderBackground
        className="rounded-[inherit]"
        targetRef={cardRef}
        animate={!prefersReducedMotion && isInteractive}
      />
      <div className="absolute inset-0 bg-background/25" aria-hidden />

      <motion.span
        className="relative z-10 inline-flex items-center justify-center rounded-full border border-white/20 bg-black/55 px-5 py-2.5 text-sm font-semibold tracking-tight text-white shadow-lg backdrop-blur-md"
        animate={pressed ? { scale: 0.94 } : { scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 28 }}
      >
        {buttonLabel}
      </motion.span>

      {isInteractive && !prefersReducedMotion ? (
        <motion.div
          className="pointer-events-none absolute z-20 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]"
          style={{ left: "50%", top: "50%" }}
          initial={{ opacity: 0, x: 168, y: 142, scale: 0.94 }}
          animate={{
            // Enter from off-screen BR → click center → exit off-screen BR
            opacity: [0, 1, 1, 1, 0],
            x: [168, 8, 8, 168, 168],
            y: [142, 10, 10, 142, 142],
            scale: [0.94, 1, 0.88, 1, 0.94],
          }}
          transition={{
            duration: LOOP_SECONDS,
            ease: ["easeOut", "easeInOut", "easeInOut", "easeIn"],
            times: [0, 0.34, 0.42, 0.82, 1],
            repeat: Infinity,
            repeatDelay: 0.1,
            delay: animationDelay,
          }}
          aria-hidden
        >
          <ModernPointerCursor className="size-6 origin-top-left -rotate-6" />
        </motion.div>
      ) : null}
    </>
  ) : (
    <Image
      src={encodeURI(mediaSrc)}
      alt={mediaAlt ?? displayTitle}
      fill
      sizes="(min-width: 640px) 30vw, 90vw"
      className={cn(
        "transition-transform duration-500 group-hover:scale-[1.03]",
        mediaFit === "contain" ? "object-contain" : "object-cover",
      )}
    />
  )

  const copy =
    displayTitle || description ? (
      <span
        className={cn(
          "block px-0.5",
          copyPlacement === "above" ? "mb-3" : "mt-3",
        )}
      >
        {displayTitle ? (
          <span className="block text-base font-semibold tracking-tight text-foreground">
            {displayTitle}
          </span>
        ) : null}
        {description ? (
          <span className="mt-1 block text-sm leading-6 text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    ) : null

  return (
    <div className={cn("block", disabled && "opacity-70", className)}>
      {copyPlacement === "above" ? copy : null}

      {isInteractive ? (
        <Link
          ref={cardRef as React.RefObject<HTMLAnchorElement | null>}
          href={href!}
          className={mediaClassName}
        >
          {mediaContent}
        </Link>
      ) : (
        <div
          ref={cardRef as React.RefObject<HTMLDivElement | null>}
          className={mediaClassName}
          aria-disabled="true"
        >
          {mediaContent}
        </div>
      )}

      {copyPlacement === "below" ? copy : null}
    </div>
  )
}
