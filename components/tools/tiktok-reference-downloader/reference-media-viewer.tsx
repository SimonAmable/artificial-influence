"use client"

import * as React from "react"
import Link from "next/link"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Film,
  Heart,
  ImageIcon,
  Layers,
  Loader2,
  MessageCircle,
  Repeat2,
  Bookmark,
  Eye,
  X,
} from "lucide-react"
import { toast } from "sonner"

import type { NormalizedInstagramPost } from "@/lib/server/apify/instagram-scraper-types"
import type { NormalizedTikTokVideoCard } from "@/lib/server/apify/tiktok-scraper-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  downloadReferenceImageSlides,
  REFERENCE_SLIDES_ZIP_THRESHOLD,
} from "@/lib/client/download-reference-slides"
import { toTikTokPlaybackUrl } from "@/lib/tiktok/playback-url"
import { cn } from "@/lib/utils"

export type ReferenceSourcePlatform = "tiktok" | "instagram"

export type ReferenceMediaViewerMediaKind = "video" | "slideshow"

export type ReferenceMediaViewerMediaItem = {
  url: string
  kind: "image" | "video"
  label?: string
}

export type ReferenceMediaViewerAction = {
  id: string
  label: string
  icon?: React.ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive"
}

export type ReferenceMediaViewerPayload = {
  jobId: string
  platform: ReferenceSourcePlatform
  sourcePostUrl: string | null
  mediaKind: ReferenceMediaViewerMediaKind
  mediaItems: ReferenceMediaViewerMediaItem[]
  posterUrl?: string | null
  snapshot: NormalizedTikTokVideoCard | NormalizedInstagramPost | null
  normalizationProfile: string | null
  createdAt: string | null
  completedAt: string | null
  motionControlHref?: string | null
  /** e.g. "Saved reference" (default) or "Trend result". */
  sourceLabel?: string | null
}

type ReferenceMediaViewerProps = {
  payload: ReferenceMediaViewerPayload
  onClose: () => void
  extraActions?: ReferenceMediaViewerAction[]
}

function formatViewerDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return date.toLocaleString()
}

function formatCount(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—"
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }
  return `${Math.round(value)}`
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

function defaultDownloadName(item: ReferenceMediaViewerMediaItem, fallbackIndex: number): string {
  const fromUrl = parseFilenameFromUrl(item.url)
  if (fromUrl) {
    return fromUrl
  }
  const suffix = item.kind === "video" ? "mp4" : "jpg"
  const labelNum = fallbackIndex.toString().padStart(2, "0")
  return `reference-${labelNum}.${suffix}`
}

function inferExtensionFromUrl(url: string, fallback: "mp4" | "jpg") {
  const lower = url.toLowerCase()
  if (lower.includes(".png")) return "png"
  if (lower.includes(".webp")) return "webp"
  if (lower.includes(".jpeg") || lower.includes(".jpg")) return "jpg"
  if (lower.includes(".mp4")) return "mp4"
  return fallback
}

