"use client"

import * as React from "react"
import { DownloadSimple } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ImageGrid, type GridItem } from "@/components/shared/display/image-grid"
import { downloadReferenceImageSlides } from "@/lib/client/download-reference-slides"
import { PHOTODUMP_TOOL } from "@/lib/photodump/constants"
import type { PhotodumpMetadata } from "@/lib/photodump/types"
import { isPhotodumpMetadata } from "@/lib/photodump/types"
import { cn } from "@/lib/utils"

type PhotodumpResultsPanelProps = {
  activeShotCount: number
  className?: string
  completedMetadata: PhotodumpMetadata | null
  isGenerating: boolean
}

function PhotodumpEmptyState() {
  return (
    <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Different Scenes. Same Star.
      </p>
      <p className="max-w-md text-sm text-muted-foreground sm:text-base">
        Upload your subject, pick a preset, and get a full photodump — one generation per shot,
        same face, new aesthetics.
      </p>
    </div>
  )
}

export function PhotodumpResultsPanel({
  activeShotCount,
  className,
  completedMetadata,
  isGenerating,
}: PhotodumpResultsPanelProps) {
  const gridItems = React.useMemo((): GridItem[] => {
    if (completedMetadata) {
      return completedMetadata.shots.map((shot) => ({
        type: "image" as const,
        data: {
          id: shot.id,
          url: shot.url,
          tool: PHOTODUMP_TOOL,
          aspectRatio: completedMetadata.aspectRatio,
        },
      }))
    }

    if (!isGenerating || activeShotCount <= 0) {
      return []
    }

    return Array.from({ length: activeShotCount }, (_, index) => ({
      type: "generating" as const,
      id: `photodump-pending-${index}`,
      phase: "generating" as const,
      tool: PHOTODUMP_TOOL,
    }))
  }, [activeShotCount, completedMetadata, isGenerating])

  const showEmpty = gridItems.length === 0 && !isGenerating

  const handleDownloadZip = React.useCallback(async () => {
    if (!completedMetadata) return
    const urls = completedMetadata.shots.map((shot) => shot.url)
    try {
      await downloadReferenceImageSlides(urls, completedMetadata.presetName.toLowerCase().replace(/\s+/g, "-"))
      toast.success("Download started")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed")
    }
  }, [completedMetadata])

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-3", className)}>
      {completedMetadata ? (
        <div className="flex shrink-0 items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{completedMetadata.presetName}</p>
            <p className="text-xs text-muted-foreground">
              {completedMetadata.shotCount} shots · {completedMetadata.aspectRatio}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void handleDownloadZip()}>
            <DownloadSimple className="size-4" weight="bold" />
            Download zip
          </Button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {showEmpty ? (
          <PhotodumpEmptyState />
        ) : (
          <ImageGrid
            items={gridItems}
            showColumnSlider
            initialColumnCount={3}
            className="h-auto pb-4"
          />
        )}
      </div>
    </div>
  )
}

export function metadataToPhotodumpResult(metadata: unknown): PhotodumpMetadata | null {
  return isPhotodumpMetadata(metadata) ? metadata : null
}
