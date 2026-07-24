"use client"

import * as React from "react"
import { useReducedMotion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { AuroraShaderBackground } from "@/components/ui/aurora-shader-background"
import { CarouselShotsShotCard } from "@/components/tools/carousel-shots/carousel-shots-shot-card"
import { CarouselShotsLightbox } from "@/components/tools/carousel-shots/carousel-shots-lightbox"
import { UpscaleCreditCost } from "@/components/tools/carousel-shots/upscale-credit-cost"
import type { UpscaleSettings } from "@/components/tools/upscale/upscale-settings-popover"
import { useCarouselShotActions } from "@/components/tools/carousel-shots/use-carousel-shot-actions"
import { useModels } from "@/hooks/use-models"
import { getCarouselReferencePublicUrl } from "@/lib/carousel-shots/constants"
import type { CarouselShotsMetadata, CarouselShotRecord } from "@/lib/carousel-shots/types"
import { DEFAULT_UPSCALE_CREDITS_COST } from "@/lib/upscale/constants"
import { cn } from "@/lib/utils"

function formatCreatedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

type CarouselShotsGenerationCardProps = {
  createdAt?: string
  generationId: string | null
  isGenerating?: boolean
  layout?: "card" | "viewport"
  metadata: CarouselShotsMetadata | null
  onShotsChange: (shots: CarouselShotRecord[]) => void
  upscaleSettings: UpscaleSettings
}

export function CarouselShotsGenerationCard({
  createdAt,
  generationId,
  isGenerating = false,
  layout = "viewport",
  metadata,
  onShotsChange,
  upscaleSettings,
}: CarouselShotsGenerationCardProps) {
  const [selectMode, setSelectMode] = React.useState(false)
  const [selectedShotIds, setSelectedShotIds] = React.useState<Set<string>>(new Set())
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null)
  const prefersReducedMotion = useReducedMotion()
  const { models: upscaleModels } = useModels("upscale")

  const shots = metadata?.shots ?? []
  const gridSize = metadata?.gridSize ?? 4
  const gridCols = gridSize === 9 ? "grid-cols-3 lg:grid-cols-3" : "grid-cols-2 lg:grid-cols-2"
  const isCardLayout = layout === "card"
  const animateShader = !prefersReducedMotion
  const fastShader = !prefersReducedMotion
  const referenceUrl = metadata?.referenceImageStoragePaths[0]
    ? getCarouselReferencePublicUrl(metadata.referenceImageStoragePaths[0])
    : null
  const allSelected = shots.length > 0 && selectedShotIds.size === shots.length

  const actions = useCarouselShotActions({
    generationId,
    shots,
    onShotsChange,
    upscaleSettings,
  })

  const selectedShots = shots.filter((shot) => selectedShotIds.has(shot.id))
  const pendingUpscaleCount = selectedShots.filter((shot) => !shot.upscaledUrl).length

  const upscaleCreditCost = React.useMemo(() => {
    const match = upscaleModels.find(
      (model) => model.identifier === upscaleSettings.modelIdentifier,
    )
    const cost = Number(match?.model_cost ?? DEFAULT_UPSCALE_CREDITS_COST)
    return Math.max(1, Number.isFinite(cost) ? cost : DEFAULT_UPSCALE_CREDITS_COST)
  }, [upscaleModels, upscaleSettings.modelIdentifier])

  const batchUpscaleCreditCost = pendingUpscaleCount * upscaleCreditCost

  const toggleSelected = (shotId: string, selected: boolean) => {
    setSelectedShotIds((current) => {
      const next = new Set(current)
      if (selected) next.add(shotId)
      else next.delete(shotId)
      return next
    })
  }

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedShotIds(new Set())
      return
    }
    setSelectedShotIds(new Set(shots.map((shot) => shot.id)))
  }

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-col gap-3",
        isCardLayout ? "h-auto" : "h-full lg:overflow-hidden",
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="mr-auto flex min-w-0 items-center gap-2">
          {referenceUrl ? (
            <div className="size-9 shrink-0 overflow-hidden rounded-md border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={referenceUrl}
                alt="Reference image"
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}
          {createdAt ? (
            <p className="truncate text-xs text-muted-foreground">{formatCreatedAt(createdAt)}</p>
          ) : null}
        </div>
        {selectMode ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={shots.length === 0}
            onClick={handleSelectAll}
          >
            {allSelected ? "Clear all" : "Select all"}
          </Button>
        ) : null}
        <button
          type="button"
          disabled={shots.length === 0 || isGenerating}
          aria-pressed={selectMode}
          aria-label={selectMode ? "Exit selection mode" : "Enter selection mode"}
          onClick={() => {
            setSelectMode((current) => !current)
            setSelectedShotIds(new Set())
          }}
          className={cn(
            "size-6 shrink-0 rounded-[5px] border-2 transition-colors",
            "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            "disabled:pointer-events-none disabled:opacity-50",
            selectMode
              ? "border-primary bg-primary"
              : "border-muted-foreground/55 bg-transparent hover:border-foreground/70",
          )}
        />
      </div>

      {metadata ? (
        <p className="shrink-0 text-sm text-muted-foreground">
          {metadata.shots.length} shots · {metadata.aspectRatio} ·{" "}
          {metadata.variationStrength.charAt(0).toUpperCase() + metadata.variationStrength.slice(1)}
        </p>
      ) : null}

      <div className="relative min-h-0 h-[min(560px,calc(100dvh-220px))] max-h-[70dvh]">
        {selectMode ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center px-2 pt-2">
            <div
              className={cn(
                "pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-border/80",
                "bg-background/95 px-3 py-2 shadow-xl ring-1 ring-black/5 backdrop-blur-md",
                "dark:ring-white/10",
              )}
            >
              <p className="px-1 text-sm font-medium tabular-nums">
                {selectedShots.length} selected
                {actions.batchProgress ? ` · ${actions.batchProgress}` : ""}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={selectedShots.length === 0}
                onClick={() => void actions.downloadShots(selectedShots)}
              >
                Download
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={selectedShots.length === 0}
                onClick={() => void actions.upscaleShots(selectedShots)}
              >
                Upscale
                <UpscaleCreditCost cost={batchUpscaleCreditCost} />
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                disabled={selectedShots.length === 0}
                onClick={() => void actions.upscaleAndDownloadShots(selectedShots)}
              >
                Upscale & Download
                <UpscaleCreditCost cost={batchUpscaleCreditCost} />
              </Button>
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "grid h-full w-full min-h-0 gap-2 transition-transform duration-200 sm:gap-3",
            gridCols,
            gridSize === 9 ? "grid-rows-3" : "grid-rows-2",
            selectMode && "origin-top scale-[0.94] translate-y-12",
          )}
        >
          {isGenerating
            ? Array.from({ length: gridSize }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="relative h-full min-h-0 overflow-hidden rounded-xl border bg-muted/30"
                >
                  <AuroraShaderBackground
                    className="rounded-[inherit]"
                    animate={animateShader}
                    fast={fastShader}
                  />
                </div>
              ))
            : shots.map((shot, index) => (
                <CarouselShotsShotCard
                  key={shot.id}
                  shot={shot}
                  selectMode={selectMode}
                  isSelected={selectedShotIds.has(shot.id)}
                  isUpscaling={actions.isUpscalingShot(shot.id)}
                  upscaleCreditCost={upscaleCreditCost}
                  onSelectChange={(selected) => toggleSelected(shot.id, selected)}
                  onOpen={() => setActiveIndex(index)}
                  onDownload={() => void actions.downloadShot(shot)}
                  onUpscale={() => void actions.upscaleOne(shot)}
                  onUpscaleAndDownload={() => void actions.upscaleAndDownloadShot(shot)}
                />
              ))}
        </div>
      </div>

      <CarouselShotsLightbox
        activeIndex={activeIndex}
        shots={shots}
        isUpscaling={activeIndex != null && actions.isUpscalingShot(shots[activeIndex]?.id ?? "")}
        upscaleCreditCost={upscaleCreditCost}
        onClose={() => setActiveIndex(null)}
        onNavigate={setActiveIndex}
        onDownload={(shot) => void actions.downloadShot(shot)}
        onUpscale={(shot) => void actions.upscaleOne(shot)}
        onUpscaleAndDownload={(shot) => void actions.upscaleAndDownloadShot(shot)}
      />
    </div>
  )
}
