"use client"

import * as React from "react"
import { FolderOpen, UploadSimple, X } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PhotoUpload, type ImageUpload } from "@/components/shared/upload/photo-upload"
import {
  AssetSelectionModal,
  type AssetSelectionPick,
} from "@/components/shared/modals/asset-selection-modal"
import { PillToggleGroup } from "@/components/shared/controls/pill-toggle-group"
import { ModelIcon } from "@/components/shared/icons/model-icon"
import { AspectRatioIcon } from "@/components/shared/selectors/aspect-ratio-selector"
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AnimatedSelectLabel,
  influencerControlPillClassName,
} from "@/components/tools/influencer/animated-control-item"
import { GenerateShaderButton } from "@/components/tools/influencer/generate-shader-button"
import {
  PromptControlMenuContent,
  PromptControlMenuGroup,
  PromptControlMenuItem,
} from "@/components/tools/influencer/prompt-control-menu"
import { useGenerationCreditEstimate } from "@/hooks/use-generation-credit-estimate"
import {
  DEFAULT_PHOTODUMP_ASPECT_RATIO,
  DEFAULT_PHOTODUMP_MODEL,
  DEFAULT_PHOTODUMP_SHOT_COUNT,
  PHOTODUMP_ASPECT_RATIOS,
  PHOTODUMP_CUSTOM_PRESET_ID,
  PHOTODUMP_MAX_AESTHETIC_REFS,
  PHOTODUMP_MAX_NOTE_LENGTH,
  PHOTODUMP_MODELS,
  PHOTODUMP_SHOT_COUNTS,
} from "@/lib/photodump/constants"
import { PHOTODUMP_PACKS } from "@/lib/photodump/packs"
import type { PhotodumpAspectRatio, PhotodumpModelId } from "@/lib/photodump/types"
import { getPhotodumpQualityParams } from "@/lib/photodump/quality"
import { PhotodumpPresetCard } from "@/components/tools/photodump/photodump-preset-card"
import { useEffectiveImageModels } from "@/lib/image/studio-tools"
import type { Model } from "@/lib/types/models"
import { cn } from "@/lib/utils"

export type PhotodumpFormState = {
  aestheticReferences: ImageUpload[]
  aspectRatio: PhotodumpAspectRatio
  model: PhotodumpModelId
  note: string
  presetId: string | null
  referenceImage: ImageUpload | null
  shotCount: number
}

type PhotodumpInputBoxProps = {
  activeSlotCount?: number
  form: PhotodumpFormState
  isGenerating: boolean
  onChange: (next: PhotodumpFormState) => void
  onGenerate: () => void
}

function formatModelName(identifier: string, name: string): string {
  if (name && !name.includes("/")) {
    return name
  }

  const shortIdentifier = identifier.split("/").pop() ?? identifier
  return shortIdentifier
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function usePhotodumpModels(): Model[] {
  const { models: imageModels } = useEffectiveImageModels()

  return React.useMemo(() => {
    const byId = new Map(imageModels.map((model) => [model.identifier, model]))
    return PHOTODUMP_MODELS.map(({ id }) => byId.get(id)).filter(
      (model): model is Model => Boolean(model),
    )
  }, [imageModels])
}

function filenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const name = pathname.split("/").pop()
    if (name && name.includes(".")) return name
  } catch {
    // ignore
  }
  return "reference.png"
}

