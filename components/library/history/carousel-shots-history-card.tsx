"use client"

import { DownloadSimple, Trash } from "@phosphor-icons/react"

import { CardDropdownActions } from "@/components/library/history/card-dropdown-actions"
import type { Generation } from "@/components/library/history/types"
import { formatRelativeDate } from "@/components/library/history/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AssetType } from "@/lib/assets/types"
import { cn } from "@/lib/utils"

type CarouselShotsHistoryCardProps = {
  generation: Generation
  onOpen: (generation: Generation) => void
  onCopy: (url: string, type: AssetType) => void
  onDownload: (url: string, type: AssetType, title?: string) => void
  onDelete: (generation: Generation) => void
}

function MosaicPreview({
  previewUrls,
  extraShotCount,
}: {
  previewUrls: string[]
  extraShotCount: number
}) {
  const cells = Array.from({ length: 4 }, (_, index) => previewUrls[index] ?? null)

  return (
    <div className="relative h-full w-full bg-muted/30 p-1.5">
      <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-1">
        {cells.map((url, index) => (
          <div
            key={index}
            className="relative min-h-0 overflow-hidden rounded-md bg-muted/40"
          >
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
        ))}
      </div>
      {extraShotCount > 0 ? (
        <div className="absolute bottom-2 right-2 rounded-full bg-black/75 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
          +{extraShotCount}
        </div>
      ) : null}
    </div>
  )
}

export function CarouselShotsHistoryCard({
  generation,
  onOpen,
  onCopy,
  onDownload,
  onDelete,
}: CarouselShotsHistoryCardProps) {
  const summary = generation.carousel_summary
  const previewUrls = summary?.previewUrls ?? [generation.url]
  const shotCount = summary?.shotCount ?? previewUrls.length
  const extraShotCount = summary?.extraShotCount ?? Math.max(0, shotCount - 4)

  const dropdownProps = {
    canEditImage: false,
    canSaveExample: false,
    canAnimate: false,
    onCopy: () => onCopy(generation.url, generation.type),
    onDownload: () => onDownload(generation.url, generation.type, generation.type),
    onDelete: () => onDelete(generation),
  }

  return (
    <article className="group relative aspect-square overflow-hidden rounded-2xl border border-border/70 bg-card/45 shadow-sm transition-all hover:border-foreground/20 hover:shadow-md">
      <button
        type="button"
        className="absolute inset-0 z-0 h-full w-full cursor-pointer"
        onClick={() => onOpen(generation)}
        aria-label={`Open carousel set with ${shotCount} shots`}
      >
        <MosaicPreview previewUrls={previewUrls} extraShotCount={extraShotCount} />
      </button>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap gap-1.5 p-2">
        <Badge
          variant="secondary"
          className="rounded-full border-none bg-black/65 px-2 py-0.5 text-[10px] text-white"
        >
          Carousel
        </Badge>
        <Badge
          variant="secondary"
          className="rounded-full border-none bg-black/65 px-2 py-0.5 text-[10px] text-white"
        >
          {shotCount} shots
        </Badge>
        {summary?.aspectRatio ? (
          <Badge
            variant="secondary"
            className="rounded-full border-none bg-black/65 px-2 py-0.5 text-[10px] text-white"
          >
            {summary.aspectRatio}
          </Badge>
        ) : null}
        {summary?.hasHd ? (
          <Badge
            variant="secondary"
            className="rounded-full border-none bg-black/65 px-2 py-0.5 text-[10px] text-white"
          >
            HD
          </Badge>
        ) : null}
      </div>

      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/20 to-transparent p-3",
          "opacity-100 sm:opacity-0 sm:transition-opacity sm:duration-200 sm:group-hover:opacity-100",
        )}
      >
        <div className="pointer-events-auto flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-left text-xs font-semibold text-white">
              {shotCount} carousel shots
            </p>
            <p className="text-[10px] text-white/75">
              {formatRelativeDate(generation.created_at)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 rounded-full border-none bg-white px-2.5 text-[10px] font-semibold text-black hover:bg-white/90"
              onClick={() => onOpen(generation)}
            >
              Open set
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 w-7 rounded-full border-none bg-white/15 p-0 text-white hover:bg-white/25"
              onClick={() => onDownload(generation.url, generation.type, generation.type)}
              title="Download"
            >
              <DownloadSimple className="h-3.5 w-3.5" />
            </Button>
            <CardDropdownActions
              {...dropdownProps}
              className="h-7 w-7 rounded-full border-none bg-white/15 text-white hover:bg-white/25"
            />
          </div>
        </div>
      </div>

      <div className="absolute bottom-2 right-2 z-10 sm:hidden">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="size-8 rounded-full border-none bg-black/60 text-white backdrop-blur"
          onClick={() => onDelete(generation)}
          aria-label="Delete carousel set"
        >
          <Trash className="size-3.5" />
        </Button>
      </div>
    </article>
  )
}
