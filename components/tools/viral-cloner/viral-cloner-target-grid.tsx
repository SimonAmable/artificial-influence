"use client"

import * as React from "react"
import { CircleNotch, Check } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

export type ViralClonerTargetItem = {
  index: number
  kind: "image" | "video" | "animated"
  previewUrl: string | null
  remoteUrl: string
  durationSeconds: number | null
  selected: boolean
  jobStatus?: string | null
  outputUrl?: string | null
  errorMessage?: string | null
}

type ViralClonerTargetGridProps = {
  items: ViralClonerTargetItem[]
  characterFaceUrl: string | null
  onToggleSelect: (index: number) => void
  onRetry?: (index: number) => void
  className?: string
  emptyHint?: string
}

export function ViralClonerTargetGrid({
  items,
  characterFaceUrl,
  onToggleSelect,
  onRetry,
  className,
  emptyHint = "Paste a post URL below to load media you can clone.",
}: ViralClonerTargetGridProps) {
  const [columns, setColumns] = React.useState(2)

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 px-6 text-center",
          className,
        )}
      >
        <p className="max-w-md text-sm text-muted-foreground">{emptyHint}</p>
      </div>
    )
  }

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      <div className="flex items-center gap-3 px-1">
        <span className="text-xs text-muted-foreground shrink-0">Columns</span>
        <Slider
          value={[columns]}
          min={1}
          max={4}
          step={1}
          onValueChange={(value) => setColumns(value[0] ?? 2)}
          className="max-w-[140px]"
        />
        <span className="text-xs tabular-nums text-muted-foreground">{columns}</span>
      </div>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const preview = item.outputUrl ?? item.previewUrl ?? item.remoteUrl
          const isGenerating =
            item.jobStatus === "pending" ||
            item.jobStatus === "importing" ||
            item.jobStatus === "queued" ||
            item.jobStatus === "generating"
          const isFailed = item.jobStatus === "failed"
          const isDone = item.jobStatus === "completed" && Boolean(item.outputUrl)

          return (
            <button
              key={item.index}
              type="button"
              onClick={() => onToggleSelect(item.index)}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-colors",
                item.selected ? "border-primary ring-2 ring-primary/30" : "border-border/60 hover:border-border",
              )}
            >
              <div className="relative flex max-h-[min(52vh,520px)] min-h-[120px] w-full items-center justify-center bg-muted/30 p-2">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                    draggable={false}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">No preview</span>
                )}

                {characterFaceUrl && item.selected ? (
                  <span className="pointer-events-none absolute bottom-2 left-2 overflow-hidden rounded-md border-2 border-background shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={characterFaceUrl} alt="" className="size-10 object-cover" />
                  </span>
                ) : null}

                {isGenerating ? (
                  <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <CircleNotch className="size-3 animate-spin" />
                    {item.jobStatus ?? "working"}
                  </span>
                ) : null}

                {isDone ? (
                  <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                    Done
                  </span>
                ) : null}

                <span
                  className={cn(
                    "absolute left-2 top-2 flex size-6 items-center justify-center rounded-full border bg-background/90",
                    item.selected ? "border-primary text-primary" : "border-border text-transparent",
                  )}
                >
                  <Check className="size-3.5" weight="bold" />
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-border/50 px-2 py-1.5 text-[11px] text-muted-foreground">
                <span className="truncate">
                  #{item.index + 1} · {item.kind}
                  {item.durationSeconds != null ? ` · ${item.durationSeconds}s` : ""}
                </span>
                {isFailed && onRetry ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={(event) => {
                      event.stopPropagation()
                      onRetry(item.index)
                    }}
                  >
                    Retry
                  </Button>
                ) : null}
              </div>

              {isFailed && item.errorMessage ? (
                <p className="border-t border-border/50 px-2 py-1 text-[10px] text-destructive line-clamp-2">
                  {item.errorMessage}
                </p>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}