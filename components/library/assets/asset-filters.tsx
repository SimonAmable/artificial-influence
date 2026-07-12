"use client"

import { ASSET_CATEGORIES, ASSET_CATEGORY_LABELS } from "@/lib/assets/library"
import type { AssetCategory, AssetVisibility } from "@/lib/assets/types"
import { ASSET_SOURCES } from "@/components/library/assets/constants"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"

export function AssetFilterOptions({
  assetVisibility,
  onAssetVisibilityChange,
  assetCategory,
  onAssetCategoryChange,
  assetSource,
  onAssetSourceChange,
  columnCount,
  onColumnCountChange,
  showColumnSlider = false,
  lockedCategory,
}: {
  assetVisibility: AssetVisibility | "all"
  onAssetVisibilityChange: (visibility: AssetVisibility | "all") => void
  assetCategory: AssetCategory | "all"
  onAssetCategoryChange: (category: AssetCategory | "all") => void
  assetSource: string
  onAssetSourceChange: (source: string) => void
  columnCount: number
  onColumnCountChange: (value: number) => void
  showColumnSlider?: boolean
  /** When set, category filter is fixed (e.g. character picker). */
  lockedCategory?: AssetCategory
}) {
  return (
    <div className="space-y-4 rounded-2xl bg-card p-4 text-foreground">
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Visibility
        </label>
        <div className="flex gap-1.5">
          <Button
            variant={assetVisibility === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => onAssetVisibilityChange("all")}
            className="h-8 rounded-full px-3 py-1 text-xs"
          >
            All
          </Button>
          <Button
            variant={assetVisibility === "private" ? "default" : "outline"}
            size="sm"
            onClick={() => onAssetVisibilityChange("private")}
            className="h-8 rounded-full px-3 py-1 text-xs"
          >
            Private
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Category
        </label>
        <div className="flex max-h-[120px] flex-wrap gap-1.5 overflow-y-auto pr-1">
          {!lockedCategory ? (
            <Button
              variant={assetCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => onAssetCategoryChange("all")}
              className="h-8 rounded-full px-3 py-1 text-xs"
            >
              All categories
            </Button>
          ) : null}
          {(lockedCategory ? [lockedCategory] : ASSET_CATEGORIES).map((cat) => (
            <Button
              key={cat}
              variant={assetCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => onAssetCategoryChange(cat)}
              className="h-8 rounded-full px-3 py-1 text-xs"
              disabled={Boolean(lockedCategory)}
            >
              {ASSET_CATEGORY_LABELS[cat]}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Source Tool
        </label>
        <div className="flex max-h-[140px] flex-wrap gap-1.5 overflow-y-auto pr-1">
          {ASSET_SOURCES.map((src) => (
            <Button
              key={src.value}
              variant={assetSource === src.value ? "default" : "outline"}
              size="sm"
              onClick={() => onAssetSourceChange(src.value)}
              className="h-8 rounded-full px-3 py-1 text-xs"
            >
              {src.label}
            </Button>
          ))}
        </div>
      </div>

      {showColumnSlider ? (
        <div className="space-y-2 border-t border-border/50 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Grid Columns
            </span>
            <span className="text-sm font-medium text-primary">{columnCount}</span>
          </div>
          <Slider
            value={[columnCount]}
            onValueChange={(val) => onColumnCountChange(val[0])}
            min={2}
            max={6}
            step={1}
            className="py-2"
          />
        </div>
      ) : null}
    </div>
  )
}
