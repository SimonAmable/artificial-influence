"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  GripVertical,
  Film,
  ImageIcon,
  Layers,
  Loader2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"

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
  onDeletePost?: () => void
  deletePostDisabled?: boolean
  deletePostBusy?: boolean
  onRemoveGalleryItem?: (index: number) => Promise<void>
  /** When set, spinner on matching gallery tile plus disables other controls while removal runs */
  removingGalleryIndex?: number | null
  showGalleryRemoveButtons?: boolean
  /** Draft / queued carousel / TikTok photo (2+ slides): reorder via drag handle */
  galleryReorderable?: boolean
  onReorderGallery?: (fromIndex: number, toIndex: number) => Promise<void>
  reorderingGallery?: boolean
  /** Draft / scheduled / failed: show caption editor + Save */
  captionEditable?: boolean
  onCaptionCommit?: (nextCaption: string) => Promise<void>
  captionCommitBusy?: boolean
}

function formatViewerDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return date.toLocaleString()
}

function parseFilenameFromUrl(url: string): string | null {
  try {
    const pathname = decodeURIComponent(new URL(url).pathname.split("?")[0] ?? "")
    const safe = pathname.split("/").filter(Boolean).pop()
    return safe?.includes(".") ? safe.slice(-200) : null
  } catch {
    return null
  }
}

function defaultDownloadName(item: AutopostViewerMediaItem, fallbackIndex: number): string {
  const fromUrl = parseFilenameFromUrl(item.url)
  if (fromUrl) {
    return fromUrl
  }
  const suffix = item.kind === "video" ? "mp4" : "jpg"
  const labelNum = fallbackIndex.toString().padStart(2, "0")
  return `media-${labelNum}.${suffix}`
}

function mapGalleryActiveAfterReorder(active: number, fromIndex: number, toIndex: number): number {
  if (active === fromIndex) {
    return toIndex
  }
  if (fromIndex < toIndex) {
    if (active > fromIndex && active <= toIndex) {
      return active - 1
    }
    return active
  }
  if (fromIndex > toIndex) {
    if (active >= toIndex && active < fromIndex) {
      return active + 1
    }
    return active
  }
  return active
}

