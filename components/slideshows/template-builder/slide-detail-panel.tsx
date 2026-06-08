"use client"

import * as React from "react"
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
import { CharacterAssetPicker } from "@/components/slideshows/template-builder/character-asset-picker"
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

export function SlideDetailPanel({
  slide,
  slideIndex,
  blueprint,
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

  if (!slide) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
        Select a slide to configure its type, visuals, and copy behavior.
      </div>
    )
  }

  const currentSlide = slide
  const kind = inferSlideKind(currentSlide)

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

  return (
    <div className="space-y-5 rounded-xl border bg-card p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Selected slide</p>
        <h3 className="mt-1 text-lg font-semibold">Slide {slideIndex + 1}</h3>
      </div>

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
        <div className="space-y-2">
          <Label>Variation</Label>
          <Select
            value={currentSlide.content.variation}
            onValueChange={(value) => patchSlide({
              content: {
                ...currentSlide.content,
                variation: value as SlideshowSlideBlueprint["content"]["variation"],
              },
            })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fresh_each_run">Fresh each run</SelectItem>
              <SelectItem value="fixed">Fixed</SelectItem>
              <SelectItem value="prefer_unused">Prefer unused</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Text overlays</Label>
          <Select
            value={currentSlide.textTreatment}
            onValueChange={(value) => {
              const textTreatment = value as SlideshowSlideBlueprint["textTreatment"]
              if (textTreatment === "off") {
                patchSlide({ textTreatment: "off", overlays: [] })
                return
              }
              patchSlide({
                textTreatment: "overlay",
                overlays: currentSlide.overlays.length > 0
                  ? currentSlide.overlays
                  : [defaultOverlay()],
              })
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="off">Off</SelectItem>
              <SelectItem value="overlay">Overlay</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Off keeps the slide image-only. Put in-image copy in the generation prompt. Overlay adds caption text on top.
          </p>
        </div>
      </div>

      {kind === "character" ? (
        <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
          <CharacterAssetPicker
            label="Character reference"
            value={currentSlide.characterReferenceAssetId && currentSlide.characterReferenceUrl
              ? {
                  assetId: currentSlide.characterReferenceAssetId,
                  previewUrl: currentSlide.characterReferenceUrl,
                  title: "Character",
                }
              : null}
            onChange={(selection) => patchSlide({
              characterReferenceAssetId: selection?.assetId ?? null,
              characterReferenceUrl: selection?.previewUrl ?? null,
            })}
          />
          <div className="space-y-2">
            <Label>Character visual mode</Label>
            <Select
              value={currentSlide.characterMode ?? "generate"}
              onValueChange={(value) => {
                const mode = value as "generate" | "edit_pack"
                onSlideChange(applySlideKind({
                  ...currentSlide,
                  characterMode: mode,
                }, "character"))
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="generate">Generate new scene</SelectItem>
                <SelectItem value="edit_pack">Edit from image pack</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {currentSlide.characterMode === "edit_pack" ? (
            <div className="space-y-2">
              <Label>Image pack</Label>
              <Select
                value={currentSlide.visual.collectionId ?? "none"}
                onValueChange={(value) => patchVisual({
                  collectionId: value === "none" ? null : value,
                  source: "collection",
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
              <div className="space-y-2">
                <Label>AI edit prompt</Label>
                <Textarea
                  rows={3}
                  value={currentSlide.visual.aiEditPrompt ?? ""}
                  onChange={(event) => patchVisual({ aiEditPrompt: event.target.value })}
                  placeholder="Keep the same person. Change the scene to match the slide message."
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Generation prompt</Label>
              <Textarea
                rows={4}
                value={currentSlide.visual.prompt}
                onChange={(event) => patchVisual({ prompt: event.target.value })}
                placeholder="Same character as reference. Describe the new scene and message."
              />
            </div>
          )}
        </div>
      ) : null}

      {kind === "ai" ? (
        <div className="space-y-2">
          <Label>Generation prompt</Label>
          <Textarea
            rows={4}
            value={currentSlide.visual.prompt}
            onChange={(event) => patchVisual({ prompt: event.target.value })}
          />
          <div className="space-y-2">
            <Label>Content prompt</Label>
            <Textarea
              rows={3}
              value={currentSlide.content.prompt}
              onChange={(event) => patchSlide({
                content: { ...currentSlide.content, prompt: event.target.value },
              })}
            />
          </div>
        </div>
      ) : null}

      {kind === "pack" ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Image pack</Label>
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
          <div className="space-y-2">
            <Label>Optional AI edit prompt</Label>
            <Textarea
              rows={3}
              value={currentSlide.visual.aiEditPrompt ?? ""}
              onChange={(event) => patchVisual({
                aiEditPrompt: event.target.value.trim() ? event.target.value : null,
              })}
              placeholder="Leave empty to use the collection image as-is."
            />
          </div>
        </div>
      ) : null}

      {kind === "custom" ? (
        <div className="space-y-3">
          {currentSlide.visual.manualImageUrl ? (
            <img
              src={currentSlide.visual.manualImageUrl}
              alt=""
              className="aspect-[9/16] max-h-64 w-full rounded-xl object-cover"
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
    </div>
  )
}
