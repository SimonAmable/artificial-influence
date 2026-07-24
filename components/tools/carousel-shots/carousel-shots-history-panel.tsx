"use client"

import * as React from "react"
import { toast } from "sonner"

import { CarouselShotsGenerationCard } from "@/components/tools/carousel-shots/carousel-shots-generation-card"
import type {
  CarouselShotsPendingJob,
  CarouselShotsPendingResult,
} from "@/components/tools/carousel-shots/carousel-shots-right-panel"
import {
  useCarouselShotsHistory,
  type CarouselShotsHistoryItem,
} from "@/components/tools/carousel-shots/use-carousel-shots-history"
import type { UpscaleSettings } from "@/components/tools/upscale/upscale-settings-popover"
import type { CarouselShotsMetadata } from "@/lib/carousel-shots/types"
import { cn } from "@/lib/utils"

type CarouselShotsHistoryPanelProps = {
  historyRefreshKey: number
  pendingJobs: CarouselShotsPendingJob[]
  pendingResults: CarouselShotsPendingResult[]
  regeneratingId: string | null
  focusedGenerationId?: string | null
  upscaleSettings: UpscaleSettings
  onRegenerate: (generationId: string) => Promise<void>
  onShotsChange: (generationId: string, shots: CarouselShotsMetadata["shots"]) => void
}

export function CarouselShotsHistoryPanel({
  historyRefreshKey,
  pendingJobs,
  pendingResults,
  regeneratingId,
  focusedGenerationId = null,
  upscaleSettings,
  onRegenerate,
  onShotsChange,
}: CarouselShotsHistoryPanelProps) {
  const { error, isLoading, items, updateItemShots } = useCarouselShotsHistory(historyRefreshKey)

  const displayItems = React.useMemo(() => {
    const merged = [...items]

    for (const pending of pendingResults) {
      const existingIndex = merged.findIndex((item) => item.id === pending.generationId)
      const nextItem: CarouselShotsHistoryItem = {
        id: pending.generationId,
        createdAt: new Date().toISOString(),
        metadata: pending.metadata,
      }

      if (existingIndex >= 0) {
        merged[existingIndex] = {
          ...merged[existingIndex]!,
          metadata: pending.metadata,
        }
      } else {
        merged.unshift(nextItem)
      }
    }

    return merged.sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
  }, [items, pendingResults])

  const handleShotsChange = React.useCallback(
    (generationId: string, shots: CarouselShotsMetadata["shots"]) => {
      onShotsChange(generationId, shots)
      updateItemShots(generationId, shots)
    },
    [onShotsChange, updateItemShots],
  )

  React.useEffect(() => {
    if (error) {
      toast.error(error)
    }
  }, [error])

  React.useEffect(() => {
    if (!focusedGenerationId || isLoading) return

    const frame = window.requestAnimationFrame(() => {
      const element = document.querySelector(
        `[data-carousel-generation-id="${focusedGenerationId}"]`,
      )
      element?.scrollIntoView({ behavior: "smooth", block: "center" })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [displayItems, focusedGenerationId, isLoading])

  const hasPendingJobs = pendingJobs.length > 0

  if (isLoading && displayItems.length === 0 && !hasPendingJobs) {
    return (
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="h-[min(520px,58vh)] animate-pulse rounded-2xl border bg-muted/20"
          />
        ))}
      </div>
    )
  }

  if (!isLoading && displayItems.length === 0 && !hasPendingJobs) {
    return (
      <div className="flex min-h-[40dvh] flex-1 items-center justify-center rounded-xl border border-dashed bg-muted/10 p-8 text-center text-sm text-muted-foreground">
        No carousel shots yet. Generate your first set to see it here.
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pr-1">
      {pendingJobs.map((job) => (
        <div key={job.id} className="rounded-2xl border bg-card p-4">
          <CarouselShotsGenerationCard
            generationId={null}
            metadata={{
              kind: "carousel_shots",
              contactSheetUrl: "",
              contactSheetStoragePath: "",
              shots: [],
              gridSize: job.gridSize,
              aspectRatio: job.aspectRatio,
              variationStrength: "natural",
              model: "google/nano-banana-2",
              referenceImageStoragePaths: [],
            }}
            isGenerating
            layout="card"
            upscaleSettings={upscaleSettings}
            onShotsChange={() => {}}
          />
        </div>
      ))}

      {displayItems.map((item) => (
        <div
          key={item.id}
          data-carousel-generation-id={item.id}
          className={cn(
            "rounded-2xl border bg-card p-4 transition-shadow",
            focusedGenerationId === item.id && "ring-2 ring-primary shadow-md",
          )}
        >
          <CarouselShotsGenerationCard
            createdAt={item.createdAt}
            generationId={item.id}
            metadata={item.metadata}
            layout="card"
            regenerating={regeneratingId === item.id}
            upscaleSettings={upscaleSettings}
            onRegenerate={() => void onRegenerate(item.id)}
            onShotsChange={(shots) => handleShotsChange(item.id, shots)}
          />
        </div>
      ))}
    </div>
  )
}
