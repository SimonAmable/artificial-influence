"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  ChevronLeft,
  ChevronRight,
  Film,
  ImageIcon,
  Layers,
  Sparkles,
  X,
} from "lucide-react"

export type AutopostViewerMediaItem = {
  url: string
  kind: "image" | "video"
  label?: string
}

export type AutopostViewerAction = {
  id: string
  label: string
  icon?: React.ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive"
}

type AutopostPostMediaViewerProps = {
  accountLabel: string
  caption?: string | null
  createdAt: string
  lastError?: string | null
  mediaItems: AutopostViewerMediaItem[]
  mediaTypeIcon: "image" | "video" | "carousel" | "story"
  mediaTypeLabel: string
  onClose: () => void
  providerLabel: string
  providerPublishId?: string | null
  providerPublishIdLabel?: string
  publishedAt?: string | null
  scheduleNote?: string | null
  scheduledAt?: string | null
  statusClassName?: string
  statusLabel: string
  timestampsLabel: string
  title?: string
  updatedAt: string
  actions?: AutopostViewerAction[]
}

function formatViewerDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return date.toLocaleString()
}

function ViewerTypeIcon({ type }: { type: AutopostPostMediaViewerProps["mediaTypeIcon"] }) {
  if (type === "carousel") {
    return <Layers className="h-3.5 w-3.5" />
  }
  if (type === "video") {
    return <Film className="h-3.5 w-3.5" />
  }
  if (type === "story") {
    return <Sparkles className="h-3.5 w-3.5" />
  }
  return <ImageIcon className="h-3.5 w-3.5" />
}

