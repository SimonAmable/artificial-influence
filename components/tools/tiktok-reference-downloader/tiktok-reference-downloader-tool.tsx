"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowsOut,
  CircleNotch,
  DownloadSimple,
  FilmStrip,
  LinkSimple,
  TrashSimple,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import type { NormalizedInstagramPost } from "@/lib/server/apify/instagram-scraper-types"
import type { NormalizedTikTokVideoCard } from "@/lib/server/apify/tiktok-scraper-types"
import { createClient } from "@/lib/supabase/client"
import {
  downloadReferenceImageSlides,
  REFERENCE_SLIDES_ZIP_THRESHOLD,
} from "@/lib/client/download-reference-slides"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

import {
  buildReferenceMediaItems,
  ReferenceMediaViewer,
  type ReferenceMediaViewerPayload,
} from "./reference-media-viewer"

const MOTION_MODEL = "kwaivgi/kling-v3-motion-control" as const
const HISTORY_PAGE_SIZE = 6
type DownloadMediaKind = "video" | "slideshow"

type ReferenceSourcePlatform = "tiktok" | "instagram"

type MediaSnapshot = NormalizedTikTokVideoCard | NormalizedInstagramPost

type DownloadJobStatus = {
  id: string
  status: "queued" | "processing" | "completed" | "failed"
  sourcePlatform: ReferenceSourcePlatform
  sourceTiktokUrl: string
  outputPublicUrl: string | null
  outputStoragePath: string | null
  outputPublicUrls: string[]
  outputStoragePaths: string[]
  outputMediaKind: DownloadMediaKind | null
  normalizationProfile: string | null
  tiktokSnapshot: MediaSnapshot | null
  apifyRunId: string | null
  errorMessage: string | null
  createdAt: string | null
  completedAt: string | null
}

type HistoryDownloadRow = {
  id: string
  status: string
  sourcePlatform?: ReferenceSourcePlatform
  sourceTiktokUrl: string | null
  outputPublicUrl: string | null
  outputPublicUrls: string[]
  outputMediaKind: DownloadMediaKind | null
  normalizationProfile: string | null
  tiktokSnapshot: MediaSnapshot | null
  errorMessage: string | null
  createdAt: string | null
}

function buildMotionControlHref(videoUrl: string) {
  const params = new URLSearchParams()
  params.set("model", MOTION_MODEL)
  params.set("referenceVideoUrl", videoUrl)
  return `/video?${params.toString()}`
}

