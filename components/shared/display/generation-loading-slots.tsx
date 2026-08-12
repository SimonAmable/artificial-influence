"use client"

import { cn } from "@/lib/utils"

const IMAGE_DURATION_S = 20
const VIDEO_DURATION_S = 120

const GENERATION_FILL_KEYFRAMES = `@keyframes generationFillProgress { 0% { width: 0%; } 100% { width: 100%; } }`

export interface GenerationLoadingOverlayProps {
  className?: string
  label?: string
  tone?: "image" | "video"
}

/**
 * Full-bleed sweep overlay used on preview cards while an image/video generates.
 */
export function GenerationLoadingOverlay({
  className,
  label = "Generating...",
  tone = "image",
}: GenerationLoadingOverlayProps) {
  const duration = tone === "video" ? VIDEO_DURATION_S : IMAGE_DURATION_S

  return (
    <div
      className={cn(
        "absolute inset-0 z-30 isolate overflow-hidden bg-zinc-900/50 backdrop-blur-[1px]",
        className,
      )}
      aria-live="polite"
      aria-busy="true"
    >
      <style dangerouslySetInnerHTML={{ __html: GENERATION_FILL_KEYFRAMES }} />
      <div
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-zinc-800/95 to-zinc-600/85"
        style={{
          width: "0%",
          animation: `generationFillProgress ${duration}s linear infinite`,
          boxShadow: "2px 0 12px 0 rgba(255, 255, 255, 0.35)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-zinc-800/25 via-transparent to-zinc-900/35" />
      {label ? (
        <div className="absolute inset-x-0 bottom-4 z-10 px-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90 drop-shadow-md">
            {label}
          </p>
        </div>
      ) : null}
    </div>
  )
}

export interface GenerationLoadingSlotsProps {
  /** Number of placeholder tiles to show. */
  count: number
  /** Match image grid (20s sweep) vs video grid (120s sweep). */
  tone?: "image" | "video"
  className?: string
  tileClassName?: string
  /** Cap tiles in tight UIs (e.g. generate button). */
  maxVisible?: number
}

/**
 * Compact shimmering tiles aligned with ImageGrid / VideoGrid generating cells.
 */
export function GenerationLoadingSlots({
  count,
  tone = "image",
  className,
  tileClassName,
  maxVisible = 8,
}: GenerationLoadingSlotsProps) {
  const duration = tone === "video" ? VIDEO_DURATION_S : IMAGE_DURATION_S
  const capped = Math.max(0, Math.min(count, maxVisible))

  if (capped === 0) {
    return null
  }

  const overflow = count > maxVisible ? count - maxVisible : 0

  return (
    <div className={cn("inline-flex items-center gap-1", className)} aria-hidden>
      <style dangerouslySetInnerHTML={{ __html: GENERATION_FILL_KEYFRAMES }} />
      {Array.from({ length: capped }, (_, i) => (
        <div
          key={i}
          className={cn(
            "relative isolate h-7 w-7 shrink-0 overflow-hidden rounded border border-white/10 bg-zinc-900",
            tileClassName
          )}
        >
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-zinc-800 to-zinc-700"
            style={{
              width: "0%",
              animation: `generationFillProgress ${duration}s linear infinite`,
              animationDelay: `${(i % 4) * 0.6}s`,
              boxShadow: "2px 0 8px 0 rgba(255, 255, 255, 0.35)",
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-zinc-800/30 via-transparent to-zinc-900/30" />
        </div>
      ))}
      {overflow > 0 ? (
        <span className="text-[10px] font-medium text-primary-foreground/90 tabular-nums">+{overflow}</span>
      ) : null}
    </div>
  )
}
