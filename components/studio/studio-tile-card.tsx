"use client"

import * as React from "react"
import Image from "next/image"
import {
  ArrowsClockwise,
  ArrowsOutSimple,
  Copy,
  DownloadSimple,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { StudioTile } from "@/lib/studio/types"

export interface StudioTileActions {
  onOpen?: (tile: StudioTile) => void
  onEdit?: (tile: StudioTile) => void
  onRecreate?: (tile: StudioTile) => void
  onCopyImage?: (tile: StudioTile) => void
  onDownload?: (tile: StudioTile) => void
  onDelete?: (tile: StudioTile) => void
}

interface StudioTileCardProps {
  tile: StudioTile
  selected: boolean
  selectionIndex?: number | null
  zoom: number
  onSelect: (tile: StudioTile) => void
  onMoveEnd?: (tile: StudioTile, next: { x: number; y: number }) => void
  onNaturalSize?: (tile: StudioTile, size: { width: number; height: number }) => void
  actions?: StudioTileActions
}

function ActionButton({
  label,
  onClick,
  destructive,
  children,
}: {
  label: string
  onClick: () => void
  destructive?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        "pointer-events-auto flex size-7 items-center justify-center rounded-md bg-black/70 text-white/90 shadow-sm backdrop-blur-sm transition-colors",
        destructive ? "hover:bg-destructive hover:text-white" : "hover:bg-white/20",
      )}
      onPointerDown={(event) => {
        event.stopPropagation()
        event.preventDefault()
      }}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      {children}
    </button>
  )
}

export function StudioTileCard({
  tile,
  selected,
  selectionIndex = null,
  zoom,
  onSelect,
  onMoveEnd,
  onNaturalSize,
  actions,
}: StudioTileCardProps) {
  const dragRef = React.useRef<{
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
  } | null>(null)
  const [draftPosition, setDraftPosition] = React.useState<{ x: number; y: number } | null>(null)
  const measuredRef = React.useRef(false)
  const canAct = tile.status === "completed" && Boolean(tile.url)

  const x = draftPosition?.x ?? tile.x
  const y = draftPosition?.y ?? tile.y
  const inverseZoom = 1 / Math.max(zoom, 0.01)

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.stopPropagation()
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: tile.x,
      originY: tile.y,
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    const dx = (event.clientX - dragRef.current.startX) / Math.max(zoom, 0.01)
    const dy = (event.clientY - dragRef.current.startY) / Math.max(zoom, 0.01)
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      dragRef.current.moved = true
    }
    if (!dragRef.current.moved) return
    setDraftPosition({
      x: dragRef.current.originX + dx,
      y: dragRef.current.originY + dy,
    })
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (!drag) return

    if (!drag.moved) {
      onSelect(tile)
      return
    }

    const next = draftPosition ?? {
      x: drag.originX + (event.clientX - drag.startX) / Math.max(zoom, 0.01),
      y: drag.originY + (event.clientY - drag.startY) / Math.max(zoom, 0.01),
    }
    setDraftPosition(null)
    onMoveEnd?.(tile, next)
  }

  return (
    <div
      data-studio-tile
      className={cn(
        "group/tile absolute overflow-visible rounded-xl border bg-card shadow-sm transition-[box-shadow,border-color] duration-200",
        selected
          ? "z-10 border-primary ring-2 ring-primary/50"
          : "border-border/70 hover:border-border hover:shadow-md",
        tile.status === "failed" && "border-destructive/70",
        tile.status === "pending" && "ring-1 ring-primary/20",
      )}
      style={{
        left: x,
        top: y,
        width: tile.width,
        height: tile.height,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={(event) => {
        event.stopPropagation()
        if (canAct) actions?.onOpen?.(tile)
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        {tile.status === "failed" ? (
          <div className="relative flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/40 p-4 text-center">
            <p className="relative text-xs font-medium text-destructive">Generation failed</p>
            {tile.prompt?.trim() ? (
              <p className="relative text-xs text-muted-foreground line-clamp-3">{tile.prompt}</p>
            ) : null}
          </div>
        ) : tile.status === "pending" || !tile.url ? (
          <div className="relative flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/40 p-4 text-center">
            <div className="absolute inset-0 animate-pulse bg-linear-to-br from-muted/80 via-muted/30 to-muted/80" />
            <Loader2 className="relative h-6 w-6 animate-spin text-muted-foreground" />
            <p className="relative text-xs text-muted-foreground line-clamp-3">
              {tile.prompt?.trim() || "Generating…"}
            </p>
          </div>
        ) : tile.kind === "video" ? (
          <video
            src={tile.url}
            className="h-full w-full object-cover"
            muted
            loop
            playsInline
            autoPlay
            onLoadedMetadata={(event) => {
              if (measuredRef.current) return
              const video = event.currentTarget
              if (!video.videoWidth || !video.videoHeight) return
              measuredRef.current = true
              onNaturalSize?.(tile, {
                width: video.videoWidth,
                height: video.videoHeight,
              })
            }}
          />
        ) : (
          <Image
            src={tile.url}
            alt={tile.prompt || "Studio generation"}
            fill
            unoptimized
            className="object-cover"
            sizes={`${Math.round(tile.width)}px`}
            onLoad={(event) => {
              if (measuredRef.current) return
              const image = event.currentTarget
              if (!image.naturalWidth || !image.naturalHeight) return
              measuredRef.current = true
              onNaturalSize?.(tile, {
                width: image.naturalWidth,
                height: image.naturalHeight,
              })
            }}
          />
        )}
      </div>
      {canAct ? (
        <div
          className={cn(
            "pointer-events-none absolute z-20 flex flex-col gap-1",
            "opacity-0 transition-opacity group-hover/tile:opacity-100 group-focus-within/tile:opacity-100",
            selected && "opacity-100",
          )}
          style={{
            top: 8 * inverseZoom,
            right: 8 * inverseZoom,
            transform: `scale(${inverseZoom})`,
            transformOrigin: "top right",
          }}
        >
          <ActionButton label="Full screen" onClick={() => actions?.onOpen?.(tile)}>
            <ArrowsOutSimple className="size-3.5" />
          </ActionButton>
          {actions?.onEdit && tile.kind === "image" ? (
            <ActionButton label="Edit image" onClick={() => actions.onEdit?.(tile)}>
              <PencilSimple className="size-3.5" />
            </ActionButton>
          ) : null}
          <ActionButton label="Recreate" onClick={() => actions?.onRecreate?.(tile)}>
            <ArrowsClockwise className="size-3.5" />
          </ActionButton>
          <ActionButton
            label={tile.kind === "video" ? "Copy video" : "Copy image"}
            onClick={() => actions?.onCopyImage?.(tile)}
          >
            <Copy className="size-3.5" />
          </ActionButton>
          <ActionButton label="Download" onClick={() => actions?.onDownload?.(tile)}>
            <DownloadSimple className="size-3.5" />
          </ActionButton>
          {tile.generationId || tile.id ? (
            <ActionButton label="Delete" destructive onClick={() => actions?.onDelete?.(tile)}>
              <Trash className="size-3.5" />
            </ActionButton>
          ) : null}
        </div>
      ) : null}
      {selected && tile.status === "completed" ? (
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground shadow-sm">
          {selectionIndex && selectionIndex > 0 ? `Ref ${selectionIndex}` : "Reference"}
        </div>
      ) : null}
    </div>
  )
}
