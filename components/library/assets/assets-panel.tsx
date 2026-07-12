"use client"

import { Images } from "@phosphor-icons/react"

import { AssetCard, type AssetCardMode } from "@/components/library/assets/asset-card"
import { EmptyState, LoadingGrid, RetryState } from "@/components/library/history/history-states"
import type { PaginatedState } from "@/components/library/history/types"
import { historyGridColsClass } from "@/components/library/history/utils"
import { ASSET_CATEGORY_LABELS } from "@/lib/assets/library"
import type { AssetCategory, AssetRecord, AssetType, AssetVisibility } from "@/lib/assets/types"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

type AssetsPanelProps = {
  visibility: AssetVisibility | "all"
  category: AssetCategory | "all"
  state: PaginatedState<AssetRecord>
  onRefresh: () => void
  onUpload?: () => void
  currentUserId: string | null
  mode?: AssetCardMode
  onOpen: (asset: AssetRecord) => void
  onSelect?: (asset: AssetRecord) => void
  onSaveExample?: (asset: AssetRecord) => void
  onAnimate?: (asset: AssetRecord) => void
  onCopy?: (url: string, type: AssetType) => void
  onReference?: (url: string) => void
  onDownload?: (url: string, type: AssetType, title?: string) => void
  onEdit?: (asset: AssetRecord) => void
  onDelete?: (asset: AssetRecord) => void
  onEditImage?: (url: string) => void
  columnCount: number
  onColumnCountChange: (value: number) => void
  emptyActionLabel?: string
  className?: string
}

export function AssetsPanel({
  visibility,
  category,
  state,
  onRefresh,
  onUpload,
  currentUserId,
  mode = "browse",
  onOpen,
  onSelect,
  onSaveExample,
  onAnimate,
  onCopy,
  onReference,
  onDownload,
  onEdit,
  onDelete,
  onEditImage,
  columnCount,
  onColumnCountChange,
  emptyActionLabel = "Create asset",
  className,
}: AssetsPanelProps) {
  const emptyTitle =
    category !== "all"
      ? `No ${ASSET_CATEGORY_LABELS[category]} yet`
      : visibility === "private"
        ? "No private assets yet"
        : "Nothing here yet"

  const gridColsClass = historyGridColsClass(columnCount)

  return (
    <section className={cn("w-full space-y-3", className)}>
      {state.initialLoading ? (
        <LoadingGrid label="Loading assets..." />
      ) : state.error ? (
        <RetryState centered message={state.error} onRetry={onRefresh} />
      ) : state.items.length === 0 ? (
        <EmptyState
          centered
          icon={<Images className="h-7 w-7" />}
          title={emptyTitle}
          description={
            mode === "select"
              ? "Upload a file or save something from history to pick it here."
              : "Drop a file anywhere on this page, or use Upload."
          }
          action={
            onUpload ? (
              <Button onClick={onUpload}>{emptyActionLabel}</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
            <div>
              Showing {state.items.length} of {state.pagination.total}
            </div>
            <div className="flex items-center gap-2 lg:hidden">
              <span className="text-xs">
                Cols: <span className="font-medium text-primary">{columnCount}</span>
              </span>
              <Slider
                value={[columnCount]}
                onValueChange={(val) => onColumnCountChange(val[0])}
                min={2}
                max={6}
                step={1}
                className="w-20"
              />
            </div>
          </div>
          <div className={cn("grid gap-2 sm:gap-3", gridColsClass)}>
            {state.items.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                isOwner={currentUserId !== null && asset.userId === currentUserId}
                mode={mode}
                onOpen={onOpen}
                onSelect={onSelect}
                onSaveExample={onSaveExample}
                onAnimate={onAnimate}
                onCopy={onCopy}
                onReference={onReference}
                onDownload={onDownload}
                onEdit={onEdit}
                onDelete={onDelete}
                onEditImage={onEditImage}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