async function downloadUrlAsFile(sourceUrl: string, fileName: string) {
  const response = await fetch(sourceUrl, { mode: "cors", cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`)
  }
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement("a")
    anchor.href = objectUrl
    anchor.download = fileName || "tiktok-motion.mp4"
    anchor.rel = "noreferrer"
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function inferExtensionFromUrl(url: string, fallback: "mp4" | "jpg") {
  const lower = url.toLowerCase()
  if (lower.includes(".png")) return "png"
  if (lower.includes(".webp")) return "webp"
  if (lower.includes(".jpeg") || lower.includes(".jpg")) return "jpg"
  if (lower.includes(".mp4")) return "mp4"
  return fallback
}

function resolveMediaKind(mediaKind: DownloadMediaKind | null, mediaUrls: string[]) {
  if (mediaKind) return mediaKind
  return mediaUrls.length > 1 ? "slideshow" : "video"
}

function resolveSnapshotCover(snapshot: MediaSnapshot | null | undefined, platform: ReferenceSourcePlatform) {
  if (!snapshot || typeof snapshot !== "object") return ""
  const record = snapshot as Record<string, unknown>
  if (platform === "instagram") {
    const url = record.displayUrl
    return typeof url === "string" ? url : ""
  }
  const url = record.coverUrl
  return typeof url === "string" ? url : ""
}

function historyRowPlatform(row: HistoryDownloadRow): ReferenceSourcePlatform {
  return row.sourcePlatform ?? "tiktok"
}

function buildViewerPayloadFromDownloadContext(params: {
  jobId: string
  platform: ReferenceSourcePlatform
  sourcePostUrl: string | null
  outputPublicUrls: string[]
  outputPublicUrl: string | null
  outputMediaKind: DownloadMediaKind | null
  tiktokSnapshot: MediaSnapshot | null
  normalizationProfile: string | null
  createdAt: string | null
  completedAt: string | null
}): ReferenceMediaViewerPayload | null {
  const urls =
    params.outputPublicUrls.length > 0
      ? params.outputPublicUrls
      : params.outputPublicUrl
        ? [params.outputPublicUrl]
        : []
  const kind = resolveMediaKind(params.outputMediaKind, urls)
  const items = buildReferenceMediaItems(kind, urls, params.outputPublicUrl)
  if (items.length === 0) {
    return null
  }
  const primaryUrl = urls[0] ?? params.outputPublicUrl ?? ""
  const posterUrl = resolveSnapshotCover(params.tiktokSnapshot, params.platform)
  return {
    jobId: params.jobId,
    platform: params.platform,
    sourcePostUrl: params.sourcePostUrl,
    mediaKind: kind,
    mediaItems: items,
    posterUrl: posterUrl || null,
    snapshot: params.tiktokSnapshot,
    normalizationProfile: params.normalizationProfile,
    createdAt: params.createdAt,
    completedAt: params.completedAt,
    motionControlHref:
      kind === "video" && primaryUrl ? buildMotionControlHref(primaryUrl) : null,
  }
}

export function TikTokReferenceDownloaderTool() {
  const [tiktokUrl, setTiktokUrl] = React.useState("")
  const [job, setJob] = React.useState<DownloadJobStatus | null>(null)
  const [currentJobId, setCurrentJobId] = React.useState<string | null>(null)
  const [history, setHistory] = React.useState<HistoryDownloadRow[]>([])
  const [historyPage, setHistoryPage] = React.useState(1)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [downloadBusy, setDownloadBusy] = React.useState(false)
  const [deletingIds, setDeletingIds] = React.useState<string[]>([])
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

  const fetchHistory = React.useCallback(async () => {
    if (authState !== "authenticated") return
    const response = await fetch("/api/tiktok-references/downloads?limit=20", {
      cache: "no-store",
    })
    const payload = (await response.json()) as {
      jobs?: HistoryDownloadRow[]
      error?: string
    }

    if (!response.ok || !payload.jobs) {
      throw new Error(payload.error || "Could not load download history.")
    }

    setHistory(payload.jobs)
  }, [authState])

  React.useEffect(() => {
    void fetchHistory().catch(() => {})
  }, [fetchHistory])

  React.useEffect(() => {
    setHistoryPage(1)
  }, [history])

  React.useEffect(() => {
    if (!currentJobId) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const poll = async () => {
      try {
        const response = await fetch(`/api/tiktok-references/download/${currentJobId}`, {
          cache: "no-store",
        })
        const payload = (await response.json()) as { error?: string; job?: DownloadJobStatus }
        if (!response.ok || !payload.job) {
          throw new Error(payload.error || "Could not load download status.")
        }

        const snapshot = payload.job.tiktokSnapshot
        const nextJob: DownloadJobStatus = {
          ...payload.job,
          sourcePlatform: payload.job.sourcePlatform ?? "tiktok",
          tiktokSnapshot:
            snapshot && typeof snapshot === "object" ? (snapshot as MediaSnapshot) : null,
        }

        if (!cancelled) {
          setJob(nextJob)

          if (nextJob.status === "completed") {
            setCurrentJobId(null)
            setIsSubmitting(false)
            toast.success(
              nextJob.sourcePlatform === "instagram"
                ? "Instagram media is ready."
                : "TikTok media is ready.",
            )
            void fetchHistory().catch(() => {})
            return
          }

          if (nextJob.status === "failed") {
            setCurrentJobId(null)
            setIsSubmitting(false)
            void fetchHistory().catch(() => {})
            return
          }
        }
      } catch (error) {
        if (!cancelled) {
          setIsSubmitting(false)
          toast.error(error instanceof Error ? error.message : "Polling failed.")
          setCurrentJobId(null)
        }
      }

      if (!cancelled) {
        timer = setTimeout(() => {
          void poll()
        }, 2500)
      }
    }

    void poll()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [currentJobId, fetchHistory])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!tiktokUrl.trim()) {
      toast.error("Paste a TikTok or Instagram URL first.")
      return
    }
    if (authState !== "authenticated") {
      toast.error("Sign in to download TikTok and Instagram posts.")
      return
    }

    setIsSubmitting(true)
    setJob(null)

    try {
      const response = await fetch("/api/tiktok-references/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: tiktokUrl.trim() }),
      })
      const payload = (await response.json()) as {
        error?: string
        jobId?: string
        sourcePlatform?: ReferenceSourcePlatform
      }

      if (!response.ok || !payload.jobId) {
        throw new Error(payload.error || "Couldn't start the download. Please try again.")
      }

      toast.message("Fetching media…", {
        description: "This typically takes ~10–45 seconds.",
      })
      const sourcePlatform: ReferenceSourcePlatform = payload.sourcePlatform ?? "tiktok"
      setCurrentJobId(payload.jobId)
      setJob({
        id: payload.jobId,
        status: "queued",
        sourcePlatform,
        sourceTiktokUrl: tiktokUrl.trim(),
        outputPublicUrl: null,
        outputStoragePath: null,
        outputPublicUrls: [],
        outputStoragePaths: [],
        outputMediaKind: null,
        normalizationProfile: null,
        tiktokSnapshot: null,
        apifyRunId: null,
        errorMessage: null,
        createdAt: null,
        completedAt: null,
      })
    } catch (error) {
      setIsSubmitting(false)
      toast.error(error instanceof Error ? error.message : "Something went wrong.")
    }
  }

  const hostedVideoUrl = job?.outputPublicUrl ?? ""
  const thumbnail = job
    ? resolveSnapshotCover(job.tiktokSnapshot, job.sourcePlatform)
    : ""
  const jobMediaUrls = job?.outputPublicUrls ?? []
  const jobMediaKind = resolveMediaKind(job?.outputMediaKind ?? null, jobMediaUrls)
  const primaryMediaUrl = jobMediaUrls[0] ?? hostedVideoUrl
  const successfulHistory = React.useMemo(
    () =>
      history.filter((row) => {
        return row.status === "completed" && (row.outputPublicUrls.length > 0 || Boolean(row.outputPublicUrl))
      }),
    [history],
  )
  const totalHistoryPages = Math.max(1, Math.ceil(successfulHistory.length / HISTORY_PAGE_SIZE))
  const safeHistoryPage = Math.min(historyPage, totalHistoryPages)
  const paginatedHistory = React.useMemo(() => {
    const start = (safeHistoryPage - 1) * HISTORY_PAGE_SIZE
    return successfulHistory.slice(start, start + HISTORY_PAGE_SIZE)
  }, [safeHistoryPage, successfulHistory])

  const latestCompletedViewerPayload = React.useMemo(() => {
    if (!job || job.status !== "completed") return null
    return buildViewerPayloadFromDownloadContext({
      jobId: job.id,
      platform: job.sourcePlatform,
      sourcePostUrl: job.sourceTiktokUrl,
      outputPublicUrls: job.outputPublicUrls,
      outputPublicUrl: job.outputPublicUrl,
      outputMediaKind: job.outputMediaKind,
      tiktokSnapshot: job.tiktokSnapshot,
      normalizationProfile: job.normalizationProfile,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    })
  }, [job])

  const handleFileDownload = React.useCallback(async (url: string, fileName: string) => {
    setDownloadBusy(true)
    try {
      await downloadUrlAsFile(url, fileName)
      toast.success("Download started")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not download file. Try disabling cross-site protections or opening the preview and saving manually.",
      )
    } finally {
      setDownloadBusy(false)
    }
  }, [])

  const handleDownloadAllSlides = React.useCallback(async (urls: string[], fileBaseName: string) => {
    if (!urls.length) return
    setDownloadBusy(true)
    try {
      await downloadReferenceImageSlides(urls, fileBaseName)
      if (urls.length > REFERENCE_SLIDES_ZIP_THRESHOLD) {
        toast.success("ZIP download started")
      } else if (urls.length === 1) {
        toast.success("Download started")
      } else {
        toast.success(`Downloaded ${urls.length} slides`)
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not download slideshow. Please try again.",
      )
    } finally {
      setDownloadBusy(false)
    }
  }, [])

  const handleDeleteHistoryItem = React.useCallback(async (jobId: string) => {
    setDeletingIds((current) => [...current, jobId])
    try {
      const response = await fetch(`/api/tiktok-references/download/${jobId}`, {
        method: "DELETE",
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || "Could not delete this history item.")
      }

      setHistory((current) => current.filter((row) => row.id !== jobId))
      if (job?.id === jobId) {
        setJob(null)
      }
      setViewerPayload((current) => (current?.jobId === jobId ? null : current))
      toast.success("Deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed.")
    } finally {
      setDeletingIds((current) => current.filter((id) => id !== jobId))
    }
  }, [job?.id])

  return (
    <div className="min-h-screen bg-background px-4 pb-12 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        <div className="space-y-3">
          <Badge variant="secondary" className="w-fit gap-1.5">
            <FilmStrip className="size-3.5" weight="duotone" />
            TikTok {"&"} Instagram
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            TikTok {"&"} Instagram downloader
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Paste a public TikTok or Instagram post or reel link. Media is saved to your library—you get a stable link
            for playback and download that won&apos;t expire like social platform links.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <Card>
            <CardContent className="space-y-4 p-6">
              <label className="text-sm font-semibold text-foreground" htmlFor="reference-url">
                Post URL
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  id="reference-url"
                  placeholder="Paste a TikTok or Instagram post/reel URL"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={Boolean(currentJobId) || authState !== "authenticated"}
                  value={tiktokUrl}
                  onChange={(event) => setTiktokUrl(event.target.value)}
                  className="sm:flex-1"
                />
                <Button
                  className="w-full sm:w-auto sm:min-w-[140px]"
                  disabled={isSubmitting || authState !== "authenticated"}
                  type="submit"
                >
                  {isSubmitting ? (
                    <>
                      <CircleNotch className="mr-2 size-4 animate-spin" />
                      Downloading…
                    </>
                  ) : (
                    "Download"
                  )}
                </Button>
              </div>
              {authState === "unauthenticated" ? (
                <p className="text-xs text-muted-foreground">
                  Sign in keeps the original download history synced to your account.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </form>

        {job ? (
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Latest result</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {job.sourcePlatform === "instagram" ? "Instagram" : "TikTok"}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      Status: <span className="font-semibold capitalize">{job.status}</span>
                    </p>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm">
                  <a href={job.sourceTiktokUrl ?? "#"} target="_blank" rel="noreferrer">
                    <LinkSimple className="mr-2 size-3.5" />
                    {job.sourcePlatform === "instagram" ? "Open Instagram post" : "Open TikTok link"}
                  </a>
                </Button>
              </div>

              {job.errorMessage ? (
                <Card className="border-destructive/40 bg-destructive/5">
                  <CardContent className="p-4 text-sm text-destructive">
                    {job.errorMessage}
                  </CardContent>
                </Card>
              ) : null}

              {primaryMediaUrl || thumbnail || job.status === "queued" || job.status === "processing" ? (
                <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                  {primaryMediaUrl && jobMediaKind === "video" ? (
                    <video
                      controls
                      playsInline
                      className="mx-auto max-h-[70vh] rounded-lg bg-black"
                      src={primaryMediaUrl}
                      poster={thumbnail || undefined}
                    />
                  ) : jobMediaUrls.length > 0 && jobMediaKind === "slideshow" ? (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">
                        {jobMediaUrls.length} slides detected
                      </div>
                      <div className="grid max-h-[70vh] grid-cols-2 gap-2 overflow-auto pr-1 sm:grid-cols-3">
                        {jobMediaUrls.map((imageUrl, index) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={`${imageUrl}-${index}`}
                            src={imageUrl}
                            alt={`Slide ${index + 1}`}
                            className="aspect-9/16 w-full rounded-lg object-cover"
                          />
                        ))}
                      </div>
                    </div>
                  ) : thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnail}
                      alt="Cover only preview"
                      className="max-h-[560px] w-full rounded-lg object-cover"
                    />
                  ) : job.status === "queued" || job.status === "processing" ? (
                    <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-background/60 p-6 text-center">
                      <CircleNotch className="size-8 animate-spin text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">Preparing preview</p>
                      <p className="text-xs text-muted-foreground">We&apos;re fetching media from the post.</p>
                    </div>
                  ) : null}


                  {!primaryMediaUrl && thumbnail ? (
                    <p className="text-xs text-muted-foreground">
                      Waiting for your file to finish uploading—or this post did not include downloadable media. Try another clip.
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {primaryMediaUrl ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={downloadBusy}
                        onClick={() =>
                          jobMediaKind === "slideshow"
                            ? void handleDownloadAllSlides(jobMediaUrls, `social-reference-${job.id}`)
                            : (() => {
                                const extension = inferExtensionFromUrl(primaryMediaUrl, "mp4")
                                void handleFileDownload(primaryMediaUrl, `social-reference-${job.id}.${extension}`)
                              })()
                        }
                      >
                        {downloadBusy ? (
                          <CircleNotch className="mr-2 size-4 animate-spin" />
                        ) : (
                          <DownloadSimple className="mr-2 size-4" />
                        )}
                        {jobMediaKind === "slideshow"
                          ? jobMediaUrls.length > REFERENCE_SLIDES_ZIP_THRESHOLD
                            ? "Download ZIP"
                            : "Download all"
                          : "Download file"}
                      </Button>
                    ) : (
                      <Button type="button" variant="outline" disabled title="Download will be ready once upload finishes">
                        <DownloadSimple className="mr-2 size-4" />
                        Download file
                      </Button>
                    )}

                    {latestCompletedViewerPayload ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={downloadBusy}
                        onClick={() => setViewerPayload(latestCompletedViewerPayload)}
                      >
                        <ArrowsOut className="mr-2 size-4" />
                        Full screen
                      </Button>
                    ) : null}

                    {primaryMediaUrl && jobMediaKind === "video" ? (
                      <Button asChild variant="default">
                        <Link href={buildMotionControlHref(primaryMediaUrl)} prefetch={false}>
                          <FilmStrip className="mr-2 size-4" weight="fill" />
                          Use in Motion Control
                        </Link>
                      </Button>
                    ) : null}
                  </div>

                  {jobMediaKind === "video" ? (
                    <p className="text-[11px] text-muted-foreground">
                      Motion Control uses your saved library link once the upload finishes—not temporary social links
                      that can expire.
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Slideshow posts are saved as image sets. Download each frame or use them in image-first workflows.
                    </p>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border border-dashed px-8 py-12 text-center text-sm text-muted-foreground">
            {authState !== "authenticated" ? (
              "Sign in to download clips and save them to your library."
            ) : isSubmitting ? (
              <div className="flex flex-col items-center justify-center gap-3">
                <CircleNotch className="size-7 animate-spin text-muted-foreground" />
                <p>Fetching your media…</p>
              </div>
            ) : (
              "Paste a TikTok or Instagram URL above—we save files to your library and preview them here when ready."
            )}
          </div>
        )}

        {authState === "unauthenticated" ? (
          <div className="flex justify-center">
            <Button asChild variant="secondary">
              <Link href="/login">Sign in to continue</Link>
            </Button>
          </div>
        ) : null}

        {successfulHistory.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">History</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedHistory.map((row) => {
                const rowPlatform = historyRowPlatform(row)
                const rowMediaUrls =
                  row.outputPublicUrls.length > 0 ? row.outputPublicUrls : row.outputPublicUrl ? [row.outputPublicUrl] : []
                const rowPrimaryUrl = rowMediaUrls[0] ?? ""
                const rowMediaKind = resolveMediaKind(row.outputMediaKind, rowMediaUrls)
                const isDeleting = deletingIds.includes(row.id)
                const rowCover = resolveSnapshotCover(row.tiktokSnapshot ?? null, rowPlatform)
                const historyViewerPayload = buildViewerPayloadFromDownloadContext({
                  jobId: row.id,
                  platform: rowPlatform,
                  sourcePostUrl: row.sourceTiktokUrl,
                  outputPublicUrls: row.outputPublicUrls,
                  outputPublicUrl: row.outputPublicUrl,
                  outputMediaKind: row.outputMediaKind,
                  tiktokSnapshot: row.tiktokSnapshot,
                  normalizationProfile: row.normalizationProfile,
                  createdAt: row.createdAt,
                  completedAt: null,
                })

                return (
                  <Card key={row.id} className="overflow-hidden">
                  <CardContent className="flex h-full flex-col p-0">
                    <div className="relative h-[260px] w-full overflow-hidden bg-muted">
                      {rowPrimaryUrl && rowMediaKind === "video" ? (
                        <video
                          controls
                          playsInline
                          preload="metadata"
                          src={rowPrimaryUrl}
                          poster={rowCover || undefined}
                          className="h-full w-full bg-black object-cover"
                        />
                      ) : rowMediaUrls.length > 0 ? (
                        <div className="flex h-full flex-col gap-1 p-2">
                          <p className="px-1 text-[10px] text-muted-foreground">{rowMediaUrls.length} slides</p>
                          <div className="flex min-h-0 flex-1 gap-1 overflow-x-auto pb-1">
                            {rowMediaUrls.map((imageUrl, index) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={`${imageUrl}-${index}`}
                                src={imageUrl}
                                alt={`History slide ${index + 1}`}
                                className="h-full w-20 shrink-0 rounded object-cover"
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          Media unavailable
                        </div>
                      )}
                      {historyViewerPayload ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          type="button"
                          disabled={downloadBusy}
                          className="absolute right-2 top-2 z-10 shrink-0 px-2 shadow-sm"
                          title="Full screen"
                          onClick={() => setViewerPayload(historyViewerPayload)}
                        >
                          <ArrowsOut className="size-3.5" />
                        </Button>
                      ) : null}
                    </div>
                      <div className="space-y-2 px-3 pb-3 pt-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{rowPlatform === "instagram" ? "Instagram" : "TikTok"}</Badge>
                          <Badge variant="secondary">
                            {rowMediaKind === "video" ? "Video" : `Slideshow · ${rowMediaUrls.length}`}
                          </Badge>
                          <p className="ml-auto text-[11px] text-muted-foreground">
                            {(row.createdAt ?? "").slice(0, 10) || "Unknown date"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {rowPrimaryUrl ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              type="button"
                              disabled={downloadBusy}
                              onClick={() =>
                                rowMediaKind === "slideshow"
                                  ? void handleDownloadAllSlides(rowMediaUrls, `social-reference-${row.id}`)
                                  : (() => {
                                      const extension = inferExtensionFromUrl(rowPrimaryUrl, "mp4")
                                      void handleFileDownload(rowPrimaryUrl, `social-reference-${row.id}.${extension}`)
                                    })()
                              }
                            >
                              <DownloadSimple className="mr-2 size-3.5" />
                              {rowMediaKind === "slideshow"
                                ? rowMediaUrls.length > REFERENCE_SLIDES_ZIP_THRESHOLD
                                  ? "Download ZIP"
                                  : "Download all"
                                : "Download"}
                            </Button>
                          ) : null}
                          {rowPrimaryUrl && rowMediaKind === "video" ? (
                            <Button asChild size="sm" className="flex-1">
                              <Link href={buildMotionControlHref(rowPrimaryUrl)}>
                                Motion
                              </Link>
                            </Button>
                          ) : null}
                          <div className="ml-auto flex items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8 text-muted-foreground hover:text-foreground"
                              disabled={!row.sourceTiktokUrl}
                              onClick={() => {
                                if (!row.sourceTiktokUrl) return
                                window.open(row.sourceTiktokUrl, "_blank", "noopener,noreferrer")
                              }}
                              aria-label="Open source post"
                            >
                              <LinkSimple className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8 text-muted-foreground hover:text-foreground"
                              disabled={isDeleting}
                              onClick={() => void handleDeleteHistoryItem(row.id)}
                              aria-label="Delete history item"
                            >
                              {isDeleting ? (
                                <CircleNotch className="size-3.5 animate-spin" />
                              ) : (
                                <TrashSimple className="size-3.5" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
            {totalHistoryPages > 1 ? (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={safeHistoryPage <= 1}
                  onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                >
                  Previous
                </Button>
                <p className="text-xs text-muted-foreground">
                  Page {safeHistoryPage} of {totalHistoryPages}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={safeHistoryPage >= totalHistoryPages}
                  onClick={() => setHistoryPage((page) => Math.min(totalHistoryPages, page + 1))}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </div>
        ) : authState === "authenticated" ? (
          <div className="rounded-lg border border-dashed px-8 py-8 text-center text-sm text-muted-foreground">
            Completed downloads will appear in History.
          </div>
        ) : null}
      </div>

      {viewerPayload ? (
        <ReferenceMediaViewer payload={viewerPayload} onClose={() => setViewerPayload(null)} />
      ) : null}
    </div>
  )
}
