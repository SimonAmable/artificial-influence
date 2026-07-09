"use client"

import * as React from "react"
import { ClockCounterClockwise, MagnifyingGlass } from "@phosphor-icons/react"

import { GenerationCard } from "@/components/library/history/generation-card"
import { EmptyState, LoadingGrid, RetryState } from "@/components/library/history/history-states"
import { emptyHistoryMessages } from "@/components/library/history/constants"
import type {
  FanvueGenerationActions,
  Generation,
  GenerationCardActionVariant,
  GenerationType,
  PaginatedState,
  SaveAssetDraft,
} from "@/components/library/history/types"
import { historyGridColsClass, historyPanelClassName } from "@/components/library/history/utils"
import type { AssetCategory, AssetType } from "@/lib/assets/types"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

type HistoryPanelProps = {
  actionVariant?: GenerationCardActionVariant
  activeType: GenerationType
  state: PaginatedState<Generation>
  items: Generation[]
  searchQuery: string
  onRefresh: () => void
  onLoadMore: () => void
  loadMoreRef: React.RefObject<HTMLDivElement | null>
  onOpen: (generation: Generation) => void
  onCopy: (url: string, type: AssetType) => void
  onDownload: (url: string, type: AssetType, title?: string) => void
  onDelete: (generation: Generation) => void
  columnCount: number
  onColumnCountChange: (value: number) => void
  onSave?: (draft: SaveAssetDraft) => void
  onSaveExample?: (generation: Generation) => void
  onAnimate?: (generation: Generation) => void
  onEditImage?: (url: string) => void
  fanvueActions?: FanvueGenerationActions
  getDefaultCategoryByMediaType?: (type: AssetType) => AssetCategory
  className?: string
}

export function HistoryPanel({
  actionVariant = "library",
  activeType,
  state,
  items,
  searchQuery,
  onRefresh,
  onLoadMore,
  loadMoreRef,
  onOpen,
  onCopy,
  onDownload,
  onDelete,
  columnCount,
  onColumnCountChange,
  onSave,
  onSaveExample,
  onAnimate,
  onEditImage,
  fanvueActions,
  getDefaultCategoryByMediaType,
  className,
}: HistoryPanelProps) {
  const gridColsClass = historyGridColsClass(columnCount)

  return (
    <section className={historyPanelClassName(className)}>
      {state.initialLoading ? (
        <LoadingGrid label="Loading history..." />
      ) : state.error && state.items.length === 0 ? (
        <RetryState centered message={state.error} onRetry={onRefresh} />
      ) : state.items.length === 0 ? (
        <EmptyState
          centered
          icon={<ClockCounterClockwise className="h-7 w-7" />}
          title={searchQuery ? `No results for "${searchQuery}"` : emptyHistoryMessages[activeType]}
        />
      ) : (
        <div className="space-y-3">
          <div className="mt-1 flex items-center justify-between gap-2 py-1 text-xs text-muted-foreground sm:text-sm">
            <div className="truncate pr-1">
              Showing {items.length} of {state.pagination.total}
              {searchQuery ? ` for "${searchQuery}"` : ""}
            </div>
            <div className="flex shrink-0 items-center gap-1.5 lg:hidden">
              <span className="text-[10px] sm:text-xs">
                Cols: <span className="font-medium text-primary">{columnCount}</span>
              </span>
              <Slider
                value={[columnCount]}
                onValueChange={(value) => onColumnCountChange(value[0])}
                min={2}
                max={6}
                step={1}
                className="w-14 sm:w-16"
              />
            </div>
          </div>

          {items.length === 0 ? (
            <EmptyState icon={<MagnifyingGlass className="h-7 w-7" />} title="No matching generations" />
          ) : (
            <div className={cn("grid gap-2 sm:gap-3", gridColsClass)}>
              {items.map((generation) => (
                <GenerationCard
                  key={generation.id}
                  generation={generation}
                  actionVariant={actionVariant}
                  onOpen={onOpen}
                  onCopy={onCopy}
                  onDownload={onDownload}
                  onDelete={onDelete}
                  onSave={onSave}
                  onSaveExample={onSaveExample}
                  onAnimate={onAnimate}
                  onEditImage={onEditImage}
                  fanvueActions={fanvueActions}
                  getDefaultCategoryByMediaType={getDefaultCategoryByMediaType}
                />
              ))}
            </div>
          )}

          {state.error ? <div className="text-center text-sm text-destructive">{state.error}</div> : null}
          {state.pagination.hasMore ? (
            <div className="space-y-3">
              <div ref={loadMoreRef} className="h-px w-full" aria-hidden />
              <div className="flex justify-center">
                <Button variant="outline" onClick={onLoadMore} disabled={state.loadingMore}>
                  {state.loadingMore ? "Loading more..." : "Load more"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
