"use client"

import { Minus, Plus } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { SlideCard } from "@/components/slideshows/template-builder/slide-card"
import { SlideTypeIcon } from "@/components/slideshows/template-builder/slide-type-picker"
import { SLIDE_KIND_LABELS, createDefaultSlide } from "@/lib/slideshows/slide-kind"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { SlideshowBlueprint, SlideshowSlideKind } from "@/lib/slideshows/types"

export function SlideStructureRail({
  blueprint,
  selectedSlideId,
  onBlueprintChange,
  onSelectSlide,
}: {
  blueprint: SlideshowBlueprint
  selectedSlideId: string | null
  onBlueprintChange: (blueprint: SlideshowBlueprint) => void
  onSelectSlide: (slideId: string) => void
}) {
  const slides = blueprint.slides

  function setSlides(nextSlides: SlideshowBlueprint["slides"]) {
    onBlueprintChange({ ...blueprint, slides: nextSlides })
  }

  function changeCount(delta: number) {
    const nextCount = Math.min(35, Math.max(1, slides.length + delta))
    if (nextCount === slides.length) return
    if (nextCount < slides.length) {
      setSlides(slides.slice(0, nextCount))
      return
    }
    const defaultTextTreatment = blueprint.settings.textMode
    const added = Array.from({ length: nextCount - slides.length }, (_, offset) =>
      createDefaultSlide("pack", slides.length + offset, defaultTextTreatment),
    )
    setSlides([...slides, ...added])
  }

  function addSlide(kind: SlideshowSlideKind) {
    const slide = createDefaultSlide(kind, slides.length, blueprint.settings.textMode)
    const withDefaults = kind === "character" && blueprint.settings.defaultCharacterAssetId
      ? {
          ...slide,
          characterReferenceAssetId: blueprint.settings.defaultCharacterAssetId,
          characterReferenceUrl: blueprint.settings.defaultCharacterPreviewUrl,
        }
      : slide
    setSlides([...slides, withDefaults])
    onSelectSlide(withDefaults.id)
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Slide structure</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Build the repeatable sequence for this template.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => changeCount(-1)}
            disabled={slides.length <= 1}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="min-w-8 text-center text-sm font-medium">{slides.length}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => changeCount(1)}
            disabled={slides.length >= 35}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {slides.map((slide, index) => (
          <SlideCard
            key={slide.id}
            slide={slide}
            index={index}
            selected={selectedSlideId === slide.id}
            onClick={() => onSelectSlide(slide.id)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add slide
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {(["ai", "pack", "custom", "character"] as SlideshowSlideKind[]).map((kind) => (
              <DropdownMenuItem key={kind} className="gap-3" onClick={() => addSlide(kind)}>
                <SlideTypeIcon kind={kind} />
                {SLIDE_KIND_LABELS[kind]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
