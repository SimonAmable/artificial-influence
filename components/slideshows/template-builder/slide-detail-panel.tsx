"use client"

import * as React from "react"
import { CaretDown } from "@phosphor-icons/react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GenerationPromptField } from "@/components/slideshows/template-builder/generation-prompt-field"
import { SlideTypePicker } from "@/components/slideshows/template-builder/slide-type-picker"
import {
  AssetSelectionModal,
  type AssetSelectionPick,
} from "@/components/shared/modals/asset-selection-modal"
import { Button } from "@/components/ui/button"
import { UploadSimple } from "@phosphor-icons/react"
import { applySlideKind, inferSlideKind } from "@/lib/slideshows/slide-kind"
import { defaultOverlay } from "@/lib/slideshows/text-treatment"
import type { SlideshowCollection } from "@/lib/slideshow/types"
import type { SlideshowBlueprint, SlideshowSlideBlueprint } from "@/lib/slideshows/types"
import { cn } from "@/lib/utils"

type CaptionMode = "exact" | "ai"

function inferCaptionMode(variation: SlideshowSlideBlueprint["content"]["variation"]): CaptionMode {
  return variation === "fixed" ? "exact" : "ai"
}

function captionVariation(mode: CaptionMode): SlideshowSlideBlueprint["content"]["variation"] {
  return mode === "exact" ? "fixed" : "fresh_each_run"
}

function syncOverlayFields(
  overlays: SlideshowSlideBlueprint["overlays"],
  patch: Partial<SlideshowSlideBlueprint["overlays"][number]>,
) {
  if (overlays.length === 0) return overlays
  const [first, ...rest] = overlays
  return [{ ...first, ...patch }, ...rest]
}