async function downloadMediaBlob(url: string, filename: string): Promise<boolean> {
  try {
    const response = await fetch(url, { mode: "cors", cache: "no-store" })
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

function isTikTokSnapshot(
  snapshot: NormalizedTikTokVideoCard | NormalizedInstagramPost | null,
): snapshot is NormalizedTikTokVideoCard {
  return Boolean(snapshot && typeof snapshot === "object" && "stats" in snapshot)
}

function isInstagramSnapshot(
  snapshot: NormalizedTikTokVideoCard | NormalizedInstagramPost | null,
): snapshot is NormalizedInstagramPost {
  return Boolean(snapshot && typeof snapshot === "object" && "shortCode" in snapshot)
}

export function ReferenceMediaViewer({ payload, onClose, extraActions = [] }: ReferenceMediaViewerProps) {
  const {
    jobId,
    platform,
    sourcePostUrl,
    mediaKind,
    mediaItems,
    posterUrl,
    snapshot,
    normalizationProfile,
    createdAt,
    completedAt,
    motionControlHref,
    sourceLabel = "Saved reference",
  } = payload

  const [activeIndex, setActiveIndex] = React.useState(0)
  const [downloadingAll, setDownloadingAll] = React.useState(false)
  const [downloadingIndex, setDownloadingIndex] = React.useState<number | null>(null)
  const [copiedSource, setCopiedSource] = React.useState(false)

  const activeItem = mediaItems[activeIndex] ?? mediaItems[0]
  const canNavigate = mediaItems.length > 1
  const footerBusy = downloadingAll || downloadingIndex !== null

  const providerLabel = platform === "instagram" ? "Instagram" : "TikTok"
  const titleFromSnapshot = isTikTokSnapshot(snapshot)
    ? snapshot.authorUsername
      ? `@${snapshot.authorUsername}`
      : "TikTok reference"
    : isInstagramSnapshot(snapshot)
      ? snapshot.ownerUsername
        ? `@${snapshot.ownerUsername}`
        : "Instagram reference"
      : `${providerLabel} reference`

  const caption =
    isTikTokSnapshot(snapshot) && snapshot.caption
      ? snapshot.caption
      : isInstagramSnapshot(snapshot) && snapshot.caption
        ? snapshot.caption
        : null

  const handleDownloadMediaAtIndex = React.useCallback(
    async (index: number, event?: React.SyntheticEvent) => {
      event?.preventDefault()
      event?.stopPropagation()
      const item = mediaItems[index]
      if (!item) return
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
    if (mediaItems.length === 0) return
    setDownloadingAll(true)
    try {
      const allImages = mediaItems.every((item) => item.kind === "image")
      if (allImages) {
        await downloadReferenceImageSlides(
          mediaItems.map((item) => item.url),
          `social-reference-${jobId}`,
        )
        const n = mediaItems.length
        if (n > REFERENCE_SLIDES_ZIP_THRESHOLD) {
          toast.success("ZIP download started.")
        } else if (n === 1) {
          toast.success("Download started.")
        } else {
          toast.success(`${n} downloads started.`)
        }
        return
      }

      let started = 0
      for (let i = 0; i < mediaItems.length; i += 1) {
        const item = mediaItems[i]
        const ext = inferExtensionFromUrl(item.url, item.kind === "video" ? "mp4" : "jpg")
        const ok = await downloadMediaBlob(item.url, `social-reference-${jobId}-${i + 1}.${ext}`)
        if (ok) started += 1
        if (i < mediaItems.length - 1) {
          await new Promise((resolve) => {
            window.setTimeout(resolve, 280)
          })
        }
      }
      if (started === 0 && mediaItems.length > 0) {
        toast.message("Check new tabs", {
          description: "Files opened in-browser when download is blocked.",
        })
      } else {
        toast.success(started === 1 ? "Download started." : `${started} downloads started.`)
      }
    } catch {
      toast.error("Downloads did not finish.")
    } finally {
      setDownloadingAll(false)
    }
  }, [jobId, mediaItems])

  const handleCopySource = React.useCallback(async () => {
    if (!sourcePostUrl) {
      toast.error("No post URL to copy.")
      return
    }
    try {
      await navigator.clipboard.writeText(sourcePostUrl)
      setCopiedSource(true)
      toast.success("Post URL copied")
      window.setTimeout(() => setCopiedSource(false), 2000)
    } catch {
      toast.error("Could not copy URL")
    }
  }, [sourcePostUrl])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
        return
      }
      if (!canNavigate) return
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

  React.useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  if (!activeItem) {
    return null
  }

  const mediaTypeIcon: "image" | "video" | "carousel" =
    mediaKind === "video" ? "video" : mediaItems.length > 1 ? "carousel" : "image"
  const mediaTypeLabel =
    mediaKind === "video" ? "Video" : mediaItems.length > 1 ? `Slideshow · ${mediaItems.length}` : "Image"

  return (
    <div
      className="fixed inset-0 z-60 overflow-y-auto overscroll-contain bg-black/90 backdrop-blur-sm lg:flex lg:items-center lg:justify-center lg:overflow-hidden"
      onClick={onClose}
    >
      <div className="relative flex min-h-full w-full flex-col lg:h-full lg:flex-row">
        <div
          className="relative flex min-h-[48vh] flex-1 flex-col lg:min-h-0 lg:h-full"
          onClick={(event) => {
            event.stopPropagation()
            onClose()
          }}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 z-30 h-9 w-9 rounded-full bg-black/45 text-white hover:bg-black/65 hover:text-white"
            onClick={(event) => {
              event.stopPropagation()
              onClose()
            }}
            aria-label="Close viewer"
          >
            <X className="h-4 w-4" />
          </Button>

          {canNavigate ? (
            <>
              <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex w-16 items-center justify-center pl-1 sm:w-20 sm:pl-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="pointer-events-auto h-10 w-10 shrink-0 rounded-full bg-black/45 text-white hover:bg-black/65 hover:text-white"
                  onClick={(event) => {
                    event.stopPropagation()
                    setActiveIndex((current) => (current - 1 + mediaItems.length) % mediaItems.length)
                  }}
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              </div>
              <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex w-16 items-center justify-center pr-1 sm:w-20 sm:pr-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="pointer-events-auto h-10 w-10 shrink-0 rounded-full bg-black/45 text-white hover:bg-black/65 hover:text-white"
                  onClick={(event) => {
                    event.stopPropagation()
                    setActiveIndex((current) => (current + 1) % mediaItems.length)
                  }}
                  aria-label="Next slide"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </>
          ) : null}

          <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6 lg:px-8 lg:py-8">
            <div
              className="relative z-10 flex max-h-[82vh] max-w-full items-center justify-center"
              onClick={(event) => event.stopPropagation()}
            >
              {activeItem.kind === "video" ? (
                <video
                  src={activeItem.url}
                  controls
                  playsInline
                  preload="metadata"
                  poster={posterUrl || undefined}
                  className="max-h-[82vh] max-w-full rounded-2xl object-contain shadow-2xl lg:max-w-[70vw]"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeItem.url}
                  alt={activeItem.label ?? `Slide ${activeIndex + 1}`}
                  className="max-h-[82vh] max-w-full rounded-2xl object-contain shadow-2xl lg:max-w-[70vw]"
                />
              )}
            </div>
          </div>
        </div>

        <div
          className="flex w-full shrink-0 flex-col border-t border-white/10 bg-background lg:h-full lg:w-[380px] lg:border-l lg:border-t-0"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-border/70 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {providerLabel} · {sourceLabel ?? "Saved reference"}
                </p>
                <h3 className="text-sm font-semibold text-foreground">{titleFromSnapshot}</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{providerLabel}</Badge>
                  <Badge variant="secondary" className="gap-1">
                    {mediaTypeIcon === "video" ? (
                      <Film className="h-3 w-3" />
                    ) : mediaTypeIcon === "carousel" ? (
                      <Layers className="h-3 w-3" />
                    ) : (
                      <ImageIcon className="h-3 w-3" />
                    )}
                    {mediaTypeLabel}
                  </Badge>
                </div>
              </div>
              {canNavigate ? (
                <div className="rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-muted-foreground tabular-nums">
                  {activeIndex + 1}/{mediaItems.length}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-4">
              {isTikTokSnapshot(snapshot) ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Stats</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-foreground">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Eye className="h-3.5 w-3.5 shrink-0" />
                      {formatCount(snapshot.stats.views)} views
                    </span>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Heart className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                      {formatCount(snapshot.stats.likes)} likes
                    </span>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                      {formatCount(snapshot.stats.comments)}
                    </span>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Repeat2 className="h-3.5 w-3.5 shrink-0" />
                      {formatCount(snapshot.stats.shares)}
                    </span>
                    <span className="flex col-span-2 items-center gap-1.5 text-muted-foreground">
                      <Bookmark className="h-3.5 w-3.5 shrink-0" />
                      {formatCount(snapshot.stats.saves)} saves
                    </span>
                  </div>
                </div>
              ) : isInstagramSnapshot(snapshot) ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Post</p>
                  <p className="text-sm text-foreground">
                    {snapshot.type ? String(snapshot.type) : "Post"}{" "}
                    {snapshot.likesCount != null ? (
                      <span className="text-muted-foreground">· {formatCount(snapshot.likesCount)} likes</span>
                    ) : null}
                  </p>
                </div>
              ) : null}

              {canNavigate ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Gallery</p>
                  <div className="grid grid-cols-4 gap-2">
                    {mediaItems.map((item, index) => (
                      <div
                        key={`${item.kind}-${item.url}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`Show slide ${index + 1}`}
                        className={cn(
                          "relative aspect-square cursor-pointer overflow-hidden rounded-xl border bg-muted/30 outline-none transition hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring",
                          activeIndex === index && "border-primary ring-2 ring-primary/20",
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
                      >
                        {item.kind === "video" ? (
                          <video
                            className="h-full w-full object-cover"
                            src={item.url}
                            muted
                            playsInline
                            preload="metadata"
                            poster={posterUrl || undefined}
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="h-full w-full object-cover" src={item.url} alt="" />
                        )}
                        <span className="pointer-events-none absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          {index + 1}
                        </span>
                        <div className="absolute right-0 top-0 z-10 p-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full bg-black/55 text-white hover:bg-black/75 hover:text-white"
                            aria-label={`Download slide ${index + 1}`}
                            disabled={downloadingIndex === index || downloadingAll}
                            onClick={(event) => void handleDownloadMediaAtIndex(index, event)}
                          >
                            {downloadingIndex === index ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {caption ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Caption</p>
                  <div className="max-h-48 overflow-y-auto rounded-2xl border border-border/70 bg-muted/20 p-3 text-sm leading-relaxed text-foreground">
                    {caption}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Job</p>
                <p className="break-all rounded-2xl border border-border/70 bg-muted/20 p-3 font-mono text-xs text-foreground">
                  {jobId}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Timeline</p>
                <dl className="space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-muted-foreground">Created</dt>
                    <dd className="text-right text-foreground">{formatViewerDate(createdAt) ?? "—"}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-muted-foreground">Completed</dt>
                    <dd className="text-right text-foreground">{formatViewerDate(completedAt) ?? "—"}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <div className="border-t border-border/70 px-4 py-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Actions</p>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="justify-start gap-2"
                disabled={footerBusy}
                onClick={() => void handleDownloadAllMedia()}
              >
                <span className="shrink-0">
                  {downloadingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                </span>
                {mediaItems.length === 1
                  ? "Download media"
                  : mediaItems.every((item) => item.kind === "image") &&
                      mediaItems.length > REFERENCE_SLIDES_ZIP_THRESHOLD
                    ? "Download ZIP"
                    : "Download all media"}
              </Button>

              {sourcePostUrl ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="justify-start gap-2"
                    disabled={footerBusy}
                    onClick={() => void handleCopySource()}
                  >
                    <span className="shrink-0">
                      {copiedSource ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </span>
                    {copiedSource ? "Copied post URL" : "Copy post URL"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="justify-start gap-2" asChild>
                    <a href={sourcePostUrl} target="_blank" rel="noreferrer">
                      <span className="shrink-0">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </span>
                      Open on {platform === "instagram" ? "Instagram" : "TikTok"}
                    </a>
                  </Button>
                </>
              ) : null}

              {motionControlHref && mediaKind === "video" ? (
                <Button type="button" variant="default" size="sm" className="justify-start gap-2" asChild>
                  <Link href={motionControlHref} prefetch={false}>
                    <span className="shrink-0">
                      <Film className="h-3.5 w-3.5" />
                    </span>
                    Use in Motion Control
                  </Link>
                </Button>
              ) : null}

              {extraActions.map((action) => (
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
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function buildReferenceMediaItems(
  mediaKind: ReferenceMediaViewerMediaKind,
  urls: string[],
  fallbackVideoUrl: string | null,
): ReferenceMediaViewerMediaItem[] {
  if (mediaKind === "video") {
    const url = urls[0] ?? fallbackVideoUrl ?? ""
    if (!url) return []
    const playbackUrl = toTikTokPlaybackUrl(url) ?? url
    return [{ url: playbackUrl, kind: "video" }]
  }
  return urls.map((url, index) => ({
    url,
    kind: "image" as const,
    label: String(index + 1),
  }))
}

const MOTION_CONTROL_MODEL = "kwaivgi/kling-v3-motion-control" as const

function isHttpUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith("http")
}

export function resolveTikTokCardMediaKind(
  video: NormalizedTikTokVideoCard,
): ReferenceMediaViewerMediaKind {
  const slides = (video.slideshowImageUrls ?? []).filter(isHttpUrl)
  const hasVideo = isHttpUrl(video.playableVideoUrl)

  if (slides.length > 0 && !hasVideo) {
    return "slideshow"
  }
  if (slides.length > 1) {
    return "slideshow"
  }
  return "video"
}

export function buildReferenceViewerPayloadFromTikTokCard(
  video: NormalizedTikTokVideoCard,
  options?: { sourceLabel?: string },
): ReferenceMediaViewerPayload | null {
  const mediaKind = resolveTikTokCardMediaKind(video)
  const slides = (video.slideshowImageUrls ?? []).filter(isHttpUrl)
  const urls =
    mediaKind === "slideshow"
      ? slides
      : isHttpUrl(video.playableVideoUrl)
        ? [video.playableVideoUrl]
        : slides.length === 1
          ? slides
          : isHttpUrl(video.coverUrl)
            ? [video.coverUrl]
            : []

  const items = buildReferenceMediaItems(mediaKind, urls, video.playableVideoUrl)
  if (items.length === 0) {
    return null
  }

  const primaryUrl = urls[0] ?? video.playableVideoUrl ?? null
  const motionControlHref =
    mediaKind === "video" && isHttpUrl(primaryUrl)
      ? `/video?${new URLSearchParams({
          model: MOTION_CONTROL_MODEL,
          referenceVideoUrl: primaryUrl,
        }).toString()}`
      : null

  const jobId = video.id ?? video.webVideoUrl ?? `tiktok-trend-${primaryUrl ?? "unknown"}`

  return {
    jobId,
    platform: "tiktok",
    sourcePostUrl: video.webVideoUrl,
    mediaKind,
    mediaItems: items,
    posterUrl: video.coverUrl,
    snapshot: video,
    normalizationProfile: "tiktok-trend-search",
    createdAt: video.createTimeISO,
    completedAt: null,
    motionControlHref,
    sourceLabel: options?.sourceLabel ?? "Trend result",
  }
}
