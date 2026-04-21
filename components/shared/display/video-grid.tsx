"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui/slider"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Row shape for completed videos (API + optimistic). */
export interface VideoHistoryItem {
  id?: string
  url: string
  model: string | null
  prompt?: string | null
  tool?: string | null
  createdAt?: string | null
  /** Client-only fallback when createdAt is missing */
  timestamp?: number
  parameters?: Record<string, unknown>
}

export type VideoGridItem =
  | { type: "generating"; id: string }
  | { type: "video"; data: VideoHistoryItem }

/** Legacy shape for backward compatibility. */
interface LegacyGeneratedVideo {
  url: string
  model: string
  timestamp: number
  parameters: Record<string, unknown>
}

interface VideoGridProps {
  /** When set, takes precedence over `videos` / `isGenerating`. */
  items?: VideoGridItem[]
  videos?: LegacyGeneratedVideo[]
  isGenerating?: boolean
  isLoadingSkeleton?: boolean
  className?: string
  /**
   * When true, native playback controls only appear while the pointer hovers the tile.
   * Coarse pointer / no-hover devices keep controls always available.
   */
  showNativeControlsOnHoverOnly?: boolean
}

function displayTime(item: VideoHistoryItem): number {
  if (item.createdAt) {
    const t = Date.parse(item.createdAt)
    if (!Number.isNaN(t)) return t
  }
  return item.timestamp ?? 0
}

function useFinePointerHoverDevice() {
  const subscribe = React.useCallback((onStoreChange: () => void) => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)")
    mq.addEventListener("change", onStoreChange)
    return () => mq.removeEventListener("change", onStoreChange)
  }, [])
  const getSnapshot = React.useCallback(
    () => window.matchMedia("(hover: hover) and (pointer: fine)").matches,
    [],
  )
  const getServerSnapshot = React.useCallback(() => false, [])
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

function VideoHistoryTile({
  item,
  showNativeControlsOnHoverOnly,
}: {
  item: VideoHistoryItem
  showNativeControlsOnHoverOnly: boolean
}) {
  const [hovered, setHovered] = React.useState(false)
  const [clientReady, setClientReady] = React.useState(false)
  const finePointer = useFinePointerHoverDevice()

  React.useEffect(() => {
    setClientReady(true)
  }, [])

  const nativeControlsVisible =
    !showNativeControlsOnHoverOnly ||
    !clientReady ||
    !finePointer ||
    hovered

  return (
    <div
      className="group relative isolate aspect-square w-full min-h-0 min-w-0 shrink-0 overflow-hidden rounded-lg bg-black/60"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="absolute inset-0 z-0 overflow-hidden">
        <video
          src={item.url}
          controls={nativeControlsVisible}
          className="block h-full w-full object-contain"
          playsInline
          preload="metadata"
        />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-2 pt-2 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="truncate text-xs font-medium text-white">{item.model ?? ""}</p>
        <p className="text-xs text-white/70">
          {displayTime(item) ? new Date(displayTime(item)).toLocaleString() : ""}
        </p>
      </div>
      <div className="absolute bottom-2 right-2 z-10 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        <Button size="sm" variant="ghost" className="pointer-events-auto h-8 px-2 text-white hover:bg-white/20" asChild>
          <a href={item.url} download>
            <Download className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  )
}

function GeneratingCell() {
  return (
    <div className="relative isolate aspect-square w-full min-h-0 min-w-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
      <div
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-zinc-800 to-zinc-700"
        style={{
          width: "0%",
          animation: "fillProgress 120s linear infinite",
          boxShadow: "2px 0 8px 0 rgba(255, 255, 255, 0.4)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-zinc-800/30 via-transparent to-zinc-900/30" />
      <div className="absolute bottom-2 left-2 z-10 rounded-md bg-black/50 px-2 py-1 text-[10px] font-medium text-white/90">
        Generating...
      </div>
    </div>
  )
}

export function VideoGrid({
  items: itemsProp,
  videos = [],
  isGenerating = false,
  isLoadingSkeleton = false,
  className,
  showNativeControlsOnHoverOnly = false,
}: VideoGridProps) {
  const [columnCount, setColumnCount] = React.useState(3)

  const items = React.useMemo((): VideoGridItem[] => {
    if (itemsProp !== undefined) {
      return itemsProp
    }
    const legacy: VideoGridItem[] = []
    if (isGenerating) {
      legacy.push({ type: "generating", id: "legacy-generating" })
    }
    for (const v of videos) {
      legacy.push({
        type: "video",
        data: {
          url: v.url,
          model: v.model,
          timestamp: v.timestamp,
          parameters: v.parameters,
        },
      })
    }
    return legacy
  }, [itemsProp, videos, isGenerating])

  const gridColsClass =
    {
      1: "grid-cols-1",
      2: "grid-cols-2",
      3: "grid-cols-3",
      4: "grid-cols-4",
    }[columnCount] || "grid-cols-3"

  const gapClass =
    {
      1: "gap-3 sm:gap-4 md:gap-6",
      2: "gap-2 sm:gap-3 md:gap-4",
      3: "gap-1.5 sm:gap-2 md:gap-3",
      4: "gap-1.5 sm:gap-2 md:gap-3",
    }[columnCount] || "gap-1.5 sm:gap-2 md:gap-3"

  const showSkeletonOnly = isLoadingSkeleton && items.length === 0

  return (
    <div className={cn("w-full h-full flex flex-col py-0", className)}>
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes fillProgress { 0% { width: 0%; } 100% { width: 100%; } }`,
        }}
      />
      <div className="p-3 sm:p-4 pb-3 sm:pb-4">
        <div className="flex w-full items-center justify-end gap-3 sm:gap-4">
          <label className="whitespace-nowrap text-xs font-medium text-foreground sm:text-sm">
            Columns: <span className="text-primary">{columnCount}</span>
          </label>
          <Slider
            value={[columnCount]}
            onValueChange={(value) => setColumnCount(value[0])}
            min={1}
            max={4}
            step={1}
            className="w-24 sm:w-32"
          />
        </div>
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto p-0 pt-0",
          "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
        )}
      >
        <div
          className={cn(
            "grid w-full auto-rows-auto content-start items-start justify-items-stretch p-2",
            gridColsClass,
            gapClass,
          )}
        >
          {showSkeletonOnly &&
            Array.from({ length: 9 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="aspect-square w-full min-h-0 min-w-0 shrink-0 animate-pulse rounded-lg bg-muted/30"
              />
            ))}

          {!showSkeletonOnly &&
            items.map((item) =>
              item.type === "generating" ? (
                <div key={item.id} className="min-w-0 shrink-0">
                  <GeneratingCell />
                </div>
              ) : (
                <div
                  key={item.data.id ?? `video-${item.data.url}-${displayTime(item.data)}`}
                  className="min-w-0 shrink-0"
                >
                  <VideoHistoryTile
                    item={item.data}
                    showNativeControlsOnHoverOnly={showNativeControlsOnHoverOnly}
                  />
                </div>
              ),
            )}
        </div>
      </div>
    </div>
  )
}