export function SlideDetailPanel({
  slide,
  slideIndex,
  blueprint: _blueprint,
  collections,
  onSlideChange,
}: {
  slide: SlideshowSlideBlueprint | null
  slideIndex: number
  blueprint: SlideshowBlueprint
  collections: SlideshowCollection[]
  onSlideChange: (slide: SlideshowSlideBlueprint) => void
}) {
  const [customAssetOpen, setCustomAssetOpen] = React.useState(false)
  const [aiEditOpen, setAiEditOpen] = React.useState(false)

  React.useEffect(() => {
    const hasAiEdit = Boolean(slide?.visual.aiEditPrompt)
    const hasEditReferences = (slide?.visual.referenceImages?.length ?? 0) > 0
    setAiEditOpen(hasAiEdit || hasEditReferences)
  }, [slide?.id, slide?.visual.aiEditPrompt, slide?.visual.referenceImages])

  if (!slide) {
    return (
      <div className="rounded-2xl bg-muted/10 p-8 text-center text-sm text-muted-foreground ring-1 ring-inset ring-dashed ring-border/50">
        Select a slide to configure its type, visuals, and copy behavior.
      </div>
    )
  }

  const currentSlide = slide
  const kind = inferSlideKind(currentSlide)
  const usesOverlay = currentSlide.textTreatment === "overlay"
  const usesGenerationPrompt = kind === "ai" || kind === "character"
  const captionMode = inferCaptionMode(currentSlide.content.variation)
  const exactCaption =
    currentSlide.overlays[0]?.resolvedText.trim()
    || currentSlide.content.resolvedText

  function patchSlide(update: Partial<SlideshowSlideBlueprint>) {
    onSlideChange({ ...currentSlide, ...update })
  }

  function patchVisual(update: Partial<SlideshowSlideBlueprint["visual"]>) {
    onSlideChange({
      ...currentSlide,
      visual: { ...currentSlide.visual, ...update },
    })
  }

  function handleKindChange(nextKind: typeof kind) {
    onSlideChange(applySlideKind(currentSlide, nextKind))
  }

  function handleCustomAssetSelect(pick: AssetSelectionPick) {
    patchVisual({
      manualAssetId: pick.id ?? null,
      manualImageUrl: pick.previewUrl || pick.url,
    })
    setCustomAssetOpen(false)
  }

  function applyCaptionVariation(mode: CaptionMode) {
    const variation = captionVariation(mode)
    patchSlide({
      content: { ...currentSlide.content, variation },
      overlays: syncOverlayFields(currentSlide.overlays, { variation }),
    })
  }

  function handleOverlayToggle(value: "off" | "overlay") {
    if (value === "off") {
      patchSlide({ textTreatment: "off", overlays: [] })
      return
    }

    const overlays = currentSlide.overlays.length > 0
      ? currentSlide.overlays
      : [{
          ...defaultOverlay(currentSlide.role),
          prompt: currentSlide.content.prompt,
          resolvedText: currentSlide.content.resolvedText,
          variation: captionVariation(captionMode),
        }]

    patchSlide({ textTreatment: "overlay", overlays })
  }

  return (
    <div className="space-y-4 rounded-2xl bg-muted/15 p-5 ring-1 ring-inset ring-border/40">
      <p className="sr-only">Slide {slideIndex + 1} settings</p>

      <section className="space-y-4">
        <p className="text-xs font-medium text-muted-foreground">Slide</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Type</Label>
            <SlideTypePicker value={kind} onChange={handleKindChange} triggerClassName="w-full justify-start" />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Input
              value={currentSlide.role}
              onChange={(event) => patchSlide({
                role: event.target.value,
                content: { ...currentSlide.content, role: event.target.value },
              })}
            />
          </div>
        </div>

        {kind === "pack" ? (
          <div className="space-y-3 border-t border-border/40 pt-4">
            <div className="space-y-2">
              <Label>Collection</Label>
              <Select
                value={currentSlide.visual.collectionId ?? "none"}
                onValueChange={(value) => patchVisual({
                  collectionId: value === "none" ? null : value,
                })}
              >
                <SelectTrigger><SelectValue placeholder="Choose collection" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select collection</SelectItem>
                  {collections.map((collection) => (
                    <SelectItem key={collection.id} value={collection.id}>
                      {collection.name} ({collection.items.length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-xl ring-1 ring-inset ring-border/40">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/20"
                onClick={() => setAiEditOpen((open) => !open)}
              >
                <span className="font-medium text-foreground/90">Edit image with AI</span>
                <CaretDown className={cn("h-4 w-4 shrink-0 transition-transform", aiEditOpen && "rotate-180")} />
              </button>
              {aiEditOpen ? (
                <div className="border-t px-3 py-3">
                  <GenerationPromptField
                    label="Edit prompt"
                    prompt={currentSlide.visual.aiEditPrompt ?? ""}
                    onPromptChange={(value) => patchVisual({
                      aiEditPrompt: value.trim() ? value : null,
                    })}
                    placeholder="Optional — leave empty to use the collection image as-is."
                    references={currentSlide.visual.referenceImages ?? []}
                    onReferencesChange={(referenceImages) => patchVisual({ referenceImages })}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {usesGenerationPrompt ? (
          <div className="border-t border-border/40 pt-4">
            <GenerationPromptField
              prompt={currentSlide.visual.prompt}
              onPromptChange={(value) => patchVisual({ prompt: value })}
              placeholder={
                kind === "character"
                  ? "Same character as reference. Describe the new scene and message."
                  : "Describe the visual you want to generate for this slide."
              }
              references={currentSlide.visual.referenceImages ?? []}
              onReferencesChange={(referenceImages) => patchVisual({ referenceImages })}
              characterReference={
                kind === "character" && currentSlide.characterReferenceAssetId && currentSlide.characterReferenceUrl
                  ? {
                      assetId: currentSlide.characterReferenceAssetId,
                      previewUrl: currentSlide.characterReferenceUrl,
                      title: "Character",
                    }
                  : null
              }
              onCharacterReferenceChange={
                kind === "character"
                  ? (selection) => patchSlide({
                      characterReferenceAssetId: selection?.assetId ?? null,
                      characterReferenceUrl: selection?.previewUrl ?? null,
                    })
                  : undefined
              }
            />
          </div>
        ) : null}

        {kind === "custom" ? (
          <div className="space-y-3 border-t border-border/40 pt-4">
            {currentSlide.visual.manualImageUrl ? (
              <img
                src={currentSlide.visual.manualImageUrl}
                alt=""
                className="aspect-[9/16] max-h-48 w-full rounded-xl object-cover"
              />
            ) : null}
            <Button type="button" variant="outline" className="gap-2" onClick={() => setCustomAssetOpen(true)}>
              <UploadSimple className="h-4 w-4" />
              {currentSlide.visual.manualImageUrl ? "Change image" : "Select image"}
            </Button>
            <AssetSelectionModal
              open={customAssetOpen}
              onOpenChange={setCustomAssetOpen}
              onSelect={handleCustomAssetSelect}
              allowedAssetTypes={["image"]}
              defaultTab="assets"
            />
          </div>
        ) : null}
      </section>

      <section className="space-y-4 border-t border-border/40 pt-4">
        <p className="text-xs font-medium text-muted-foreground">Caption</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Overlays</Label>
            <Select
              value={currentSlide.textTreatment}
              onValueChange={(value) => handleOverlayToggle(value as "off" | "overlay")}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off</SelectItem>
                <SelectItem value="overlay">On</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {usesOverlay ? (
            <div className="space-y-2">
              <Label>Caption text</Label>
              <Select
                value={captionMode}
                onValueChange={(value) => applyCaptionVariation(value as CaptionMode)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ai">AI generates</SelectItem>
                  <SelectItem value="exact">Use exact text</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        {usesOverlay && captionMode === "ai" ? (
          <div className="space-y-2">
            <Label>Caption prompt</Label>
            <Textarea
              rows={3}
              value={currentSlide.content.prompt}
              onChange={(event) => {
                const prompt = event.target.value
                patchSlide({
                  content: { ...currentSlide.content, prompt },
                  overlays: syncOverlayFields(currentSlide.overlays, { prompt }),
                })
              }}
              placeholder="Describe what the overlay caption should say on this slide."
            />
          </div>
        ) : null}

        {usesOverlay && captionMode === "exact" ? (
          <div className="space-y-2">
            <Label>Exact caption</Label>
            <Textarea
              rows={2}
              value={exactCaption}
              onChange={(event) => {
                const resolvedText = event.target.value
                patchSlide({
                  content: { ...currentSlide.content, resolvedText },
                  overlays: syncOverlayFields(currentSlide.overlays, { resolvedText }),
                })
              }}
              placeholder="Caption shown on the slide, unchanged on every run."
            />
          </div>
        ) : null}
      </section>
    </div>
  )
}
