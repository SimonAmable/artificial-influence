"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { inferSlideKind } from "@/lib/slideshows/slide-kind"
import type { SlideshowSlideBlueprint } from "@/lib/slideshows/types"
import { cn } from "@/lib/utils"
import { getSlideKindBadgeClass, SlideTypeIcon } from "@/components/slideshows/template-builder/slide-type-picker"
import { SLIDE_KIND_LABELS } from "@/lib/slideshows/slide-kind"

export function SlideCard({
  slide,
  index,
  selected,
  onClick,
}: {
  slide: SlideshowSlideBlueprint
  index: number
  selected: boolean
  onClick: () => void
}) {
  const kind = inferSlideKind(slide)
  const previewUrl =
    slide.characterReferenceUrl
    || slide.visual.manualImageUrl
    || null

  return (
    <button type="button" onClick={onClick} className="shrink-0 text-left">
      <Card
        className={cn(
          "w-[148px] overflow-hidden transition-colors",
          selected ? "ring-2 ring-primary border-primary/40" : "hover:border-foreground/20",
        )}
      >
        <div className="relative aspect-[9/16] bg-muted/60">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
              <span className={cn("rounded-xl p-3", getSlideKindBadgeClass(kind))}>
                <SlideTypeIcon kind={kind} className="h-8 w-8" />
              </span>
            </div>
          )}
          <Badge
            className="absolute bottom-2 right-2 h-6 min-w-6 justify-center rounded-full px-0"
            variant="secondary"
          >
            {index + 1}
          </Badge>
        </div>
        <div className="space-y-1 border-t px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className={cn("inline-flex rounded p-0.5", getSlideKindBadgeClass(kind))}>
              <SlideTypeIcon kind={kind} className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-medium">{SLIDE_KIND_LABELS[kind]}</span>
          </div>
          <p className="line-clamp-1 text-[11px] text-muted-foreground">{slide.role}</p>
        </div>
      </Card>
    </button>
  )
}
