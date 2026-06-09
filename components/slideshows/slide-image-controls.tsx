"use client"

import * as React from "react"
import { ArrowsClockwise, Shuffle } from "@phosphor-icons/react"
import { GenerationPromptField } from "@/components/slideshows/template-builder/generation-prompt-field"
import { CollectionImagePicker } from "@/components/slideshows/collection-image-picker"
import { SlideTypePicker } from "@/components/slideshows/template-builder/slide-type-picker"
import {
  AssetSelectionModal,
  type AssetSelectionPick,
} from "@/components/shared/modals/asset-selection-modal"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { inferSlideKind } from "@/lib/slideshows/slide-kind"
import type { SlideshowCollection } from "@/lib/slideshow/types"
import type { ResolvedSlideshowSlide } from "@/lib/slideshows/types"
import {
  pinCollectionImage,
  queueSlideRegeneration,
  setManualImage,
  switchSlideKind,
  switchVisualSource,
  VISUAL_SOURCE_LABELS,
} from "@/lib/slideshows/visual-source"

function patchVisual(
  slide: ResolvedSlideshowSlide,
  update: Partial<ResolvedSlideshowSlide["visual"]>,
): ResolvedSlideshowSlide {
  return {
    ...slide,
    visual: { ...slide.visual, ...update },
  }
}