async function downloadMediaBlob(url: string, filename: string): Promise<boolean> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    try {
      const anchor = document.createElement("a")
      anchor.href = blobUrl
      anchor.download = filename
      anchor.rel = "noopener"
      anchor.style.display = "none"
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
    } finally {
      URL.revokeObjectURL(blobUrl)
    }
    return true
  } catch {
    window.open(url, "_blank", "noopener,noreferrer")
    toast.message("Opened media in a new tab", {
      description: "If the download did not start, save the file from the new tab.",
    })
    return false
  }
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
  onDeletePost,
  deletePostDisabled,
  deletePostBusy,
  onRemoveGalleryItem,
  removingGalleryIndex = null,
  showGalleryRemoveButtons = false,
  galleryReorderable = false,
  onReorderGallery,
  reorderingGallery = false,
  captionEditable = false,
  onCaptionCommit,
  captionCommitBusy = false,
}: AutopostPostMediaViewerProps) {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [downloadingAll, setDownloadingAll] = React.useState(false)
  const [downloadingIndex, setDownloadingIndex] = React.useState<number | null>(null)
  const activeItem = mediaItems[activeIndex] ?? mediaItems[0]
  const canNavigate = mediaItems.length > 1

  const handleDownloadMediaAtIndex = React.useCallback(
    async (index: number, event?: React.SyntheticEvent) => {
      event?.preventDefault()
      event?.stopPropagation()
      const item = mediaItems[index]
      if (!item) {
        return
      }
      setDownloadingIndex(index)
      try {
        const ok = await downloadMediaBlob(item.url, defaultDownloadName(item, index + 1))
        if (ok) {
          toast.success("Download started.")
        }
      } catch {
        toast.error("Could not download this file.")
      } finally {
        setDownloadingIndex(null)
      }
    },
    [mediaItems],
  )

  const handleDownloadAllMedia = React.useCallback(async () => {
    if (mediaItems.length === 0) {
      return
    }
    setDownloadingAll(true)
    try {
      let started = 0
      for (let i = 0; i < mediaItems.length; i += 1) {
        const item = mediaItems[i]
        const ok = await downloadMediaBlob(item.url, defaultDownloadName(item, i + 1))
        if (ok) {
          started += 1
        }
        if (i < mediaItems.length - 1) {
          await new Promise((resolve) => {
            window.setTimeout(resolve, 280)
          })
        }
      }
      if (started === 0 && mediaItems.length > 0) {
        toast.message("Check new tabs", { description: "Files opened in-browser when download is blocked." })
      } else {
        toast.success(started === 1 ? "Download started." : `${started} downloads started.`)
      }
    } catch {
      toast.error("Downloads did not finish.")
    } finally {
      setDownloadingAll(false)
    }
  }, [mediaItems])

  const showActionsFooter = actions.length > 0 || mediaItems.length > 0 || Boolean(onDeletePost)

  const removingSlideBusy = removingGalleryIndex !== null

  const [galleryDropHoverIndex, setGalleryDropHoverIndex] = React.useState<number | null>(null)

  const committedCaption = caption ?? ""
  const [captionDraft, setCaptionDraft] = React.useState(committedCaption)

  React.useEffect(() => {
    setCaptionDraft(committedCaption)
  }, [committedCaption])

  const captionDirty = captionDraft !== committedCaption

  const captionControlsLocked =
    captionCommitBusy || removingSlideBusy || reorderingGallery
  const footerBusy =
    captionCommitBusy || removingSlideBusy || reorderingGallery

  const handleCaptionSave = React.useCallback(async () => {
    if (!onCaptionCommit || captionCommitBusy || !captionDirty) {
      return
    }
    try {
      await onCaptionCommit(captionDraft.trim())
      toast.success("Caption saved.")
    } catch {
      toast.error("Could not save caption.")
    }
  }, [onCaptionCommit, captionCommitBusy, captionDirty, captionDraft])

  const handleRemoveGalleryItemClick = React.useCallback(
    async (index: number, event?: React.MouseEvent) => {
      event?.preventDefault()
      event?.stopPropagation()
      if (!onRemoveGalleryItem) {
        return
      }
      const beforeLen = mediaItems.length
      try {
        await onRemoveGalleryItem(index)
        setActiveIndex((prev) => {
          const nextLen = beforeLen - 1
          if (nextLen <= 0) {
            return 0
          }
          if (index < prev) {
            return prev - 1
          }
          return Math.min(prev, nextLen - 1)
        })
      } catch {
        // Parent surfaces errors via toast.
      }
    },
    [onRemoveGalleryItem, mediaItems.length],
  )

  const handleGalleryReorderDrop = React.useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (!onReorderGallery || fromIndex === toIndex) {
        return
      }
      try {
        await onReorderGallery(fromIndex, toIndex)
        setActiveIndex((prev) => mapGalleryActiveAfterReorder(prev, fromIndex, toIndex))
      } catch {
        // Parent surfaces errors via toast.
      }
    },
    [onReorderGallery],
  )

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
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Gallery
                    </p>
                    {galleryReorderable && onReorderGallery && !footerBusy ? (
                      <span className="text-[10px] font-medium normal-case tracking-normal text-muted-foreground">
                        Drag the grip (lower-left) to reorder
                      </span>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {mediaItems.map((item, index) => (
                      <div
                        key={`${item.kind}-${item.url}`}
                        role="button"
                        tabIndex={reorderingGallery ? -1 : 0}
                        aria-label={`Show media ${item.label ?? index + 1}`}
                        className={cn(
                          "relative aspect-square cursor-pointer overflow-hidden rounded-xl border bg-muted/30 outline-none transition hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring",
                          activeIndex === index && "border-primary ring-2 ring-primary/20",
                          galleryDropHoverIndex === index &&
                            galleryReorderable &&
                            onReorderGallery &&
                            "ring-2 ring-primary/40",
                        )}
                        onClick={() => {
                          if (footerBusy) return
                          setActiveIndex(index)
                        }}
                        onKeyDown={(event) => {
                          if (footerBusy) return
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            setActiveIndex(index)
                          }
                        }}
                        onDragOver={(event) => {
                          if (!galleryReorderable || footerBusy || !onReorderGallery) return
                          event.preventDefault()
                          event.dataTransfer.dropEffect = "move"
                          setGalleryDropHoverIndex(index)
                        }}
                        onDragLeave={(event) => {
                          const next = event.relatedTarget as Node | null
                          if (next && event.currentTarget.contains(next)) return
                          setGalleryDropHoverIndex((current) =>
                            current === index ? null : current,
                          )
                        }}
                        onDrop={(event) => {
                          event.preventDefault()
                          setGalleryDropHoverIndex(null)
                          if (!galleryReorderable || footerBusy || !onReorderGallery) return
                          const raw = event.dataTransfer.getData("text/plain").trim()
                          const from = Number.parseInt(raw, 10)
                          if (!Number.isInteger(from) || from < 0) return
                          void handleGalleryReorderDrop(from, index)
                        }}
                      >
                        {item.kind === "video" ? (
                          <video className="h-full w-full object-cover" src={item.url} muted playsInline preload="metadata" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="h-full w-full object-cover" src={item.url} alt="" />
                        )}
                        <span className="pointer-events-none absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          {item.label ?? index + 1}
                        </span>
                        {galleryReorderable && onReorderGallery ? (
                          <div
                            role="presentation"
                            draggable={!footerBusy}
                            aria-label={`Drag to reorder slide ${index + 1}`}
                            title="Drag to reorder slides"
                            onDragStart={(event) => {
                              if (footerBusy) {
                                event.preventDefault()
                                return
                              }
                              event.dataTransfer.effectAllowed = "move"
                              event.dataTransfer.setData("text/plain", String(index))
                              event.stopPropagation()
                            }}
                            onDragEnd={() => setGalleryDropHoverIndex(null)}
                            onClick={(event) => event.stopPropagation()}
                            className={cn(
                              "absolute bottom-1 left-1 z-10 cursor-grab touch-none rounded-md bg-black/55 p-0.5 active:cursor-grabbing",
                              footerBusy && "pointer-events-none opacity-40",
                            )}
                          >
                            <GripVertical className="h-3.5 w-3.5 text-white" aria-hidden />
                          </div>
                        ) : null}
                        <div className="absolute right-0 top-0 z-10 flex flex-col gap-0.5 p-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full bg-black/55 text-white hover:bg-black/75 hover:text-white"
                            aria-label={`Download media ${item.label ?? index + 1}`}
                            disabled={downloadingIndex === index || downloadingAll || footerBusy}
                            onClick={(event) => void handleDownloadMediaAtIndex(index, event)}
                          >
                            {downloadingIndex === index ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          {showGalleryRemoveButtons && onRemoveGalleryItem ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full bg-black/55 text-white hover:bg-destructive hover:text-destructive-foreground"
                              aria-label={`Remove slide ${item.label ?? index + 1}`}
                              disabled={footerBusy}
                              onClick={(event) => void handleRemoveGalleryItemClick(index, event)}
                            >
                              {removingGalleryIndex === index ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {captionEditable || caption ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Caption</p>
                  {mediaTypeIcon === "story" && captionEditable ? (
                    <p className="text-xs text-muted-foreground">
                      Story posts may ignore caption text when publishing via Instagram&apos;s API.
                    </p>
                  ) : null}
                  {captionEditable && onCaptionCommit ? (
                    <div className="space-y-2">
                      <Textarea
                        value={captionDraft}
                        onChange={(event) => setCaptionDraft(event.target.value)}
                        disabled={captionControlsLocked}
                        maxLength={4096}
                        rows={6}
                        placeholder={
                          providerLabel === "TikTok"
                            ? "Title and description sent with this TikTok post…"
                            : "Write your caption…"
                        }
                        className="min-h-[100px] resize-y rounded-2xl border-border/70 bg-muted/15 text-sm"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={!captionDirty || captionCommitBusy || captionControlsLocked}
                          onClick={() => void handleCaptionSave()}
                        >
                          {captionCommitBusy ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          Save caption
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={!captionDirty || captionCommitBusy || captionControlsLocked}
                          onClick={() => setCaptionDraft(committedCaption)}
                        >
                          Reset
                        </Button>
                        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                          {captionDraft.length}/4096
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="max-h-40 overflow-y-auto rounded-2xl border border-border/70 bg-muted/20 p-3 text-sm leading-relaxed text-foreground">
                      {caption ? caption : (
                        <span className="text-muted-foreground">No caption</span>
                      )}
                    </div>
                  )}
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

          {showActionsFooter ? (
            <div className="border-t border-border/70 px-4 py-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Actions</p>
              <div className="flex flex-col gap-2">
                {mediaItems.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2"
                    disabled={downloadingAll || downloadingIndex !== null || footerBusy}
                    onClick={() => void handleDownloadAllMedia()}
                  >
                    <span className="shrink-0">
                      {downloadingAll ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                    </span>
                    {mediaItems.length === 1 ? "Download media" : "Download all media"}
                  </Button>
                ) : null}
                {actions.map((action) => (
                  <Button
                    key={action.id}
                    type="button"
                    variant={action.variant ?? "outline"}
                    size="sm"
                    className="justify-start gap-2"
                    disabled={action.disabled || footerBusy}
                    onClick={action.onClick}
                  >
                    {action.icon ? <span className="shrink-0">{action.icon}</span> : null}
                    {action.label}
                  </Button>
                ))}
                {Boolean(onDeletePost) ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="justify-start gap-2"
                    disabled={
                      Boolean(deletePostDisabled) ||
                      downloadingAll ||
                      downloadingIndex !== null ||
                      footerBusy
                    }
                    onClick={onDeletePost}
                  >
                    <span className="shrink-0">
                      {deletePostBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </span>
                    Delete post
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
