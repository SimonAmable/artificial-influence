"use client"

import * as React from "react"
import {
  CaretLeft,
  CaretRight,
  GlobeHemisphereWest,
  Images,
  Rectangle,
  Sparkle,
  TextT,
} from "@phosphor-icons/react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getSlideKindBadgeClass, SlideTypeIcon } from "@/components/slideshows/template-builder/slide-type-picker"
import { inferSlideKind, SLIDE_KIND_LABELS } from "@/lib/slideshows/slide-kind"
import type { SlideshowTemplate } from "@/lib/slideshows/types"

const TEXT_MODE_LABELS = {
  off: "Off",
  overlay: "On",
} as const

export function TemplatePreviewModal({
  template,
  open,
  onOpenChange,
  onUseTemplate,
}: {
  template: SlideshowTemplate | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUseTemplate: (template: SlideshowTemplate) => void
}) {
  const [index, setIndex] = React.useState(0)

  React.useEffect(() => {
    if (open) setIndex(0)
  }, [open, template?.id])

  if (!template) return null

  const slides = template.blueprint.slides
  const settings = template.blueprint.settings
  const current = slides[index]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0">
        <div className="grid md:grid-cols-[1.1fr_1fr]">
          <div className="border-b bg-muted/30 p-6 md:border-b-0 md:border-r">
            <div className="mx-auto aspect-[9/16] max-w-[280px] overflow-hidden rounded-2xl bg-muted">
              {current?.characterReferenceUrl || current?.visual.manualImageUrl ? (
                <img
                  src={current.characterReferenceUrl || current.visual.manualImageUrl || ""}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                  {current ? (
                    <>
                      <span className={`rounded-2xl p-4 ${getSlideKindBadgeClass(inferSlideKind(current))}`}>
                        <SlideTypeIcon kind={inferSlideKind(current)} className="h-10 w-10" />
                      </span>
                      <p className="text-sm text-muted-foreground">{current.role}</p>
                    </>
                  ) : null}
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={index <= 0}
                onClick={() => setIndex((value) => Math.max(0, value - 1))}
              >
                <CaretLeft className="h-4 w-4" />
              </Button>
              <div className="flex gap-1.5">
                {slides.map((slide, slideIndex) => (
                  <button
                    key={slide.id}
                    type="button"
                    className={`h-2 w-2 rounded-full ${slideIndex === index ? "bg-primary" : "bg-muted-foreground/30"}`}
                    onClick={() => setIndex(slideIndex)}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={index >= slides.length - 1}
                onClick={() => setIndex((value) => Math.min(slides.length - 1, value + 1))}
              >
                <CaretRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col p-6">
            <div className="mb-5">
              <div className="flex items-center gap-2">
                <Sparkle className="h-5 w-5 text-primary" weight="duotone" />
                <h2 className="text-xl font-semibold">{template.name}</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {template.description || `${slides.length}-slide reusable template`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{template.origin}</Badge>
                <Badge variant="outline">{slides.length} slides</Badge>
              </div>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Ratio</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                  <Rectangle className="h-4 w-4" />
                  {template.aspectRatio}
                </p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Lang</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                  <GlobeHemisphereWest className="h-4 w-4" />
                  {settings.language.toUpperCase()}
                </p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Text</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                  <TextT className="h-4 w-4" />
                  {TEXT_MODE_LABELS[settings.textMode]}
                </p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Mode</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium capitalize">
                  <Images className="h-4 w-4" />
                  {settings.mode}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Slides</p>
                <p className="text-xs text-muted-foreground">{slides.length} slides</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {slides.map((slide, slideIndex) => {
                  const kind = inferSlideKind(slide)
                  return (
                    <div
                      key={slide.id}
                      className="flex min-w-[72px] flex-col items-center gap-1 rounded-xl border bg-muted/20 px-3 py-2"
                    >
                      <span className={`rounded p-1 ${getSlideKindBadgeClass(kind)}`}>
                        <SlideTypeIcon kind={kind} className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-[10px] font-medium">{slideIndex + 1}</span>
                      <span className="text-[10px] text-muted-foreground">{SLIDE_KIND_LABELS[kind]}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <Button className="mt-auto w-full" onClick={() => onUseTemplate(template)}>
              <Sparkle className="mr-2 h-4 w-4" weight="duotone" />
              Use template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