export function AutopostPostMediaViewer({
  accountLabel,
  caption,
  createdAt,
  lastError,
  mediaItems,
  mediaTypeIcon,
  mediaTypeLabel,
  onClose,
  providerLabel,
  providerPublishId,
  providerPublishIdLabel,
  publishedAt,
  scheduleNote,
  scheduledAt,
  statusClassName,
  statusLabel,
  timestampsLabel,
  title,
  updatedAt,
  actions = [],
}: AutopostPostMediaViewerProps) {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const activeItem = mediaItems[activeIndex] ?? mediaItems[0]
  const canNavigate = mediaItems.length > 1

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
        return
      }
      if (!canNavigate) {
        return
      }
      if (event.key === "ArrowRight") {
        setActiveIndex((current) => (current + 1) % mediaItems.length)
      }
      if (event.key === "ArrowLeft") {
        setActiveIndex((current) => (current - 1 + mediaItems.length) % mediaItems.length)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [canNavigate, mediaItems.length, onClose])

  React.useEffect(() => {
    setActiveIndex((current) => (current < mediaItems.length ? current : 0))
  }, [mediaItems.length])

  if (!activeItem) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-60 overflow-y-auto overscroll-contain bg-black/90 backdrop-blur-sm lg:flex lg:items-center lg:justify-center lg:overflow-hidden"
      onClick={onClose}
    >
      <div
        className="relative flex min-h-full w-full flex-col lg:h-full lg:flex-row"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative flex min-h-[48vh] flex-1 items-center justify-center px-4 py-6 lg:min-h-0 lg:px-8 lg:py-8">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 z-20 h-9 w-9 rounded-full bg-black/45 text-white hover:bg-black/65 hover:text-white"
            onClick={onClose}
            aria-label="Close viewer"
          >
            <X className="h-4 w-4" />
          </Button>

          {canNavigate ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 z-20 h-10 w-10 -translate-y-1/2 rounded-full bg-black/45 text-white hover:bg-black/65 hover:text-white"
                onClick={() => setActiveIndex((current) => (current - 1 + mediaItems.length) % mediaItems.length)}
                aria-label="Previous media"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 z-20 h-10 w-10 -translate-y-1/2 rounded-full bg-black/45 text-white hover:bg-black/65 hover:text-white"
                onClick={() => setActiveIndex((current) => (current + 1) % mediaItems.length)}
                aria-label="Next media"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          ) : null}

          <div className="flex max-h-[82vh] max-w-full items-center justify-center">
            {activeItem.kind === "video" ? (
              <video
                src={activeItem.url}
                controls
                playsInline
                preload="metadata"
                className="max-h-[82vh] max-w-full rounded-2xl object-contain shadow-2xl lg:max-w-[70vw]"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeItem.url}
                alt={title || "Post media"}
                className="max-h-[82vh] max-w-full rounded-2xl object-contain shadow-2xl lg:max-w-[70vw]"
              />
            )}
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col border-t border-white/10 bg-background lg:h-full lg:w-[380px] lg:border-l lg:border-t-0">
          <div className="border-b border-border/70 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{providerLabel}</p>
                <h3 className="text-sm font-semibold text-foreground">{title || "Post media"}</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="max-w-full truncate">
                    {accountLabel}
                  </Badge>
                  <Badge variant="outline" className={cn("text-xs font-medium", statusClassName)}>
                    {statusLabel}
                  </Badge>
                </div>
              </div>
              {canNavigate ? (
                <div className="rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {activeIndex + 1}/{mediaItems.length}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Post</p>
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <ViewerTypeIcon type={mediaTypeIcon} />
                  <span>{mediaTypeLabel}</span>
                </div>
                <p className="text-xs text-muted-foreground">{timestampsLabel}</p>
                {scheduleNote ? <p className="text-xs text-muted-foreground">{scheduleNote}</p> : null}
              </div>

              {canNavigate ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Gallery</p>
                  <div className="grid grid-cols-4 gap-2">
                    {mediaItems.map((item, index) => (
                      <button
                        key={`${item.url}-${index}`}
                        type="button"
                        className={cn(
                          "relative aspect-square overflow-hidden rounded-xl border bg-muted/30 transition hover:border-primary/60",
                          activeIndex === index && "border-primary ring-2 ring-primary/20",
                        )}
                        onClick={() => setActiveIndex(index)}
                      >
                        {item.kind === "video" ? (
                          <video className="h-full w-full object-cover" src={item.url} muted playsInline preload="metadata" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="h-full w-full object-cover" src={item.url} alt="" />
                        )}
                        <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          {item.label ?? index + 1}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {caption ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Caption</p>
                  <div className="max-h-40 overflow-y-auto rounded-2xl border border-border/70 bg-muted/20 p-3 text-sm leading-relaxed text-foreground">
                    {caption}
                  </div>
                </div>
              ) : null}

              {providerPublishId ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {providerPublishIdLabel ?? "Publish ID"}
                  </p>
                  <p className="break-all rounded-2xl border border-border/70 bg-muted/20 p-3 font-mono text-xs text-foreground">
                    {providerPublishId}
                  </p>
                </div>
              ) : null}

              {lastError ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-destructive">Last error</p>
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {lastError}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Timeline</p>
                <dl className="space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-muted-foreground">Created</dt>
                    <dd className="text-right text-foreground">{formatViewerDate(createdAt) ?? "Unknown"}</dd>
                  </div>
                  {scheduledAt ? (
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-muted-foreground">Scheduled</dt>
                      <dd className="text-right text-foreground">{formatViewerDate(scheduledAt)}</dd>
                    </div>
                  ) : null}
                  {publishedAt ? (
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-muted-foreground">Published</dt>
                      <dd className="text-right text-foreground">{formatViewerDate(publishedAt)}</dd>
                    </div>
                  ) : null}
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-muted-foreground">Updated</dt>
                    <dd className="text-right text-foreground">{formatViewerDate(updatedAt) ?? "Unknown"}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          {actions.length > 0 ? (
            <div className="border-t border-border/70 px-4 py-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Actions</p>
              <div className="flex flex-col gap-2">
                {actions.map((action) => (
                  <Button
                    key={action.id}
                    type="button"
                    variant={action.variant ?? "outline"}
                    size="sm"
                    className="justify-start"
                    disabled={action.disabled}
                    onClick={action.onClick}
                  >
                    {action.icon}
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
