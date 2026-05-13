"use client"

import * as React from "react"
import { X } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import type { AttachedRef } from "@/lib/commands/types"
import { Image, Palette, VideoCamera, Waveform } from "@phosphor-icons/react"

function ChipIcon({ refItem }: { refItem: AttachedRef }) {
  if (refItem.category === "brand") {
    return <Palette className="size-3.5 shrink-0 text-foreground" weight="duotone" aria-hidden />
  }
  if (refItem.assetType === "video") {
    return <VideoCamera className="size-3.5 shrink-0 text-zinc-400" weight="duotone" aria-hidden />
  }
  if (refItem.assetType === "audio") {
    return <Waveform className="size-3.5 shrink-0 text-zinc-400" weight="duotone" aria-hidden />
  }
  return <Image className="size-3.5 shrink-0 text-zinc-400" weight="duotone" aria-hidden />
}

export interface ReferenceChipsProps {
  refs: AttachedRef[]
  onRemove: (chipId: string) => void
  className?: string
}

export function ReferenceChips({ refs, onRemove, className }: ReferenceChipsProps) {
  if (refs.length === 0) return null

  return (
    <div
      className={cn("flex flex-wrap gap-1.5 pt-1", className)}
      role="list"
      aria-label="Attached references"
    >
      {refs.map((r) => (
        <div
          key={r.chipId}
          role="listitem"
          className={cn(
            "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
            r.category === "brand"
              ? "border-violet-500/40 bg-violet-500/10 text-violet-200"
              : "border-border/80 bg-muted/50 text-foreground"
          )}
        >
          <ChipIcon refItem={r} />
          <span className="truncate font-medium">{r.label}</span>
          <button
            type="button"
            className="rounded-full p-0.5 text-muted-foreground hover:bg-background/80 hover:text-foreground"
            onClick={() => onRemove(r.chipId)}
            aria-label={`Remove ${r.label}`}
          >
            <X className="size-3" weight="bold" />
          </button>
        </div>
      ))}
    </div>
  )
}
