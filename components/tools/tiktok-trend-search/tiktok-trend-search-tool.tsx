"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowsDownUp,
  ArrowsOut,
  BookmarkSimple,
  CalendarBlank,
  ChatCircleDots,
  CircleNotch,
  ClockCounterClockwise,
  Copy,
  FilmStrip,
  Fire,
  Heart,
  Images,
  MagnifyingGlass,
  ShareFat,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import type { NormalizedTikTokVideoCard } from "@/lib/server/apify/tiktok-scraper-types"
import type { TikTokVideoSearchDateFilter } from "@/lib/server/apify/tiktok-scraper-types"
import type { TikTokVideoSearchSorting } from "@/lib/server/apify/tiktok-scraper-types"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  buildReferenceViewerPayloadFromTikTokCard,
  ReferenceMediaViewer,
  resolveTikTokCardMediaKind,
  type ReferenceMediaViewerPayload,
} from "@/components/tools/tiktok-reference-downloader/reference-media-viewer"
import { toTikTokPlaybackUrl } from "@/lib/tiktok/playback-url"
import { cn } from "@/lib/utils"

const MOTION_MODEL = "kwaivgi/kling-v3-motion-control" as const

type SearchSummary = {
  id: string
  status: string
  searchQuery: string
  videoSorting: TikTokVideoSearchSorting
  dateFilter: TikTokVideoSearchDateFilter
  resultsRequested: number
  errorMessage?: string | null
  createdAt?: string | null
}

