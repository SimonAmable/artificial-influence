"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  overlayPreviewTypography,
  PROJECT_OVERLAY_STYLES,
  SLIDESHOW_OVERLAY_STYLE_DESCRIPTIONS,
  SLIDESHOW_OVERLAY_STYLE_LABELS,
} from "@/lib/slideshows/overlay-text-style"
import type { SlideshowOverlay } from "@/lib/slideshows/types"
import { cn } from "@/lib/utils"

function OverlayStylePreview({
  style,
  text,
}: {
  style: SlideshowOverlay["style"]
  text: string
}) {
  const sample = text.trim() || "Preview"
  const typography = overlayPreviewTypography(style, { previewWidth: 320 })

  return (
    <div
      className="relative flex min-h-[52px] items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-linear-to-b from-zinc-600/90 to-zinc-900 px-4 py-3"
      aria-hidden
    >
      <p className={typography.className} style={typography.style}>
        {sample}
      </p>
    </div>
  )
}

export function OverlayTextField({
  overlay,
  onStyleChange,
  onTextChange,
  className,
}: {
  overlay: SlideshowOverlay
  onStyleChange: (style: SlideshowOverlay["style"]) => void
  onTextChange: (text: string) => void
  className?: string
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <Label className="text-sm font-medium">Overlay · {overlay.role}</Label>
          <p className="text-[11px] leading-snug text-muted-foreground">
            {SLIDESHOW_OVERLAY_STYLE_DESCRIPTIONS[overlay.style]}
          </p>
        </div>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={overlay.style}
          onValueChange={(value) => {
            if (value) onStyleChange(value as SlideshowOverlay["style"])
          }}
          className="shrink-0 rounded-lg bg-muted/50 p-0.5"
        >
          {PROJECT_OVERLAY_STYLES.map((style) => (
            <ToggleGroupItem
              key={style}
              value={style}
              className="h-7 min-w-18 rounded-md px-2.5 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              {SLIDESHOW_OVERLAY_STYLE_LABELS[style]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <OverlayStylePreview style={overlay.style} text={overlay.resolvedText} />

      <Textarea
        rows={3}
        value={overlay.resolvedText}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder="Overlay copy"
        className="resize-none"
      />
    </div>
  )
}
