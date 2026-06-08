"use client"

import { Badge } from "@/components/ui/badge"
import { getSlideKindBadgeClass, SlideTypeIcon } from "@/components/slideshows/template-builder/slide-type-picker"
import { inferSlideKind, SLIDE_KIND_LABELS } from "@/lib/slideshows/slide-kind"
import type { SlideshowSlideBlueprint } from "@/lib/slideshows/types"
import { cn } from "@/lib/utils"

export function TemplateSlideThumb({
  slide,
  index,
  className,
}: {
  slide: SlideshowSlideBlueprint
  index: number
  className?: string
}) {
  const kind = inferSlideKind(slide)
  const previewUrl = slide.characterReferenceUrl || slide.visual.manualImageUrl || null

  return (
    <div
      className={cn(
        "relative aspect-[9/16] w-12 shrink-0 overflow-hidden rounded-md bg-muted/60",
        className,
      )}
      title={SLIDE_KIND_LABELS[kind]}
    >
      {previewUrl ? (
        <img src={previewUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center">
          <span className={cn("rounded-md p-1", getSlideKindBadgeClass(kind))}>
            <SlideTypeIcon kind={kind} className="h-3.5 w-3.5" />
          </span>
        </div>
      )}
      <Badge
        className="absolute bottom-0.5 right-0.5 h-4 min-w-4 justify-center rounded-full px-0 text-[8px]"
        variant="secondary"
      >
        {index + 1}
      </Badge>
    </div>
  )
}
