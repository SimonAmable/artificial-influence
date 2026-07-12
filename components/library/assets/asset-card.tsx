"use client"

import {
  ArrowsOutSimple,
  Copy,
} from "@phosphor-icons/react"

import { CardDropdownActions } from "@/components/library/history/card-dropdown-actions"
import { MediaPreview, MediaTypeIcon } from "@/components/library/history/media-preview"
import { formatRelativeDate } from "@/components/library/history/utils"
import { ASSET_CATEGORY_LABELS } from "@/lib/assets/library"
import type { AssetRecord, AssetType } from "@/lib/assets/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export type AssetCardMode = "browse" | "select"

type AssetCardProps = {
  asset: AssetRecord
  isOwner: boolean
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
}

export function AssetCard({
  asset,
  isOwner,
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
}: AssetCardProps) {
  const handlePrimary = () => {
    if (mode === "select" && onSelect) {
      onSelect(asset)
      return
    }
    onOpen(asset)
  }

  if (mode === "select") {
    return (
      <article className="group relative aspect-square overflow-hidden rounded-2xl border border-border/70 bg-card/45 shadow-sm transition-all hover:border-primary/50 hover:shadow-md">
        <MediaPreview
          type={asset.assetType}
          url={asset.thumbnailUrl || asset.url}
          playableUrl={asset.url}
          alt={asset.title}
          onOpen={asset.assetType === "audio" ? undefined : handlePrimary}
        />

        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between bg-black/50 p-3 opacity-0 transition-opacity duration-200 sm:group-hover:opacity-100">
          <div className="flex items-center justify-between">
            <Badge
              variant="secondary"
              className="gap-1 rounded-full border-none bg-black/60 px-2 py-0.5 text-[10px] capitalize text-white"
            >
              <MediaTypeIcon type={asset.assetType} className="h-2.5 w-2.5" />
              {asset.assetType}
            </Badge>
            <span className="text-[10px] font-medium text-white/80 drop-shadow-sm">
              {formatRelativeDate(asset.createdAt)}
            </span>
          </div>

          <div className="pr-1 text-left select-none">
            <p className="truncate text-xs font-semibold text-white drop-shadow-sm">{asset.title}</p>
            <p className="mt-0.5 text-[10px] font-medium text-white/85 drop-shadow-sm">
              {ASSET_CATEGORY_LABELS[asset.category]}
            </p>
          </div>

          <div className="pointer-events-auto flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              className="h-7 rounded-full border-none bg-white px-3 text-[10px] font-semibold text-black hover:bg-white/90"
              onClick={handlePrimary}
            >
              Select
            </Button>
          </div>
        </div>

        <div className="absolute inset-x-2 bottom-2 z-10 sm:hidden">
          <Button
            variant="secondary"
            size="sm"
            className="h-8 w-full rounded-full border-none bg-black/70 text-xs font-semibold text-white backdrop-blur"
            onClick={handlePrimary}
          >
            Select
          </Button>
        </div>
      </article>
    )
  }

  return (
    <article className="group relative aspect-square overflow-hidden rounded-2xl border border-border/70 bg-card/45 shadow-sm transition-all hover:border-foreground/20 hover:shadow-md">
      <MediaPreview
        type={asset.assetType}
        url={asset.thumbnailUrl || asset.url}
        playableUrl={asset.url}
        alt={asset.title}
        onOpen={asset.assetType === "audio" ? undefined : () => onOpen(asset)}
      />

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between bg-black/50 p-3 opacity-0 transition-opacity duration-200 sm:group-hover:opacity-100">
        <div className="pointer-events-auto flex items-center justify-between">
          <Badge
            variant="secondary"
            className="gap-1 rounded-full border-none bg-black/60 px-2 py-0.5 text-[10px] capitalize text-white"
          >
            <MediaTypeIcon type={asset.assetType} className="h-2.5 w-2.5" />
            {asset.assetType}
          </Badge>
          <span className="text-[10px] font-medium text-white/80 drop-shadow-sm">
            {formatRelativeDate(asset.createdAt)}
          </span>
        </div>

        <div className="pr-6 text-left select-none">
          <p className="truncate text-xs font-semibold text-white drop-shadow-sm">{asset.title}</p>
          <p className="mt-0.5 text-[10px] font-medium text-white/85 drop-shadow-sm">
            {ASSET_CATEGORY_LABELS[asset.category]}
          </p>
        </div>

        <div className="pointer-events-auto flex items-center justify-between gap-1">
          {asset.assetType !== "audio" ? (
            <Button
              variant="secondary"
              size="sm"
              className="h-7 w-7 rounded-full border-none bg-white/15 p-0 text-white transition-colors hover:bg-white/25"
              onClick={() => onOpen(asset)}
              title="Fullscreen"
            >
              <ArrowsOutSimple className="h-3.5 w-3.5" />
            </Button>
          ) : onCopy ? (
            <Button
              variant="secondary"
              size="sm"
              className="h-7 w-7 rounded-full border-none bg-white/15 p-0 text-white transition-colors hover:bg-white/25"
              onClick={() => onCopy(asset.url, asset.assetType)}
              title="Copy"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-1.5">
            {isOwner && onEdit ? (
              <Button
                variant="secondary"
                size="sm"
                className="h-7 rounded-full border-none bg-white px-2.5 text-[10px] font-semibold text-black transition-colors hover:bg-white/90"
                onClick={() => onEdit(asset)}
              >
                Edit
              </Button>
            ) : onReference ? (
              <Button
                variant="secondary"
                size="sm"
                className="h-7 rounded-full border-none bg-white px-2.5 text-[10px] font-semibold text-black transition-colors hover:bg-white/90"
                onClick={() => onReference(asset.url)}
              >
                Reference
              </Button>
            ) : null}
            {onCopy && onDownload && onDelete ? (
              <CardDropdownActions
                canEditImage={asset.assetType === "image"}
                canEditAsset={isOwner}
                canDelete={isOwner}
                canSaveExample={asset.assetType === "image"}
                canAnimate={asset.assetType === "image"}
                onEditAsset={onEdit ? () => onEdit(asset) : undefined}
                onEditImage={onEditImage ? () => onEditImage(asset.url) : undefined}
                onSaveExample={onSaveExample ? () => onSaveExample(asset) : undefined}
                onAnimate={onAnimate ? () => onAnimate(asset) : undefined}
                onCopy={() => onCopy(asset.url, asset.assetType)}
                onDownload={() => onDownload(asset.url, asset.assetType, asset.title)}
                onDelete={() => onDelete(asset)}
                className="h-7 w-7 rounded-full border-none bg-white/15 text-white transition-colors hover:bg-white/25"
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="absolute right-2 bottom-2 z-10 sm:hidden">
        {onCopy && onDownload && onDelete ? (
          <CardDropdownActions
            canEditImage={asset.assetType === "image"}
            canEditAsset={isOwner}
            canDelete={isOwner}
            canSaveExample={asset.assetType === "image"}
            canAnimate={asset.assetType === "image"}
            onEditAsset={onEdit ? () => onEdit(asset) : undefined}
            onEditImage={onEditImage ? () => onEditImage(asset.url) : undefined}
            onSaveExample={onSaveExample ? () => onSaveExample(asset) : undefined}
            onAnimate={onAnimate ? () => onAnimate(asset) : undefined}
            onCopy={() => onCopy(asset.url, asset.assetType)}
            onDownload={() => onDownload(asset.url, asset.assetType, asset.title)}
            onDelete={() => onDelete(asset)}
            className="h-8 w-8 rounded-full border border-white/10 bg-black/60 text-white backdrop-blur hover:bg-black/85"
          />
        ) : null}
      </div>
    </article>
  )
}