function buildMotionHref(videoUrl: string) {
  const params = new URLSearchParams()
  params.set("model", MOTION_MODEL)
  params.set("referenceVideoUrl", videoUrl)
  return `/video?${params.toString()}`
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

async function clipboard(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied`)
  } catch {
    toast.error(`Could not copy ${label}`)
  }
}

function ResearchCard({
  video,
  onOpenViewer,
}: {
  video: NormalizedTikTokVideoCard
  onOpenViewer: (payload: ReferenceMediaViewerPayload) => void
}) {
  const mediaKind = resolveTikTokCardMediaKind(video)
  const slides = (video.slideshowImageUrls ?? []).filter((url) => url.startsWith("http"))
  const hasPlayableVideo =
    typeof video.playableVideoUrl === "string" && video.playableVideoUrl.startsWith("http")
  const playbackSrc = toTikTokPlaybackUrl(video.playableVideoUrl)
  const [videoPlaybackFailed, setVideoPlaybackFailed] = React.useState(false)
  React.useEffect(() => {
    setVideoPlaybackFailed(false)
  }, [video.id, video.playableVideoUrl])
  const showInlineVideo = mediaKind === "video" && Boolean(playbackSrc) && !videoPlaybackFailed
  const previewSrc =
    (mediaKind === "slideshow" ? slides[0] : null) ??
    video.coverUrl ??
    (hasPlayableVideo ? video.playableVideoUrl : null) ??
    ""
  const motionTarget = hasPlayableVideo ? video.playableVideoUrl! : ""
  const viewerPayload = buildReferenceViewerPayloadFromTikTokCard(video)
  const canOpenViewer = Boolean(viewerPayload)

  const openViewer = () => {
    if (!viewerPayload) return
    onOpenViewer(viewerPayload)
  }

  return (
    <Card className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 text-white shadow-2xl">
      <CardContent className="grid gap-4 p-0 md:grid-cols-[260px,minmax(0,1fr)]">
        <div
          className={cn(
            "group relative aspect-[9/18] bg-black md:aspect-auto md:max-h-none",
            canOpenViewer && "cursor-pointer",
          )}
          role={canOpenViewer ? "button" : undefined}
          tabIndex={canOpenViewer ? 0 : undefined}
          onClick={canOpenViewer ? openViewer : undefined}
          onKeyDown={
            canOpenViewer
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    openViewer()
                  }
                }
              : undefined
          }
        >
          {showInlineVideo ? (
            <video
              src={playbackSrc!}
              poster={video.coverUrl ?? undefined}
              controls
              playsInline
              preload="metadata"
              className="h-full w-full object-contain"
              onClick={(event) => event.stopPropagation()}
              onError={() => setVideoPlaybackFailed(true)}
            />
          ) : slides.length > 0 ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Slideshow preview"
                src={slides[0]}
                className="h-full w-full object-contain opacity-95"
              />
              {slides.length > 1 ? (
                <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-medium text-white">
                  <Images className="size-3" />
                  {slides.length} slides
                </div>
              ) : null}
            </>
          ) : previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt="cover"
              src={previewSrc}
              className="h-full w-full object-contain opacity-95"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-xs text-muted-foreground">
              No preview
            </div>
          )}
          {canOpenViewer ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
              <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white">
                Open full screen
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-6 p-6 text-sm">
          <div>
            <p className="text-4xl font-semibold">{formatCount(video.stats.views)} views</p>
            <div className="mt-6 space-y-3 text-muted-foreground">
              <p className="flex items-center gap-2">
                <ChatCircleDots className="size-4" />
                {formatCount(video.stats.comments)}
              </p>
              <p className="flex items-center gap-2">
                <Heart className="size-4 text-rose-200" />
                {formatCount(video.stats.likes)}
              </p>
              <p className="flex items-center gap-2">
                <BookmarkSimple className="size-4" />
                {formatCount(video.stats.saves)}
              </p>
              <p className="flex items-center gap-2">
                <ShareFat className="size-4" />
                {formatCount(video.stats.shares)}
              </p>
            </div>
          </div>

          <div className="space-y-1 text-[11px] text-muted-foreground">
            <p className="text-base font-semibold text-white">{video.authorDisplayName}</p>
            <p>{video.authorUsername ? `@${video.authorUsername}` : "creator"}</p>
            <p className="line-clamp-3 text-muted-foreground/70">{video.caption ?? "Untitled TikTok clip"}</p>
            <div className="flex flex-wrap gap-2 pt-2 text-[10px] uppercase tracking-wide">
              <Badge variant="secondary" className="border border-white/20 bg-white/10 text-white">
                {video.createTimeISO ?? "recent"}
              </Badge>
              {video.webVideoUrl ? (
                <Badge variant="outline" className="border border-white/20 text-[10px] text-white">
                  TikTok
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="mt-auto flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!video.webVideoUrl}
              type="button"
              onClick={() => void clipboard("Clip URL", video.webVideoUrl ?? "")}
              className="border-white/20 text-white hover:bg-white/10"
            >
              <Copy className="mr-2 size-3.5" />
              Copy TikTok URL
            </Button>
            {motionTarget.startsWith("http") ? (
              <Button variant="outline" size="sm" type="button" asChild className="text-white hover:bg-white/10">
                <Link href={buildMotionHref(motionTarget)} prefetch={false}>
                  <FilmStrip className="mr-2 size-3.5" />
                  Use in Motion Control
                </Link>
              </Button>
            ) : null}
            {canOpenViewer ? (
              <Button
                variant="outline"
                size="sm"
                type="button"
                className="border-white/20 text-white hover:bg-white/10"
                onClick={(event) => {
                  event.stopPropagation()
                  openViewer()
                }}
              >
                <ArrowsOut className="mr-2 size-3.5" />
                Full screen
              </Button>
            ) : null}
            {video.webVideoUrl ? (
              <Button size="sm" variant="ghost" type="button" asChild className="text-white">
                <a href={video.webVideoUrl} target="_blank" rel="noreferrer">
                  Watch on TikTok
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

type SearchJobPayload = {
  id: string
  status: "queued" | "processing" | "completed" | "failed"
  searchQuery?: string | null
  videoSorting?: TikTokVideoSearchSorting | string | null
  dateFilter?: TikTokVideoSearchDateFilter | string | null
  resultsRequested?: number | null
  videos?: NormalizedTikTokVideoCard[] | null
  errorMessage?: string | null
}

export function TikTokTrendSearchTool() {
  const [query, setQuery] = React.useState("")
  const [sorting, setSorting] = React.useState<TikTokVideoSearchSorting>("MOST_LIKED")
  const [dateFilter, setDateFilter] = React.useState<TikTokVideoSearchDateFilter>("ALL_TIME")
  const resultsPerPage = "12"

  const [jobId, setJobId] = React.useState<string | null>(null)
  const [activeJob, setActiveJob] = React.useState<SearchJobPayload | null>(null)
  const [history, setHistory] = React.useState<SearchSummary[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const [viewerPayload, setViewerPayload] = React.useState<ReferenceMediaViewerPayload | null>(null)
  const [authState, setAuthState] = React.useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading")

  React.useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getUser().then(({ data: { user } }) => {
      setAuthState(user ? "authenticated" : "unauthenticated")
    })
  }, [])

  const loadHistory = React.useCallback(async () => {
    if (authState !== "authenticated") return
    const response = await fetch("/api/tiktok-references/searches?limit=12", {
      cache: "no-store",
    })
    const payload = (await response.json()) as { jobs?: SearchSummary[] }
    if (response.ok && payload.jobs) {
      setHistory(payload.jobs)
    }
  }, [authState])

  React.useEffect(() => {
    void loadHistory().catch(() => {})
  }, [loadHistory])

  React.useEffect(() => {
    if (!jobId) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const poll = async () => {
      try {
        const response = await fetch(`/api/tiktok-references/search/${jobId}`, {
          cache: "no-store",
        })

        const payload = (await response.json()) as { error?: string; job?: SearchJobPayload }
        if (!response.ok || !payload.job) {
          throw new Error(payload.error || "Poll failed.")
        }

        const videosTyped = Array.isArray(payload.job.videos)
          ? (payload.job.videos as NormalizedTikTokVideoCard[])
          : null

        const next: SearchJobPayload = {
          ...payload.job,
          videos: videosTyped,
        }

        if (!cancelled) {
          setActiveJob(next)
        }

        if (payload.job.status === "completed") {
          if (!cancelled) {
            setJobId(null)
            setIsSearching(false)
            toast.success("Trend search ready.")
          }
          void loadHistory().catch(() => {})
          return
        }

        if (payload.job.status === "failed") {
          if (!cancelled) {
            setJobId(null)
            setIsSearching(false)
          }
          void loadHistory().catch(() => {})
          return
        }
      } catch (error) {
        if (!cancelled) {
          setIsSearching(false)
          setJobId(null)
          toast.error(error instanceof Error ? error.message : "Search failed.")
        }
      }

      if (!cancelled) {
        timer = setTimeout(() => {
          void poll()
        }, 3000)
      }
    }

    void poll()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [jobId, loadHistory])

  const handleSearchSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = query.trim()

    if (!trimmed) {
      toast.error("Enter a TikTok hashtag, challenge, or topic.")
      return
    }

    if (authState !== "authenticated") {
      toast.error("Sign in to run TikTok research.")
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch("/api/tiktok-references/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          videoSearchSorting: sorting,
          videoSearchDateFilter: dateFilter,
          resultsPerPage: Number(resultsPerPage || "24"),
        }),
      })
      const payload = (await response.json()) as { error?: string; jobId?: string }

      if (!response.ok || !payload.jobId) {
        throw new Error(payload.error || "Unable to queue TikTok search.")
      }

      toast.message("Scanning TikTok…", {
        description: `Fetching up to ${resultsPerPage} clips with downloadable previews. This can take 1–3 minutes.`,
      })

      const placeholder: SearchJobPayload = {
        id: payload.jobId,
        status: "queued",
        searchQuery: trimmed,
        videoSorting: sorting,
        dateFilter,
        resultsRequested: Number(resultsPerPage),
        videos: [],
      }

      setActiveJob(placeholder)
      setJobId(payload.jobId)
    } catch (error) {
      setIsSearching(false)
      toast.error(error instanceof Error ? error.message : "Search failed.")
    }
  }

  const handleHistorySelect = React.useCallback(async (historicalJobId: string) => {
    const response = await fetch(`/api/tiktok-references/search/${historicalJobId}`)
    const payload = (await response.json()) as { job?: SearchJobPayload; error?: string }
    if (!response.ok || !payload.job) {
      toast.error(payload.error || "Couldn't load that past search.")
      return
    }
    const typedVideos = Array.isArray(payload.job.videos) ? payload.job.videos : []
    setActiveJob({
      ...payload.job,
      videos: typedVideos,
    })
  }, [])

  const normalizedVideos =
    Array.isArray(activeJob?.videos) && activeJob.videos.every((video) => typeof video === "object")
      ? (activeJob!.videos as NormalizedTikTokVideoCard[])
      : ([] as NormalizedTikTokVideoCard[])

  return (
    <div className="min-h-screen bg-background px-4 pb-12 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge variant="secondary" className="gap-2">
              <MagnifyingGlass className="size-4" weight="bold" />
              TikTok Inspiration Lab
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
              TikTok Trend Search
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              Filter TikTok video search exactly like TikTok&apos;s explorer: sort by hottest clips, constrain by time
              range, and remix them inside Motion Control.
            </p>
          </div>
          {authState === "authenticated" ? null : (
            <Button variant="outline" asChild>
              <Link href="/login">Sign in first</Link>
            </Button>
          )}
        </div>

        <form className="space-y-3" onSubmit={handleSearchSubmit}>
          <div className="flex items-center gap-2 rounded-2xl border bg-card px-4 py-1 transition-colors focus-within:border-foreground/30">
            <MagnifyingGlass className="size-4 shrink-0 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search creators, hashtags, moods…"
              className="flex-1 border-none bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-0"
              disabled={authState !== "authenticated"}
            />
            <Button
              type="submit"
              disabled={isSearching || authState !== "authenticated"}
              size="icon"
              className="size-9 shrink-0 rounded-xl"
            >
              {isSearching ? (
                <CircleNotch className="size-4 animate-spin" />
              ) : (
                <MagnifyingGlass className="size-4" weight="bold" />
              )}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={sorting}
              onValueChange={(value) =>
                setSorting(value as TikTokVideoSearchSorting)
              }
            >
              <SelectTrigger className="h-10 w-auto rounded-xl px-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <ArrowsDownUp className="size-3.5 shrink-0 text-muted-foreground" />
                  <SelectValue placeholder="Sort" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MOST_RELEVANT">
                  <div className="flex items-center gap-2">
                    <MagnifyingGlass className="size-3.5 text-muted-foreground" />
                    Best match
                  </div>
                </SelectItem>
                <SelectItem value="MOST_LIKED">
                  <div className="flex items-center gap-2">
                    <Heart className="size-3.5 text-rose-400" />
                    Most liked
                  </div>
                </SelectItem>
                <SelectItem value="LATEST">
                  <div className="flex items-center gap-2">
                    <Fire className="size-3.5 text-orange-400" />
                    Latest
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={dateFilter}
              onValueChange={(value) =>
                setDateFilter(value as TikTokVideoSearchDateFilter)
              }
            >
              <SelectTrigger className="h-10 w-auto rounded-xl px-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <CalendarBlank className="size-3.5 shrink-0 text-muted-foreground" />
                  <SelectValue placeholder="Timeframe" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL_TIME">All time</SelectItem>
                <SelectItem value="PAST_24_HOURS">Past 24h</SelectItem>
                <SelectItem value="PAST_WEEK">Past week</SelectItem>
                <SelectItem value="PAST_MONTH">Past month</SelectItem>
                <SelectItem value="LAST_3_MONTHS">Last 90 days</SelectItem>
                <SelectItem value="LAST_6_MONTHS">Last 6 months</SelectItem>
              </SelectContent>
            </Select>

          </div>
        </form>

        {history.length ? (
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <ClockCounterClockwise className="size-4 text-muted-foreground" />
                Recent TikTok hunts
              </p>
              <div className="flex flex-wrap gap-2">
                {history.map((past) => (
                  <Button
                    variant="outline"
                    size="sm"
                    key={past.id}
                    type="button"
                    onClick={() => void handleHistorySelect(past.id)}
                    className="h-7 rounded-full px-3 text-xs"
                  >
                    {past.searchQuery}
                    <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      · {past.videoSorting}
                    </span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {activeJob ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-foreground">
                {activeJob.searchQuery ?? "Results"} ({activeJob.status})
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{activeJob.videoSorting ?? sorting}</Badge>
                <Badge variant="secondary">{activeJob.dateFilter ?? dateFilter}</Badge>
                <Badge>{activeJob.resultsRequested ?? Number(resultsPerPage)} pull</Badge>
              </div>
            </div>
            {activeJob.errorMessage ? (
              <Card className="border-destructive/40 bg-destructive/5">
                <CardContent className="p-4 text-sm text-destructive">{activeJob.errorMessage}</CardContent>
              </Card>
            ) : null}
            <div className="grid gap-6 xl:grid-cols-2">
              {normalizedVideos.map((video, index) => (
                <ResearchCard
                  video={video}
                  onOpenViewer={setViewerPayload}
                  key={video.id ?? video.webVideoUrl ?? video.coverUrl ?? `tiktok-result-${index}`}
                />
              ))}
            </div>
            {!normalizedVideos.length && activeJob.status === "completed" ? (
              <div className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
                TikTok&apos;s crawler returned zero normalized clips — tweak your topic or widen the timeframe.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed px-6 py-14 text-center text-sm text-muted-foreground">
            {authState === "authenticated"
              ? "Run a search above; Apify-backed cards land here when the dataset finishes hydrating."
              : "Sign in to unlock trend mining + motion transfer hooks."}
          </div>
        )}
      {viewerPayload ? (
        <ReferenceMediaViewer payload={viewerPayload} onClose={() => setViewerPayload(null)} />
      ) : null}
      </div>
    </div>
  )
}
