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

function scrollChildIntoView(
  root: HTMLElement,
  child: HTMLElement,
  block: "start" | "center" = "start",
) {
  const rootRect = root.getBoundingClientRect()
  const childRect = child.getBoundingClientRect()

  if (block === "center") {
    const top =
      childRect.top - rootRect.top + root.scrollTop - (rootRect.height - childRect.height) / 2
    root.scrollTo({ top: Math.max(0, top), behavior: "smooth" })
    return
  }

  const top = childRect.top - rootRect.top + root.scrollTop - 8
  root.scrollTo({ top: Math.max(0, top), behavior: "smooth" })
}

type CarouselShotsHistoryPanelProps = {
  historyRefreshKey: number
  historyScrollNonce?: number
  pendingJobs: CarouselShotsPendingJob[]
  pendingResults: CarouselShotsPendingResult[]
  focusedGenerationId?: string | null
  upscaleSettings: UpscaleSettings
  onShotsChange: (generationId: string, shots: CarouselShotsMetadata["shots"]) => void
}

export function CarouselShotsHistoryPanel({
  historyRefreshKey,
  historyScrollNonce = 0,
  pendingJobs,
  pendingResults,
  focusedGenerationId = null,
  upscaleSettings,
  onShotsChange,
}: CarouselShotsHistoryPanelProps) {
  const { error, hasMore, isLoading, isLoadingMore, items, loadMore, updateItemShots } =
    useCarouselShotsHistory(historyRefreshKey)

  const scrollRootRef = React.useRef<HTMLDivElement | null>(null)
  const loadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null)

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
      const root = scrollRootRef.current
      if (!root) return

      const element = root.querySelector<HTMLElement>(
        `[data-carousel-generation-id="${focusedGenerationId}"]`,
      )
      if (element) {
        scrollChildIntoView(root, element, "center")
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [displayItems, focusedGenerationId, isLoading])

  React.useEffect(() => {
    if (!historyScrollNonce) return

    const frame = window.requestAnimationFrame(() => {
      const root = scrollRootRef.current
      if (!root) return

      const pendingElement = root.querySelector<HTMLElement>("[data-carousel-pending-job]")
      const newestGenerationElement = root.querySelector<HTMLElement>(
        "[data-carousel-generation-id]",
      )
      const target = pendingElement ?? newestGenerationElement

      if (target) {
        scrollChildIntoView(root, target, "start")
        return
      }

      root.scrollTo({ top: 0, behavior: "smooth" })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [displayItems, historyScrollNonce, pendingJobs])

  React.useEffect(() => {
    const root = scrollRootRef.current
    const target = loadMoreSentinelRef.current
    if (!root || !target || isLoading || isLoadingMore || !hasMore || error) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore()
        }
      },
      { root, rootMargin: "240px 0px" },
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [displayItems.length, error, hasMore, isLoading, isLoadingMore, loadMore])

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
    <div
      ref={scrollRootRef}
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pr-1"
    >
      {pendingJobs.map((job) => (
        <div
          key={job.id}
          data-carousel-pending-job
          data-carousel-pending-job-id={job.id}
          className="rounded-2xl border bg-card p-4"
        >
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
            upscaleSettings={upscaleSettings}
            onShotsChange={(shots) => handleShotsChange(item.id, shots)}
          />
        </div>
      ))}

      {hasMore ? (
        <div className="space-y-3 pb-2">
          <div ref={loadMoreSentinelRef} className="h-px w-full" aria-hidden />
          {isLoadingMore ? (
            <div className="h-[min(280px,32vh)] animate-pulse rounded-2xl border bg-muted/20" />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