export function PhotodumpInputBox({
  activeSlotCount = 0,
  form,
  isGenerating,
  onChange,
  onGenerate,
}: PhotodumpInputBoxProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const aestheticInputRef = React.useRef<HTMLInputElement>(null)
  const [assetModalOpen, setAssetModalOpen] = React.useState(false)
  const photodumpModels = usePhotodumpModels()
  const selectedModel = React.useMemo(
    () => photodumpModels.find((model) => model.identifier === form.model) ?? null,
    [photodumpModels, form.model],
  )
  const creditParameters = React.useMemo(
    () => getPhotodumpQualityParams(form.model),
    [form.model],
  )
  const estimatedCredits = useGenerationCreditEstimate({
    model: selectedModel,
    parameters: creditParameters,
    outputCount: form.shotCount,
  })

  const hasReference = Boolean(form.referenceImage?.file || form.referenceImage?.url)
  const isCustom = form.presetId === PHOTODUMP_CUSTOM_PRESET_ID
  const hasCustomRefs = form.aestheticReferences.length > 0
  const presetReady = Boolean(form.presetId) && (!isCustom || hasCustomRefs)

  const customPreviewUrls = React.useMemo(
    () =>
      form.aestheticReferences
        .map((ref) => ref.url)
        .filter((url): url is string => Boolean(url)),
    [form.aestheticReferences],
  )

  React.useEffect(() => {
    if (photodumpModels.length === 0) {
      return
    }

    const isCurrentModelAvailable = photodumpModels.some((model) => model.identifier === form.model)
    if (isCurrentModelAvailable) {
      return
    }

    const preferred =
      photodumpModels.find((model) => model.identifier === DEFAULT_PHOTODUMP_MODEL) ??
      photodumpModels[0]!

    onChange({
      ...form,
      model: preferred.identifier as PhotodumpModelId,
    })
  }, [form, onChange, photodumpModels])

  const handleAssetSelect = React.useCallback(
    async (pick: AssetSelectionPick) => {
      if (pick.assetType !== "image") {
        toast.error("Reference images only — pick an image asset")
        return
      }

      try {
        const response = await fetch(pick.url)
        if (!response.ok) {
          throw new Error("Failed to load asset")
        }
        const blob = await response.blob()
        const mimeType = blob.type.startsWith("image/") ? blob.type : "image/png"
        const file = new File([blob], filenameFromUrl(pick.url), { type: mimeType })
        onChange({
          ...form,
          referenceImage: {
            file,
            url: pick.previewUrl || pick.url,
          },
        })
      } catch {
        toast.error("Could not load that asset")
      }
    },
    [form, onChange],
  )

  const addAestheticFiles = React.useCallback(
    (files: FileList | File[]) => {
      const incoming = Array.from(files).filter((file) => file.type.startsWith("image/"))
      if (incoming.length === 0) {
        toast.error("Please choose image files")
        return
      }

      const remaining = PHOTODUMP_MAX_AESTHETIC_REFS - form.aestheticReferences.length
      if (remaining <= 0) {
        toast.error(`At most ${PHOTODUMP_MAX_AESTHETIC_REFS} aesthetic references`)
        return
      }

      const nextRefs = [...form.aestheticReferences]
      for (const file of incoming.slice(0, remaining)) {
        nextRefs.push({
          file,
          url: URL.createObjectURL(file),
        })
      }

      onChange({
        ...form,
        presetId: PHOTODUMP_CUSTOM_PRESET_ID,
        aestheticReferences: nextRefs,
      })
    },
    [form, onChange],
  )

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-5 p-4">
        <div className="space-y-2">
          <Label>Subject photo</Label>
          <div className="h-[160px] shrink-0 overflow-hidden rounded-lg">
            <PhotoUpload
              value={form.referenceImage}
              onChange={(referenceImage) => onChange({ ...form, referenceImage })}
              title="Your selfie"
              description="Clear face, well lit — identity locks from this photo"
              className="h-full"
              minHeight="h-full"
              maxHeight="h-full"
              previewFit="contain"
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              if (!file.type.startsWith("image/")) {
                toast.error("Please choose an image file")
                return
              }
              onChange({
                ...form,
                referenceImage: { file, url: URL.createObjectURL(file) },
              })
              event.target.value = ""
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadSimple className="size-4" weight="bold" />
              Upload
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setAssetModalOpen(true)}
            >
              <FolderOpen className="size-4" weight="bold" />
              Asset
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Preset</Label>
          <div className="max-h-[min(42vh,420px)] space-y-2 overflow-y-auto pr-1">
            {PHOTODUMP_PACKS.map((pack) => (
              <PhotodumpPresetCard
                key={pack.id}
                pack={pack}
                selected={form.presetId === pack.id}
                customPreviewUrls={
                  pack.id === PHOTODUMP_CUSTOM_PRESET_ID ? customPreviewUrls : undefined
                }
                onSelect={() => {
                  if (pack.id === PHOTODUMP_CUSTOM_PRESET_ID) {
                    onChange({ ...form, presetId: pack.id })
                    aestheticInputRef.current?.click()
                    return
                  }
                  onChange({ ...form, presetId: pack.id })
                }}
              />
            ))}
          </div>
          <input
            ref={aestheticInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files?.length) {
                addAestheticFiles(event.target.files)
              }
              event.target.value = ""
            }}
          />
          {isCustom ? (
            <div className="space-y-2 rounded-xl border border-border/60 bg-muted/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">Aesthetic references (this run)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => aestheticInputRef.current?.click()}
                  disabled={form.aestheticReferences.length >= PHOTODUMP_MAX_AESTHETIC_REFS}
                >
                  Add
                </Button>
              </div>
              {form.aestheticReferences.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Upload 1–{PHOTODUMP_MAX_AESTHETIC_REFS} images that define the look you want.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {form.aestheticReferences.map((ref, index) => (
                    <div key={ref.url ?? index} className="relative aspect-square overflow-hidden rounded-lg border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ref.url} alt="" className="size-full object-cover" />
                      <button
                        type="button"
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                        onClick={() => {
                          onChange({
                            ...form,
                            aestheticReferences: form.aestheticReferences.filter((_, i) => i !== index),
                          })
                        }}
                        aria-label="Remove reference"
                      >
                        <X className="size-3" weight="bold" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>Shots</Label>
          <PillToggleGroup
            aria-label="Shot count"
            value={String(form.shotCount)}
            onValueChange={(value) => {
              const parsed = Number(value)
              if (PHOTODUMP_SHOT_COUNTS.includes(parsed as (typeof PHOTODUMP_SHOT_COUNTS)[number])) {
                onChange({ ...form, shotCount: parsed })
              }
            }}
            options={PHOTODUMP_SHOT_COUNTS.map((count) => ({
              value: String(count),
              label: String(count),
            }))}
          />
        </div>

        <div className="space-y-2">
          <Label>Aspect ratio</Label>
          <PillToggleGroup
            aria-label="Aspect ratio"
            value={form.aspectRatio}
            onValueChange={(value) => {
              if (PHOTODUMP_ASPECT_RATIOS.includes(value as PhotodumpAspectRatio)) {
                onChange({ ...form, aspectRatio: value as PhotodumpAspectRatio })
              }
            }}
            options={PHOTODUMP_ASPECT_RATIOS.map((ratio) => ({
              value: ratio,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <AspectRatioIcon ratio={ratio} />
                  {ratio}
                </span>
              ),
            }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="photodump-model">Model</Label>
          <Select
            value={form.model}
            onValueChange={(value) => onChange({ ...form, model: value as PhotodumpModelId })}
            disabled={photodumpModels.length === 0}
          >
            <SelectTrigger
              id="photodump-model"
              hideChevron
              className={cn(influencerControlPillClassName, "w-full justify-between")}
            >
              <SelectValue placeholder="Select model">
                {selectedModel ? (
                  <div className="flex min-w-0 items-center gap-2">
                    <ModelIcon identifier={selectedModel.identifier} size={16} />
                    <AnimatedSelectLabel
                      value={formatModelName(selectedModel.identifier, selectedModel.name)}
                    />
                  </div>
                ) : (
                  <span className="text-muted-foreground">Loading models…</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <PromptControlMenuContent className="min-w-[14rem]">
              <PromptControlMenuGroup label="Models">
                {photodumpModels.map((model) => (
                  <PromptControlMenuItem
                    key={model.identifier}
                    value={model.identifier}
                    icon={<ModelIcon identifier={model.identifier} size={16} />}
                    label={formatModelName(model.identifier, model.name)}
                    description={model.description ?? undefined}
                  />
                ))}
              </PromptControlMenuGroup>
            </PromptControlMenuContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="photodump-note">Note (optional)</Label>
          <Textarea
            id="photodump-note"
            value={form.note}
            onChange={(event) =>
              onChange({
                ...form,
                note: event.target.value.slice(0, PHOTODUMP_MAX_NOTE_LENGTH),
              })
            }
            placeholder="e.g. keep the red jacket"
            rows={2}
          />
        </div>

        <GenerateShaderButton
          layout="bar"
          isReady={hasReference && presetReady}
          isGenerating={isGenerating}
          allowConcurrent
          activeSlotCount={activeSlotCount}
          onGenerate={onGenerate}
          creditCost={estimatedCredits ?? selectedModel?.model_cost ?? "-"}
          label="Generate dump"
        />
      </CardContent>

      <AssetSelectionModal
        open={assetModalOpen}
        onOpenChange={setAssetModalOpen}
        onSelect={(pick) => void handleAssetSelect(pick)}
        allowedAssetTypes={["image"]}
        defaultTab="assets"
      />
    </Card>
  )
}

export const DEFAULT_PHOTODUMP_FORM: PhotodumpFormState = {
  aestheticReferences: [],
  aspectRatio: DEFAULT_PHOTODUMP_ASPECT_RATIO,
  model: DEFAULT_PHOTODUMP_MODEL,
  note: "",
  presetId: null,
  referenceImage: null,
  shotCount: DEFAULT_PHOTODUMP_SHOT_COUNT,
}
