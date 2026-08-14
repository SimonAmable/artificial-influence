"use client"

import Image from "next/image"
import { Plus } from "@phosphor-icons/react"

import type { PhotodumpPack } from "@/lib/photodump/packs"
import { PHOTODUMP_CUSTOM_PRESET_ID } from "@/lib/photodump/constants"
import { cn } from "@/lib/utils"

type PhotodumpPresetCardProps = {
  pack: PhotodumpPack
  selected: boolean
  onSelect: () => void
  /** Custom preset only — preview URLs from this-run aesthetic uploads */
  customPreviewUrls?: string[]
}

function PresetCoverFallback({
  pack,
  customPreviewUrls,
}: {
  pack: PhotodumpPack
  customPreviewUrls?: string[]
}) {
  if (pack.id === PHOTODUMP_CUSTOM_PRESET_ID) {
    if (customPreviewUrls && customPreviewUrls.length > 0) {
      const left = customPreviewUrls[0]
      const right = customPreviewUrls[1] ?? customPreviewUrls[0]
      return (
        <div className="grid grid-cols-2 gap-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={left} alt="" className="aspect-[4/5] w-full object-cover" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={right} alt="" className="aspect-[4/5] w-full object-cover" />
        </div>
      )
    }

    return (
      <div className="flex aspect-[16/10] items-center justify-center bg-muted/30">
        <Plus className="size-8 text-muted-foreground" weight="bold" />
      </div>
    )
  }

  const covers = pack.coverUrls?.filter(Boolean) ?? []
  if (covers.length >= 2) {
    return (
      <div className="grid grid-cols-2 gap-0.5">
        <div className="relative aspect-[4/5] w-full overflow-hidden">
          <Image src={covers[0]!} alt="" fill className="object-cover" sizes="120px" />
        </div>
        <div className="relative aspect-[4/5] w-full overflow-hidden">
          <Image src={covers[1]!} alt="" fill className="object-cover" sizes="120px" />
        </div>
      </div>
    )
  }

  if (covers.length === 1) {
    return (
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        <Image src={covers[0]!} alt="" fill className="object-cover" sizes="240px" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "grid aspect-[16/10] grid-cols-2 gap-0.5 bg-gradient-to-br",
        pack.fallbackClassName,
      )}
    >
      <div className="bg-black/5" />
      <div className="bg-black/10" />
    </div>
  )
}

export function PhotodumpPresetCard({
  pack,
  selected,
  onSelect,
  customPreviewUrls,
}: PhotodumpPresetCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative w-full overflow-hidden rounded-xl border text-left transition-shadow",
        selected
          ? "border-primary ring-2 ring-primary shadow-md"
          : "border-border/60 hover:border-border hover:shadow-sm",
      )}
    >
      <PresetCoverFallback pack={pack} customPreviewUrls={customPreviewUrls} />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-3 pb-2.5 pt-8">
        <p className="text-sm font-bold text-white drop-shadow-sm">{pack.name}</p>
        {pack.id === PHOTODUMP_CUSTOM_PRESET_ID ? (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-white/80">{pack.description}</p>
        ) : null}
      </div>
    </button>
  )
}