export function SlideImageControls({
  slide,
  slideIndex,
  allSlides,
  collections,
  onSlideChange,
  onResolve,
  busy,
}: {
  slide: ResolvedSlideshowSlide
  slideIndex: number
  allSlides: ResolvedSlideshowSlide[]
  collections: SlideshowCollection[]
  onSlideChange: (slide: ResolvedSlideshowSlide) => void
  onResolve: () => void
  busy: boolean
}) {
  const [customAssetOpen, setCustomAssetOpen] = React.useState(false)
  const kind = inferSlideKind(slide)
  const selectedCollection = collections.find((collection) => collection.id === slide.visual.collectionId) ?? null
  const reuseCandidates = allSlides.filter((candidate) => candidate.id !== slide.id)
  const previewUrl = slide.sourceImageUrl || slide.visual.manualImageUrl

  function update(next: ResolvedSlideshowSlide) {
    onSlideChange(next)
  }

  function handleKindChange(nextKind: typeof kind) {
    update(switchSlideKind(slide, nextKind))
  }

  function handleCollectionChange(collectionId: string | null) {
    update({
      ...queueSlideRegeneration(slide),
      visual: {
        ...slide.visual,
        source: "collection",
        collectionId,
      },
    })
  }

  function handleCustomAssetSelect(pick: AssetSelectionPick) {
    update(setManualImage(slide, {
      assetId: pick.id ?? null,
      imageUrl: pick.previewUrl || pick.url,
    }))
    setCustomAssetOpen(false)
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Image source</Label>
        <SlideTypePicker value={kind} onChange={handleKindChange} triggerClassName="w-full justify-start" />
        <p className="text-xs text-muted-foreground">
          Switch how this slide gets its visual. Changing source clears the current image.
        </p>
      </div>

      <div className="rounded-xl border bg-muted/30 p-4 text-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium">{VISUAL_SOURCE_LABELS[slide.visual.source]}</p>
          <span className="text-xs capitalize text-muted-foreground">{slide.status}</span>
        </div>
        {slide.errorMessage ? (
          <p className="mt-2 text-destructive">{slide.errorMessage}</p>
        ) : null}
      </div>

      {previewUrl ? (
        <img
          src={previewUrl}
          alt=""
          className="mx-auto aspect-[9/16] max-h-56 w-full max-w-[200px] rounded-xl object-cover shadow-sm"
        />
      ) : (
        <div className="mx-auto flex aspect-[9/16] max-h-56 w-full max-w-[200px] items-center justify-center rounded-xl border border-dashed bg-muted/20 text-xs text-muted-foreground">
          No image yet
        </div>
      )}

      {kind === "pack" && slide.visual.source !== "reuse" ? (
        <div className="space-y-4 rounded-xl border p-4">
          <div className="space-y-2">
            <Label>Image pack</Label>
            <Select
              value={slide.visual.collectionId ?? "none"}
              onValueChange={(value) => handleCollectionChange(value === "none" ? null : value)}
            >
              <SelectTrigger><SelectValue placeholder="Choose pack" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select pack</SelectItem>
                {collections.map((collection) => (
                  <SelectItem key={collection.id} value={collection.id}>
                    {collection.name} ({collection.items.length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <CollectionImagePicker
            collection={selectedCollection}
            selectedImageId={slide.sourceCollectionImageId}
            onSelect={(item) => update(pinCollectionImage(slide, { id: item.id, url: item.url }))}
          />

          <GenerationPromptField
            label="Edit prompt"
            prompt={slide.visual.aiEditPrompt ?? ""}
            onPromptChange={(value) => update({
              ...queueSlideRegeneration(patchVisual(slide, {
                aiEditPrompt: value.trim() ? value : null,
              })),
            })}
            placeholder="Leave empty to use the pack image as-is."
            references={slide.visual.referenceImages ?? []}
            onReferencesChange={(referenceImages) => update(
              queueSlideRegeneration(patchVisual(slide, { referenceImages })),
            )}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => update(queueSlideRegeneration(slide))}
            >
              <Shuffle className="h-4 w-4" />
              Pick another
            </Button>
            {slide.visual.aiEditPrompt ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => update(queueSlideRegeneration(slide))}
              >
                <ArrowsClockwise className="h-4 w-4" />
                Re-run AI edit
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {(kind === "ai" || kind === "character") ? (
        <div className="space-y-4 rounded-xl border p-4">
          <GenerationPromptField
            prompt={slide.visual.prompt}
            onPromptChange={(value) => update(queueSlideRegeneration(patchVisual(slide, { prompt: value })))}
            placeholder={
              kind === "character"
                ? "Same character as reference. Describe the new scene and message."
                : "Describe the visual you want to generate for this slide."
            }
            references={slide.visual.referenceImages ?? []}
            onReferencesChange={(referenceImages) => update(queueSlideRegeneration(patchVisual(slide, { referenceImages })))}
            characterReference={
              kind === "character" && slide.characterReferenceAssetId && slide.characterReferenceUrl
                ? {
                    assetId: slide.characterReferenceAssetId,
                    previewUrl: slide.characterReferenceUrl,
                    title: "Character",
                  }
                : null
            }
            onCharacterReferenceChange={
              kind === "character"
                ? (selection) => update(queueSlideRegeneration({
                    ...slide,
                    characterReferenceAssetId: selection?.assetId ?? null,
                    characterReferenceUrl: selection?.previewUrl ?? null,
                  }))
                : undefined
            }
          />
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => update(queueSlideRegeneration(slide))}
          >
            <ArrowsClockwise className="h-4 w-4" />
            Regenerate image
          </Button>
        </div>
      ) : null}

      {kind === "custom" ? (
        <div className="space-y-3 rounded-xl border p-4">
          <Button type="button" variant="outline" className="w-full" onClick={() => setCustomAssetOpen(true)}>
            {slide.visual.manualImageUrl ? "Change image" : "Select image"}
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

      {slide.visual.source === "reuse" ? (
        <div className="space-y-3 rounded-xl border p-4">
          <div className="space-y-2">
            <Label>Reuse from slide</Label>
            <Select
              value={slide.visual.reuseSlideId ?? "none"}
              onValueChange={(value) => update({
                ...queueSlideRegeneration(slide),
                visual: {
                  ...slide.visual,
                  source: "reuse",
                  reuseSlideId: value === "none" ? null : value,
                },
              })}
            >
              <SelectTrigger><SelectValue placeholder="Choose slide" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select slide</SelectItem>
                {reuseCandidates.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    Slide {candidate.index + 1} · {candidate.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => update(switchSlideKind(slide, "pack"))}
          >
            Switch to image pack
          </Button>
        </div>
      ) : null}

      {slide.visual.source !== "reuse" && reuseCandidates.length > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={() => update(switchVisualSource(slide, "reuse", reuseCandidates[0]?.id ?? null))}
        >
          Reuse another slide&apos;s image
        </Button>
      ) : null}

      <div className="space-y-2 border-t pt-4">
        <Button className="w-full" onClick={onResolve} disabled={busy}>
          <ArrowsClockwise className="mr-2 h-4 w-4" />
          Resolve slide {slideIndex + 1}
        </Button>
        <p className="text-xs text-muted-foreground">
          Resolve pending applies AI generation, pack rotation, and edits for slides that need it.
        </p>
      </div>
    </div>
  )
}
