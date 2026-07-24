"use client"

import * as React from "react"
import { FolderOpen, UploadSimple } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { PhotoUpload, type ImageUpload } from "@/components/shared/upload/photo-upload"
import {
  AssetSelectionModal,
  type AssetSelectionPick,
} from "@/components/shared/modals/asset-selection-modal"
import { PillToggleGroup } from "@/components/shared/controls/pill-toggle-group"
import { ModelIcon } from "@/components/shared/icons/model-icon"
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
  CAROUSEL_GRID_SIZES,
  CAROUSEL_PANEL_ASPECT_RATIOS,
  CAROUSEL_SHOTS_MODELS,
  CAROUSEL_VARIATION_STRENGTHS,
  DEFAULT_CAROUSEL_SHOTS_MODEL,
} from "@/lib/carousel-shots/constants"
import type {
  CarouselGridSize,
  CarouselPanelAspectRatio,
  CarouselShotsModelId,
  CarouselVariationStrength,
} from "@/lib/carousel-shots/types"
import { useEffectiveImageModels } from "@/lib/image/studio-tools"
import type { Model } from "@/lib/types/models"
import { cn } from "@/lib/utils"

function getCarouselCreditParameters(model: CarouselShotsModelId): Record<string, unknown> {
  switch (model) {
    case "openai/gpt-image-2":
      return { quality: "high" }
    case "google/nano-banana-2":
      return { resolution: "4k" }
    case "bytedance/seedream-5-pro":
      return { resolution: "2K" }
    default: {
      const _exhaustive: never = model
      return _exhaustive
    }
  }
}

export type CarouselShotsFormState = {
  aspectRatio: CarouselPanelAspectRatio
  gridSize: CarouselGridSize
  model: CarouselShotsModelId
  referenceImage: ImageUpload | null
  variationStrength: CarouselVariationStrength
}

type CarouselShotsInputBoxProps = {
  activeSlotCount?: number
  form: CarouselShotsFormState
  isGenerating: boolean
  onChange: (next: CarouselShotsFormState) => void
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

function useCarouselShotModels(): Model[] {
  const { models: imageModels } = useEffectiveImageModels()

  return React.useMemo(() => {
    const byId = new Map(imageModels.map((model) => [model.identifier, model]))
    return CAROUSEL_SHOTS_MODELS.map(({ id }) => byId.get(id)).filter(
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
    // ignore invalid URLs
  }
  return "reference.png"
}

export function CarouselShotsInputBox({
  activeSlotCount = 0,
  form,
  isGenerating,
  onChange,
  onGenerate,
}: CarouselShotsInputBoxProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [assetModalOpen, setAssetModalOpen] = React.useState(false)
  const carouselModels = useCarouselShotModels()
  const selectedModel = React.useMemo(
    () => carouselModels.find((model) => model.identifier === form.model) ?? null,
    [carouselModels, form.model],
  )
  const creditParameters = React.useMemo(
    () => getCarouselCreditParameters(form.model),
    [form.model],
  )
  const estimatedCredits = useGenerationCreditEstimate({
    model: selectedModel,
    parameters: creditParameters,
    outputCount: 1,
  })
  const hasReference = Boolean(form.referenceImage?.file || form.referenceImage?.url)

  React.useEffect(() => {
    if (carouselModels.length === 0) {
      return
    }

    const isCurrentModelAvailable = carouselModels.some((model) => model.identifier === form.model)
    if (isCurrentModelAvailable) {
      return
    }

    const preferred =
      carouselModels.find((model) => model.identifier === DEFAULT_CAROUSEL_SHOTS_MODEL) ??
      carouselModels[0]!

    onChange({
      ...form,
      model: preferred.identifier as CarouselShotsModelId,
    })
  }, [carouselModels, form, onChange])

  const handleFileUpload = React.useCallback(
    (file?: File) => {
      if (!file || !file.type.startsWith("image/")) {
        toast.error("Please choose an image file")
        return
      }
      onChange({
        ...form,
        referenceImage: {
          file,
          url: URL.createObjectURL(file),
        },
      })
    },
    [form, onChange],
  )

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

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-5 p-4">
        <div className="space-y-2">
          <Label>Reference image</Label>
          <div className="h-[180px] shrink-0 overflow-hidden rounded-lg">
            <PhotoUpload
              value={form.referenceImage}
              onChange={(referenceImage) => onChange({ ...form, referenceImage })}
              title="Reference photo"
              description="Upload the subject, outfit, and scene to keep consistent"
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
              handleFileUpload(event.target.files?.[0])
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
              Select asset
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Grid size</Label>
          <PillToggleGroup
            aria-label="Grid size"
            value={String(form.gridSize)}
            onValueChange={(value) => {
              if (value === "4" || value === "9") {
                onChange({ ...form, gridSize: Number(value) as CarouselGridSize })
              }
            }}
            options={CAROUSEL_GRID_SIZES.map((size) => ({
              value: String(size),
              label: `${size} shots`,
            }))}
          />
        </div>

        <div className="space-y-2">
          <Label>Panel aspect ratio</Label>
          <PillToggleGroup
            aria-label="Panel aspect ratio"
            value={form.aspectRatio}
            onValueChange={(value) => {
              if (CAROUSEL_PANEL_ASPECT_RATIOS.includes(value as CarouselPanelAspectRatio)) {
                onChange({ ...form, aspectRatio: value as CarouselPanelAspectRatio })
              }
            }}
            options={CAROUSEL_PANEL_ASPECT_RATIOS.map((ratio) => ({
              value: ratio,
              label: ratio,
            }))}
          />
        </div>

        <div className="space-y-2">
          <Label>Variation strength</Label>
          <PillToggleGroup
            aria-label="Variation strength"
            value={form.variationStrength}
            onValueChange={(value) => {
              if (CAROUSEL_VARIATION_STRENGTHS.includes(value as CarouselVariationStrength)) {
                onChange({ ...form, variationStrength: value as CarouselVariationStrength })
              }
            }}
            options={CAROUSEL_VARIATION_STRENGTHS.map((strength) => ({
              value: strength,
              label: strength.charAt(0).toUpperCase() + strength.slice(1),
            }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="carousel-model">Model</Label>
          <Select
            value={form.model}
            onValueChange={(value) =>
              onChange({ ...form, model: value as CarouselShotsModelId })
            }
            disabled={carouselModels.length === 0}
          >
            <SelectTrigger
              id="carousel-model"
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
                {carouselModels.map((model) => (
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
          <p className="text-xs text-muted-foreground">
            Highest available quality is used automatically.
          </p>
        </div>

        <GenerateShaderButton
          layout="bar"
          isReady={hasReference}
          isGenerating={isGenerating}
          allowConcurrent
          activeSlotCount={activeSlotCount}
          onGenerate={onGenerate}
          creditCost={estimatedCredits ?? selectedModel?.model_cost ?? "-"}
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
