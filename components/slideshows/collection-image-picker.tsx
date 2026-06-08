"use client"

import * as React from "react"
import type { SlideshowCollection } from "@/lib/slideshow/types"
import { cn } from "@/lib/utils"

export function CollectionImagePicker({
  collection,
  selectedImageId,
  onSelect,
  className,
}: {
  collection: SlideshowCollection | null
  selectedImageId: string | null
  onSelect: (item: SlideshowCollection["items"][number]) => void
  className?: string
}) {
  if (!collection) {
    return (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Choose an image pack to browse its images.
      </p>
    )
  }

  if (collection.items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        This pack is empty. Add images in Collections first.
      </p>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs text-muted-foreground">
        {collection.name} · {collection.items.length} images
      </p>
      <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto rounded-xl border p-2 sm:grid-cols-4">
        {collection.items.map((item) => {
          const selected = selectedImageId === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className={cn(
                "aspect-[9/16] overflow-hidden rounded-lg border-2 transition-colors",
                selected ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-muted-foreground/30",
              )}
              title={item.title}
            >
              <img
                src={item.thumbnailUrl || item.url}
                alt={item.title}
                className="h-full w-full object-cover"
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
