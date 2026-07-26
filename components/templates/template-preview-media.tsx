"use client"

import * as React from "react"
import { ArrowsLeftRight } from "@phosphor-icons/react"
import type { ThumbnailKind, TemplatePreviewLayout } from "@/lib/templates/types"
import { cn } from "@/lib/utils"

interface PreviewAssetProps {
  url: string
  kind: ThumbnailKind
  alt: string
  className?: string
}

function PreviewAsset({ url, kind, alt, className }: PreviewAssetProps) {
  if (kind === "video") {
    return (
      <video
        src={url}
        aria-label={alt}
        className={cn("h-full w-full object-cover", className)}
        muted
        playsInline
        loop
        autoPlay
      />
    )
  }

  return <img src={url} alt={alt} className={cn("h-full w-full object-cover", className)} />
}

interface TemplatePreviewMediaProps {
  afterUrl: string
  afterKind: ThumbnailKind
  beforeUrl?: string | null
  beforeKind?: ThumbnailKind | null
  layout?: TemplatePreviewLayout
  alt: string
  className?: string
}

export function TemplatePreviewMedia({
  afterUrl,
  afterKind,
  beforeUrl,
  beforeKind,
  layout = "single",
  alt,
  className,
}: TemplatePreviewMediaProps) {
  const canCompare = layout === "before_after" && Boolean(beforeUrl && beforeKind)
  const [isComparing, setIsComparing] = React.useState(false)
  const [position, setPosition] = React.useState(0)

  const updatePosition = React.useCallback((clientX: number, target: HTMLDivElement) => {
    const bounds = target.getBoundingClientRect()
    const next = ((clientX - bounds.left) / Math.max(bounds.width, 1)) * 100
    setPosition(Math.min(100, Math.max(0, next)))
  }, [])

  if (!canCompare || !beforeUrl || !beforeKind) {
    return (
      <PreviewAsset
        url={afterUrl}
        kind={afterKind}
        alt={alt}
        className={className}
      />
    )
  }

  return (
    <div
      className={cn("relative h-full w-full touch-none overflow-hidden", className)}
      onPointerEnter={(event) => {
        setIsComparing(true)
        setPosition(50)
        if (event.pointerType !== "touch") updatePosition(event.clientX, event.currentTarget)
      }}
      onPointerMove={(event) => {
        if (!isComparing && event.pointerType === "touch") return
        updatePosition(event.clientX, event.currentTarget)
      }}
      onPointerDown={(event) => {
        setIsComparing(true)
        event.currentTarget.setPointerCapture(event.pointerId)
        updatePosition(event.clientX, event.currentTarget)
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      }}
      onPointerLeave={() => {
        setIsComparing(false)
        setPosition(0)
      }}
      aria-label={`${alt} before and after comparison`}
    >
      <PreviewAsset url={beforeUrl} kind={beforeKind} alt={`${alt} before`} />
      <div
        className={cn(
          "absolute inset-0 motion-safe:transition-[clip-path] motion-safe:duration-300",
          isComparing && "motion-safe:duration-75",
        )}
        style={{ clipPath: `inset(0 0 0 ${position}%)` }}
      >
        <PreviewAsset url={afterUrl} kind={afterKind} alt={`${alt} after`} />
      </div>

      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 w-px bg-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.2)] transition-opacity",
          isComparing ? "opacity-100" : "opacity-0",
        )}
        style={{ left: `${position}%` }}
      >
        <span className="absolute left-1/2 top-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md backdrop-blur-sm">
          <ArrowsLeftRight className="size-4" weight="bold" />
        </span>
      </div>

      <span
        className={cn(
          "pointer-events-none absolute left-3 top-3 rounded-full bg-background/80 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-foreground backdrop-blur-sm transition-opacity",
          isComparing ? "opacity-100" : "opacity-0",
        )}
      >
        Before
      </span>
      <span
        className={cn(
          "pointer-events-none absolute right-3 top-3 rounded-full bg-background/80 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-foreground backdrop-blur-sm transition-opacity",
          isComparing ? "opacity-100" : "opacity-0",
        )}
      >
        After
      </span>
    </div>
  )
}
