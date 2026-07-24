"use client"

import * as React from "react"
import { CircleNotch } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { CarouselShotsShotCard } from "@/components/tools/carousel-shots/carousel-shots-shot-card"
import { CarouselShotsLightbox } from "@/components/tools/carousel-shots/carousel-shots-lightbox"
import type { UpscaleSettings } from "@/components/tools/upscale/upscale-settings-popover"
import { useCarouselShotActions } from "@/components/tools/carousel-shots/use-carousel-shot-actions"
import { getCarouselReferencePublicUrl } from "@/lib/carousel-shots/constants"
import type { CarouselShotsMetadata, CarouselShotRecord } from "@/lib/carousel-shots/types"
import { cn } from "@/lib/utils"

function aspectRatioClass(aspectRatio: string) {
  if (aspectRatio === "3:4") return "aspect-[3/4]"
  if (aspectRatio === "4:5") return "aspect-[4/5]"
  return "aspect-[9/16]"
}

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
  onRegenerate?: () => void
  onShotsChange: (shots: CarouselShotRecord[]) => void
  regenerating?: boolean
  upscaleSettings: UpscaleSettings
}

export function CarouselShotsGenerationCard({
  createdAt,
  generationId,
  isGenerating = false,
  layout = "viewport",
  metadata,
  onRegenerate,
  onShotsChange,
  regenerating = false,
  upscaleSettings,
}: CarouselShotsGenerationCardProps) {
  const [selectMode, setSelectMode] = React.useState(false)
  const [selectedShotIds, setSelectedShotIds] = React.useState<Set<string>>(new Set())
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null)

  const shots = metadata?.shots ?? []
  const gridSize = metadata?.gridSize ?? 4
  const gridCols = gridSize === 9 ? "grid-cols-3 lg:grid-cols-3" : "grid-cols-2 lg:grid-cols-2"
  const isCardLayout = layout === "card"
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={shots.length === 0 || isGenerating}
          onClick={() => void actions.downloadShots(shots)}
        >
          {shots.length > 3 ? "Download ZIP" : "Download all"}
        </Button>
        {onRegenerate ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!metadata || regenerating}
            onClick={onRegenerate}
          >
            {regenerating ? (
              <>
                <CircleNotch className="mr-2 size-4 animate-spin" />
                Regenerating…
              </>
            ) : (
              "Regenerate"
            )}
          </Button>
        ) : null}
      </div>

      {metadata ? (
        <p className="shrink-0 text-sm text-muted-foreground">
          {metadata.shots.length} shots · {metadata.aspectRatio} ·{" "}
          {metadata.variationStrength.charAt(0).toUpperCase() + metadata.variationStrength.slice(1)}
        </p>
      ) : null}

      <div className="relative min-h-0">
        <div
          className={cn(
            "grid w-full min-h-0 gap-2 sm:gap-3",
            gridCols,
            gridSize === 9 ? "grid-rows-3" : "grid-rows-2",
            "h-[min(560px,calc(100dvh-220px))] max-h-[70dvh]",
            selectMode && "pb-16",
          )}
        >
          {isGenerating
            ? Array.from({ length: gridSize }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="h-full min-h-0 animate-pulse rounded-xl border bg-muted/30"
                />
              ))
            : shots.map((shot, index) => (
                <CarouselShotsShotCard
                  key={shot.id}
                  shot={shot}
                  selectMode={selectMode}
                  isSelected={selectedShotIds.has(shot.id)}
                  isUpscaling={actions.isUpscalingShot(shot.id)}
                  onSelectChange={(selected) => toggleSelected(shot.id, selected)}
                  onOpen={() => setActiveIndex(index)}
                  onDownload={() => void actions.downloadShot(shot)}
                  onUpscale={() => void actions.upscaleOne(shot)}
                  onUpscaleAndDownload={() => void actions.upscaleAndDownloadShot(shot)}
                />
              ))}
        </div>

        {selectMode ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-2 pb-2">
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
                disabled={selectedShots.length === 0}
                onClick={() => void actions.upscaleShots(selectedShots)}
              >
                Upscale
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={selectedShots.length === 0}
                onClick={() => void actions.upscaleAndDownloadShots(selectedShots)}
              >
                Upscale & Download
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <CarouselShotsLightbox
        activeIndex={activeIndex}
        aspectRatioClass={aspectRatioClass(metadata?.aspectRatio ?? "3:4")}
        shots={shots}
        isUpscaling={activeIndex != null && actions.isUpscalingShot(shots[activeIndex]?.id ?? "")}
        onClose={() => setActiveIndex(null)}
        onNavigate={setActiveIndex}
        onDownload={(shot) => void actions.downloadShot(shot)}
        onUpscale={(shot) => void actions.upscaleOne(shot)}
        onUpscaleAndDownload={(shot) => void actions.upscaleAndDownloadShot(shot)}
      />
    </div>
  )
}
