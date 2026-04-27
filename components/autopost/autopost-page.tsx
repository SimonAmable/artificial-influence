"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CalendarClock,
  Film,
  ImageIcon,
  Layers,
  LayoutList,
  Link2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Zap,
} from "lucide-react"
import { format, formatDistanceToNow, isBefore, startOfDay, startOfToday } from "date-fns"
import { toast } from "sonner"

import type { AutopostJobMetadata } from "@/lib/autopost/types"
import { ensureJpegForInstagramFeed } from "@/lib/autopost/convert-image-for-instagram"
import type { InstagramSavedProfile } from "@/lib/instagram/profile"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

const AUTOPOST_MEDIA_FOLDER = "autopost-drafts"

type PostFormat = "feed_image" | "feed_video" | "reel" | "carousel" | "story"

function inferFileKind(file: File): "image" | "video" | null {
  if (file.type.startsWith("image/")) {
    return "image"
  }
  if (file.type.startsWith("video/")) {
    return "video"
  }
  return null
}

function postFormatToApiMediaType(format: PostFormat): "image" | "feed_video" | "reel" | "carousel" | "story" {
  switch (format) {
    case "feed_image":
      return "image"
    case "feed_video":
      return "feed_video"
    case "reel":
      return "reel"
    case "carousel":
      return "carousel"
    case "story":
      return "story"
  }
}

function defaultScheduleDate() {
  return new Date(Date.now() + 60 * 60 * 1000)
}

const SCHEDULE_HOURS = Array.from({ length: 24 }, (_, i) => i)
const SCHEDULE_MINUTES = Array.from({ length: 60 }, (_, i) => i)

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

export type AutopostJobRow = {
  id: string
  media_url: string
  caption: string | null
  media_type: string
  metadata?: AutopostJobMetadata | null
  status: string
  scheduled_at: string | null
  published_at: string | null
  created_at: string
  updated_at: string
  last_error: string | null
  provider_publish_id: string | null
  provider_container_id: string | null
  instagram_connection_id: string | null
  instagram_username: string | null
}

function formatLocal(iso: string) {
  return new Date(iso).toLocaleString()
}

/** Primary line next to the status badge (human-readable “when” for this status). */
function postStatusTimeLine(job: AutopostJobRow): string {
  switch (job.status) {
    case "published": {
      const t = job.published_at ?? job.updated_at
      return `Published ${formatLocal(t)}`
    }
    case "queued":
      return job.scheduled_at
        ? `Scheduled for ${formatLocal(job.scheduled_at)}`
        : `Queued ${formatLocal(job.created_at)}`
    case "draft":
      return `Saved ${formatLocal(job.created_at)}`
    case "processing":
      return `Publishing… ${formatLocal(job.updated_at)}`
    case "failed":
      return `Failed ${formatLocal(job.updated_at)}`
    case "cancelled":
      return `Cancelled ${formatLocal(job.updated_at)}`
    default:
      return formatLocal(job.created_at)
  }
}

/** If the post was scheduled and published at a different time, show context (cron skew). */
function scheduledVsPublishedNote(job: AutopostJobRow): string | null {
  if (job.status !== "published" || !job.scheduled_at || !job.published_at) {
    return null
  }
  const sched = new Date(job.scheduled_at).getTime()
  const pub = new Date(job.published_at).getTime()
  if (!Number.isFinite(sched) || !Number.isFinite(pub)) {
    return null
  }
  if (Math.abs(pub - sched) < 90_000) {
    return null
  }
  return `Originally scheduled for ${formatLocal(job.scheduled_at)}`
}

/** Label for which IG account a job targets (shown prominently in the list). */
function jobAccountLabel(job: AutopostJobRow): string {
  const u = job.instagram_username?.trim()
  if (u) {
    return `@${u}`
  }
  if (job.instagram_connection_id) {
    return `Account ${job.instagram_connection_id.slice(0, 8)}…`
  }
  return "No Instagram link (legacy or disconnected)"
}

const AUTOPOST_COMPOSER_ACCOUNT_KEY = "autopost-composer-instagram-connection-id"

function mediaTypeLabel(mediaType: string): string {
  switch (mediaType) {
    case "image":
      return "Feed photo"
    case "feed_video":
      return "Feed video"
    case "reel":
      return "Reel"
    case "carousel":
      return "Carousel"
    case "story":
      return "Story"
    default:
      return mediaType
  }
}

function jobListThumbnailIsVideo(job: AutopostJobRow): boolean {
  const t = job.media_type
  if (t === "reel" || t === "feed_video") {
    return true
  }
  if (t === "story") {
    return job.metadata?.assetKind === "video"
  }
  if (t === "carousel") {
    return job.metadata?.carouselItems?.[0]?.kind === "video"
  }
  return false
}

const TOKEN_EXPIRY_WARNING_MS = 7 * 24 * 60 * 60 * 1000

function socialTokenExpiryBanner(provider: "Instagram" | "TikTok", tokenExpiresAt: string | null): {
  variant: "expired" | "soon"
  body: string
} | null {
  if (!tokenExpiresAt) return null
  const expires = new Date(tokenExpiresAt)
  const t = expires.getTime()
  if (!Number.isFinite(t)) return null
  const now = Date.now()
  if (t <= now) {
    return {
      variant: "expired",
      body: `${provider} access token expired. Disconnect and connect again.`,
    }
  }
  if (t - now > TOKEN_EXPIRY_WARNING_MS) return null
  const when = expires.toLocaleString()
  return {
    variant: "soon",
    body: `Token expires ${formatDistanceToNow(expires, { addSuffix: true })} (${when}). Reconnect before then to avoid interruptions.`,
  }
}

type SocialProvider = "instagram" | "tiktok"

type SocialConnectionItem = {
  id: string
  provider: SocialProvider
  providerAccountId: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  status: "connected" | "disconnected" | "error" | "expired" | string
  scopes: string[]
  refreshTokenExpiresAt: string | null
  metadata?: Record<string, unknown>
  profile: InstagramSavedProfile | TikTokSavedProfile | null
  instagramConnectionId: string | null
  instagramUsername: string | null
  instagramUserId: string | null
  accountType: string | null
  tokenExpiresAt: string | null
  updatedAt: string
}

type SocialProviderStatus = {
  connected: boolean
  connections: SocialConnectionItem[]
}

type SocialConnectionsStatus = {
  providers?: {
    instagram?: SocialProviderStatus
    tiktok?: SocialProviderStatus
  }
  instagram?: SocialProviderStatus
  tiktok?: SocialProviderStatus
}

type TikTokSavedProfile = {
  open_id: string
  display_name: string | null
  avatar_url: string | null
  profile_deep_link: string | null
  bio_description: string | null
  fetched_at: string
}

type DisconnectTarget = {
  provider: SocialProvider
  connectionId: string
  label: string
}

function statusLabel(status: string) {
  switch (status) {
    case "draft":
      return "Draft"
    case "queued":
      return "Scheduled"
    case "processing":
      return "Publishing"
    case "published":
      return "Published"
    case "failed":
      return "Failed"
    case "cancelled":
      return "Cancelled"
    default:
      return status
  }
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "published":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    case "queued":
      return "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-300"
    case "processing":
      return "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
    case "failed":
      return "border-destructive/40 bg-destructive/10 text-destructive"
    case "cancelled":
      return "border-muted-foreground/30 bg-muted text-muted-foreground"
    case "draft":
    default:
      return ""
  }
}

export function AutopostPage() {
  const [status, setStatus] = React.useState<SocialConnectionsStatus | null>(null)
  const [isLoadingStatus, setIsLoadingStatus] = React.useState(true)
  const [isDisconnecting, setIsDisconnecting] = React.useState(false)
  const [refreshingConnectionId, setRefreshingConnectionId] = React.useState<string | null>(null)
  const [selectedComposerConnectionId, setSelectedComposerConnectionId] = React.useState<string | null>(null)
  const [caption, setCaption] = React.useState("")
  const [postFormat, setPostFormat] = React.useState<PostFormat>("feed_image")
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([])
  const [previewUrls, setPreviewUrls] = React.useState<string[]>([])
  const [shareReelToFeed, setShareReelToFeed] = React.useState(true)
  const [reelCoverUrl, setReelCoverUrl] = React.useState("")
  const [composerTab, setComposerTab] = React.useState<"now" | "schedule">("now")
  const [scheduleDate, setScheduleDate] = React.useState(defaultScheduleDate)
  const [schedulePickerOpen, setSchedulePickerOpen] = React.useState(false)

  const [jobs, setJobs] = React.useState<AutopostJobRow[]>([])
  const [isLoadingJobs, setIsLoadingJobs] = React.useState(true)
  const [isPostingDraft, setIsPostingDraft] = React.useState(false)
  const [actionJobId, setActionJobId] = React.useState<string | null>(null)

  const [disconnectTarget, setDisconnectTarget] = React.useState<DisconnectTarget | null>(null)
  const [composerCardHeight, setComposerCardHeight] = React.useState<number | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const composerCardRef = React.useRef<HTMLDivElement>(null)
  const searchParams = useSearchParams()
  const hasHandledAuthParams = React.useRef(false)

  React.useEffect(() => {
    return () => {
      previewUrls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [previewUrls])

  React.useEffect(() => {
    const composerCard = composerCardRef.current
    if (!composerCard || typeof ResizeObserver === "undefined") {
      return
    }

    const syncHeight = () => {
      setComposerCardHeight(composerCard.getBoundingClientRect().height)
    }

    syncHeight()
    const observer = new ResizeObserver(syncHeight)
    observer.observe(composerCard)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setSelectedFiles([])
      setPreviewUrls((prev) => {
        prev.forEach((u) => URL.revokeObjectURL(u))
        return []
      })
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      if (postFormat === "story") {
        setCaption("")
      }
    })
    return () => {
      cancelled = true
    }
  }, [postFormat])

  const fetchStatus = React.useCallback(async () => {
    setIsLoadingStatus(true)
    try {
      const response = await fetch("/api/social-connections/status", { cache: "no-store" })
      const data = (await response.json()) as SocialConnectionsStatus | { error?: string }

      if (!response.ok) {
        throw new Error("error" in data && data.error ? data.error : "Failed to load social connection status.")
      }

      const payload = data as SocialConnectionsStatus
      const instagram = payload.providers?.instagram ?? payload.instagram ?? { connected: false, connections: [] }
      const tiktok = payload.providers?.tiktok ?? payload.tiktok ?? { connected: false, connections: [] }
      setStatus({
        providers: { instagram, tiktok },
        instagram,
        tiktok,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load social connection status")
      const emptyStatus = {
        instagram: { connected: false, connections: [] },
        tiktok: { connected: false, connections: [] },
      }
      setStatus({ providers: emptyStatus, ...emptyStatus })
    } finally {
      setIsLoadingStatus(false)
    }
  }, [])

  const handleRefreshProfile = React.useCallback(
    async (connectionId: string) => {
      setRefreshingConnectionId(connectionId)
      try {
        const response = await fetch("/api/instagram/refresh-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId }),
        })
        const data = (await response.json()) as { ok?: boolean; error?: string }
        if (!response.ok) {
          throw new Error(data.error || "Could not refresh Instagram profile.")
        }
        toast.success("Profile data updated.")
        void fetchStatus()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not refresh profile")
      } finally {
        setRefreshingConnectionId(null)
      }
    },
    [fetchStatus]
  )

  React.useEffect(() => {
    const list = status?.instagram?.connections ?? []
    const publishableConnections = list.filter((c) => c.instagramConnectionId)
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      if (list.length === 0) {
        setSelectedComposerConnectionId(null)
        return
      }
      setSelectedComposerConnectionId((current) => {
        if (current && publishableConnections.some((c) => c.instagramConnectionId === current)) {
          return current
        }
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem(AUTOPOST_COMPOSER_ACCOUNT_KEY)
          if (stored && publishableConnections.some((c) => c.instagramConnectionId === stored)) {
            return stored
          }
        }
        return publishableConnections[0]?.instagramConnectionId ?? null
      })
    })
    return () => {
      cancelled = true
    }
  }, [status?.instagram?.connections])

  const fetchJobs = React.useCallback(async () => {
    setIsLoadingJobs(true)
    try {
      const response = await fetch("/api/autopost/jobs", { cache: "no-store" })
      const data = (await response.json()) as { jobs?: AutopostJobRow[]; error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to load posts.")
      }
      setJobs(data.jobs ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load posts")
      setJobs([])
    } finally {
      setIsLoadingJobs(false)
    }
  }, [])

  React.useEffect(() => {
    queueMicrotask(() => {
      void fetchStatus()
      void fetchJobs()
    })
  }, [fetchStatus, fetchJobs])

  React.useEffect(() => {
    if (hasHandledAuthParams.current) {
      return
    }

    const error = searchParams.get("error")
    const connected = searchParams.get("connected")
    const provider = searchParams.get("provider")

    if (!error && !connected) {
      return
    }

    hasHandledAuthParams.current = true

    if (error) {
      toast.error(error)
    } else if (connected === "1") {
      toast.success(provider === "tiktok" ? "TikTok account connected." : "Instagram account connected.")
      queueMicrotask(() => void fetchStatus())
    }

    const nextUrl = new URL(window.location.href)
    nextUrl.searchParams.delete("error")
    nextUrl.searchParams.delete("connected")
    nextUrl.searchParams.delete("provider")
    const search = nextUrl.searchParams.toString()
    window.history.replaceState({}, "", search ? `${nextUrl.pathname}?${search}` : nextUrl.pathname)
  }, [fetchStatus, searchParams])

  const handleConnectInstagram = () => {
    window.location.href = "/api/instagram/connect"
  }

  const handleConnectTikTok = () => {
    window.location.href = "/api/tiktok/connect"
  }

  const handleDisconnect = async () => {
    if (!disconnectTarget) {
      return
    }
    const target = disconnectTarget
    setIsDisconnecting(true)
    try {
      const response = await fetch(
        target.provider === "tiktok" ? "/api/tiktok/disconnect" : "/api/instagram/disconnect",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId: target.connectionId }),
        }
      )
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(
          data.error ||
            `Failed to disconnect ${target.provider === "tiktok" ? "TikTok" : "Instagram"} account.`
        )
      }
      toast.success(`${target.provider === "tiktok" ? "TikTok" : "Instagram"} account disconnected.`)
      setDisconnectTarget(null)
      if (
        typeof window !== "undefined" &&
        localStorage.getItem(AUTOPOST_COMPOSER_ACCOUNT_KEY) === target.connectionId
      ) {
        localStorage.removeItem(AUTOPOST_COMPOSER_ACCOUNT_KEY)
      }
      await fetchStatus()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disconnect account")
    } finally {
      setIsDisconnecting(false)
    }
  }

  const handleMediaFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const isCarousel = postFormat === "carousel"
    const picked = isCarousel ? Array.from(event.target.files ?? []) : event.target.files?.[0] ? [event.target.files[0]] : []

    if (picked.length === 0) {
      setSelectedFiles([])
      setPreviewUrls((previous) => {
        previous.forEach((u) => URL.revokeObjectURL(u))
        return []
      })
      return
    }

    for (const file of picked) {
      if (!inferFileKind(file)) {
        toast.error("Use images (JPEG, PNG, WebP, GIF) or video (MP4, MOV).")
        event.target.value = ""
        return
      }
    }

    setPreviewUrls((previous) => {
      previous.forEach((u) => URL.revokeObjectURL(u))
      return picked.map((file) => URL.createObjectURL(file))
    })
    setSelectedFiles(picked)
  }

  const resetComposer = () => {
    setCaption("")
    setSelectedFiles([])
    setPreviewUrls((previous) => {
      previous.forEach((u) => URL.revokeObjectURL(u))
      return []
    })
    setShareReelToFeed(true)
    setReelCoverUrl("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    setScheduleDate(defaultScheduleDate())
  }

  const uploadAndCreateDraft = async (scheduledAtIso: string | null) => {
    if (selectedFiles.length === 0) {
      toast.error("Choose media first.")
      return null
    }

    if (!status?.instagram?.connected) {
      toast.error("Connect Instagram before publishing.")
      return null
    }

    if (!selectedComposerConnectionId) {
      toast.error("Select an Instagram account for this post.")
      return null
    }

    const apiMediaType = postFormatToApiMediaType(postFormat)

    if (postFormat === "carousel") {
      if (selectedFiles.length < 2 || selectedFiles.length > 10) {
        toast.error("Carousel needs between 2 and 10 images or videos.")
        return null
      }
    } else if (selectedFiles.length !== 1) {
      toast.error("Select a single file for this post type.")
      return null
    }

    const single = selectedFiles[0]
    const singleKind = inferFileKind(single)
    if (!singleKind) {
      toast.error("Unsupported media type.")
      return null
    }

    if (postFormat === "feed_image" && singleKind !== "image") {
      toast.error("Feed photo requires an image file.")
      return null
    }
    if (postFormat === "feed_video" && singleKind !== "video") {
      toast.error("Feed video requires a video file.")
      return null
    }
    if (postFormat === "reel" && singleKind !== "video") {
      toast.error("Reels require a video file.")
      return null
    }
    if (postFormat === "story" && singleKind !== "image" && singleKind !== "video") {
      toast.error("Story requires an image or video.")
      return null
    }

    const body: Record<string, unknown> = {
      caption,
      mediaType: apiMediaType,
      instagramConnectionId: selectedComposerConnectionId,
    }
    if (scheduledAtIso) {
      body.scheduledAt = scheduledAtIso
    }

    if (postFormat === "carousel") {
      const carouselItems: { url: string; kind: "image" | "video" }[] = []
      for (const file of selectedFiles) {
        const k = inferFileKind(file)
        if (!k) {
          toast.error("Unsupported file in carousel.")
          return null
        }
        let fileToUpload = file
        if (k === "image") {
          try {
            fileToUpload = await ensureJpegForInstagramFeed(file)
          } catch (conversionError) {
            toast.error(
              conversionError instanceof Error ? conversionError.message : "Could not convert image to JPEG."
            )
            return null
          }
        }
        const uploaded = await uploadFileToSupabase(fileToUpload, AUTOPOST_MEDIA_FOLDER)
        if (!uploaded) {
          return null
        }
        carouselItems.push({ url: uploaded.url, kind: k })
      }
      body.carouselItems = carouselItems
    } else {
      let fileToUpload: File = single
      if (singleKind === "image") {
        try {
          fileToUpload = await ensureJpegForInstagramFeed(single)
        } catch (conversionError) {
          toast.error(
            conversionError instanceof Error ? conversionError.message : "Could not convert image to JPEG."
          )
          return null
        }
      }
      const uploaded = await uploadFileToSupabase(fileToUpload, AUTOPOST_MEDIA_FOLDER)
      if (!uploaded) {
        return null
      }
      body.mediaUrl = uploaded.url
      if (postFormat === "story") {
        body.assetKind = singleKind
      }
      if (postFormat === "reel") {
        if (!shareReelToFeed) {
          body.shareToFeed = false
        }
        const cover = reelCoverUrl.trim()
        if (cover) {
          body.coverUrl = cover
        }
      }
    }

    const draftResponse = await fetch("/api/autopost/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const draftData = (await draftResponse.json()) as { error?: string; draft?: { id: string } }

    if (!draftResponse.ok) {
      throw new Error(draftData.error || "Failed to save draft.")
    }

    const jobId = draftData.draft?.id
    if (!jobId) {
      throw new Error("Draft saved but missing job id.")
    }

    return { jobId, mediaType: apiMediaType }
  }

  const handlePublishNow = async () => {
    setIsPostingDraft(true)
    try {
      const result = await uploadAndCreateDraft(null)
      if (!result) {
        return
      }

      const { jobId, mediaType } = result

      if (mediaType === "reel" || mediaType === "feed_video" || mediaType === "carousel") {
        toast.message("Publishing…", {
          description: "Instagram may take a few minutes to process video or multi-slide posts.",
        })
      }

      const publishResponse = await fetch("/api/autopost/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      })

      const publishData = (await publishResponse.json()) as { error?: string }

      if (!publishResponse.ok) {
        throw new Error(publishData.error || "Instagram publishing failed.")
      }

      toast.success("Published to Instagram.")
      resetComposer()
      void fetchJobs()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publish failed")
    } finally {
      setIsPostingDraft(false)
    }
  }

  const handleSchedulePost = async () => {
    if (!Number.isFinite(scheduleDate.getTime())) {
      toast.error("Pick a valid date and time.")
      return
    }
    if (scheduleDate.getTime() <= Date.now() + 2 * 60 * 1000) {
      toast.error("Schedule at least 2 minutes from now.")
      return
    }

    setIsPostingDraft(true)
    try {
      const result = await uploadAndCreateDraft(scheduleDate.toISOString())
      if (!result) {
        return
      }

      toast.success("Post scheduled. It will publish automatically when due.")
      resetComposer()
      void fetchJobs()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Schedule failed")
    } finally {
      setIsPostingDraft(false)
    }
  }

  const handlePublishJobFromList = async (job: AutopostJobRow) => {
    setActionJobId(job.id)
    try {
      if (job.media_type === "reel" || job.media_type === "feed_video" || job.media_type === "carousel") {
        toast.message("Publishing…", {
          description: "Instagram may take a few minutes to process video or multi-slide posts.",
        })
      }
      const body =
        job.status === "queued"
          ? { jobId: job.id, publishNow: true as const }
          : { jobId: job.id }
      const publishResponse = await fetch("/api/autopost/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const publishData = (await publishResponse.json()) as { error?: string }
      if (!publishResponse.ok) {
        throw new Error(publishData.error || "Publishing failed.")
      }
      toast.success("Published to Instagram.")
      void fetchJobs()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publish failed")
    } finally {
      setActionJobId(null)
    }
  }

  const handleCancelJob = async (jobId: string) => {
    setActionJobId(jobId)
    try {
      const response = await fetch(`/api/autopost/jobs/${jobId}`, { method: "DELETE" })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Could not cancel.")
      }
      toast.success("Post cancelled.")
      void fetchJobs()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cancel failed")
    } finally {
      setActionJobId(null)
    }
  }

  const handleRetryFailed = async (jobId: string) => {
    setActionJobId(jobId)
    try {
      const publishResponse = await fetch("/api/autopost/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      })
      const publishData = (await publishResponse.json()) as { error?: string }
      if (!publishResponse.ok) {
        throw new Error(publishData.error || "Retry failed.")
      }
      toast.success("Published to Instagram.")
      void fetchJobs()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Retry failed")
    } finally {
      setActionJobId(null)
    }
  }

  const instagramConnections = status?.instagram?.connections ?? []
  const tiktokConnections = status?.tiktok?.connections ?? []
  const isConnected = instagramConnections.some((connection) => connection.status === "connected")

  const composerReady =
    postFormat === "carousel"
      ? selectedFiles.length >= 2 && selectedFiles.length <= 10
      : selectedFiles.length === 1

  return (
    <div className="min-h-screen bg-background px-4 pb-6 pt-20 md:pt-24">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Autopost</h1>
            <p className="text-sm text-muted-foreground">
              Connect social accounts, publish to Instagram, or schedule posts. All activity appears in your post history.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleConnectInstagram}
            variant="outline"
            className="shrink-0"
          >
            <Link2 className="mr-2 h-4 w-4" />
            Connect Instagram
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="py-4 sm:py-6" data-instagram-connection-card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="h-4 w-4" />
                Instagram
              </CardTitle>
              <CardDescription>
                Publishing and scheduling currently use connected Instagram professional accounts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingStatus ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading connection status...
                </div>
              ) : (
                <div className="space-y-3">
                  <Badge variant={isConnected ? "default" : "outline"}>
                    {isConnected
                      ? `${instagramConnections.length} account${instagramConnections.length === 1 ? "" : "s"} connected`
                      : "Not connected"}
                  </Badge>
                  {isConnected ? (
                    <div className="flex flex-col gap-4">
                      {instagramConnections.map((connection) => {
                        const tokenBanner = socialTokenExpiryBanner("Instagram", connection.tokenExpiresAt)
                        const profile = connection.profile as InstagramSavedProfile | null
                        const instagramConnectionId = connection.instagramConnectionId
                        const label = connection.instagramUsername
                          ? `@${connection.instagramUsername}`
                          : connection.displayName || "Instagram account"
                        return (
                          <div
                            key={connection.id}
                            className="rounded-xl border border-border/80 bg-muted/30 p-4 shadow-sm"
                          >
                            <div className="flex gap-3 sm:gap-4">
                              {profile?.profile_picture_url || connection.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element -- remote Instagram CDN URL from Graph API
                                <img
                                  src={profile?.profile_picture_url ?? connection.avatarUrl ?? ""}
                                  alt=""
                                  className="h-14 w-14 shrink-0 rounded-full border border-border/80 object-cover"
                                  width={56}
                                  height={56}
                                />
                              ) : (
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-border/80 bg-muted">
                                  <UserRound className="h-7 w-7 text-muted-foreground" aria-hidden />
                                </div>
                              )}
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="min-w-0 space-y-0.5">
                                    <p className="font-semibold leading-tight text-foreground">
                                      {profile?.name?.trim() || connection.displayName || label}
                                    </p>
                                    {connection.instagramUsername ? (
                                      <a
                                        href={`https://www.instagram.com/${connection.instagramUsername}/`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-primary underline-offset-4 hover:underline"
                                      >
                                        instagram.com/{connection.instagramUsername}
                                      </a>
                                    ) : null}
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon-sm"
                                      className="shrink-0"
                                      disabled={!instagramConnectionId || refreshingConnectionId === instagramConnectionId}
                                      aria-label={`Refresh profile for ${label}`}
                                      onClick={() => instagramConnectionId ? void handleRefreshProfile(instagramConnectionId) : undefined}
                                    >
                                      <RefreshCw
                                        className={cn(
                                          "h-3.5 w-3.5",
                                          refreshingConnectionId === instagramConnectionId && "animate-spin"
                                        )}
                                        aria-hidden
                                      />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="shrink-0"
                                      disabled={isDisconnecting || !instagramConnectionId}
                                      onClick={() =>
                                        instagramConnectionId
                                          ? setDisconnectTarget({
                                              provider: "instagram",
                                              connectionId: instagramConnectionId,
                                              label,
                                            })
                                          : undefined
                                      }
                                    >
                                      Disconnect
                                    </Button>
                                  </div>
                                </div>
                                {profile?.biography ? (
                                  <p className="line-clamp-3 text-sm text-muted-foreground">{profile.biography}</p>
                                ) : null}
                                {profile &&
                                (profile.followers_count != null ||
                                  profile.follows_count != null ||
                                  profile.media_count != null) ? (
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                    {profile.followers_count != null ? (
                                      <span>
                                        <span className="font-medium text-foreground">
                                          {profile.followers_count.toLocaleString()}
                                        </span>{" "}
                                        followers
                                      </span>
                                    ) : null}
                                    {profile.follows_count != null ? (
                                      <span>
                                        <span className="font-medium text-foreground">
                                          {profile.follows_count.toLocaleString()}
                                        </span>{" "}
                                        following
                                      </span>
                                    ) : null}
                                    {profile.media_count != null ? (
                                      <span>
                                        <span className="font-medium text-foreground">
                                          {profile.media_count.toLocaleString()}
                                        </span>{" "}
                                        posts
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            {tokenBanner ? (
                              <div
                                role="alert"
                                className={cn(
                                  "mt-3 flex gap-2 rounded-lg border px-3 py-2.5 text-sm",
                                  tokenBanner.variant === "expired"
                                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                                    : "border-amber-500/45 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                                )}
                              >
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 opacity-90" aria-hidden />
                                <p className="min-w-0 leading-snug">{tokenBanner.body}</p>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">No account linked</p>
                      <p className="mt-1">Connect Instagram before publishing or scheduling posts.</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter className="gap-2">
              <Button onClick={handleConnectInstagram}>Connect Instagram</Button>
            </CardFooter>
          </Card>

          <Card className="py-4 sm:py-6" data-tiktok-connection-card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Film className="h-4 w-4" />
                TikTok
              </CardTitle>
              <CardDescription>
                TikTok v1 connects accounts only. Uploading and Direct Post stay hidden until the next release.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingStatus ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading connection status...
                </div>
              ) : (
                <div className="space-y-3">
                  <Badge variant={tiktokConnections.some((connection) => connection.status === "connected") ? "default" : "outline"}>
                    {tiktokConnections.length > 0
                      ? `${tiktokConnections.length} account${tiktokConnections.length === 1 ? "" : "s"} connected`
                      : "Not connected"}
                  </Badge>
                  {tiktokConnections.length > 0 ? (
                    <div className="flex flex-col gap-4">
                      {tiktokConnections.map((connection) => {
                        const tokenBanner = socialTokenExpiryBanner("TikTok", connection.tokenExpiresAt)
                        const profile = connection.profile as TikTokSavedProfile | null
                        const label = connection.displayName || profile?.display_name || "TikTok account"
                        return (
                          <div
                            key={connection.id}
                            className="rounded-xl border border-border/80 bg-muted/30 p-4 shadow-sm"
                          >
                            <div className="flex gap-3 sm:gap-4">
                              {connection.avatarUrl || profile?.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element -- remote TikTok avatar URL
                                <img
                                  src={connection.avatarUrl ?? profile?.avatar_url ?? ""}
                                  alt=""
                                  className="h-14 w-14 shrink-0 rounded-full border border-border/80 object-cover"
                                  width={56}
                                  height={56}
                                />
                              ) : (
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-border/80 bg-muted">
                                  <UserRound className="h-7 w-7 text-muted-foreground" aria-hidden />
                                </div>
                              )}
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="min-w-0 space-y-0.5">
                                    <p className="font-semibold leading-tight text-foreground">{label}</p>
                                    {profile?.profile_deep_link ? (
                                      <a
                                        href={profile.profile_deep_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-primary underline-offset-4 hover:underline"
                                      >
                                        Open TikTok profile
                                      </a>
                                    ) : (
                                      <p className="font-mono text-xs text-muted-foreground">
                                        {connection.providerAccountId.slice(0, 12)}...
                                      </p>
                                    )}
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0"
                                    disabled={isDisconnecting}
                                    onClick={() =>
                                      setDisconnectTarget({
                                        provider: "tiktok",
                                        connectionId: connection.id,
                                        label,
                                      })
                                    }
                                  >
                                    Disconnect
                                  </Button>
                                </div>
                                {profile?.bio_description ? (
                                  <p className="line-clamp-3 text-sm text-muted-foreground">{profile.bio_description}</p>
                                ) : null}
                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                  <Badge variant="outline">Profile only</Badge>
                                  {connection.status !== "connected" ? (
                                    <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
                                      {connection.status}
                                    </Badge>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            {tokenBanner ? (
                              <div
                                role="alert"
                                className={cn(
                                  "mt-3 flex gap-2 rounded-lg border px-3 py-2.5 text-sm",
                                  tokenBanner.variant === "expired"
                                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                                    : "border-amber-500/45 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                                )}
                              >
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 opacity-90" aria-hidden />
                                <p className="min-w-0 leading-snug">{tokenBanner.body}</p>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">No TikTok account linked</p>
                      <p className="mt-1">Connect TikTok to prepare for upcoming upload and posting support.</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter className="gap-2">
              <Button onClick={handleConnectTikTok}>Connect TikTok</Button>
            </CardFooter>
          </Card>
        </div>

        <div
          className="grid gap-6 lg:grid-cols-2 lg:items-start"
          style={
            composerCardHeight
              ? ({ "--composer-card-height": `${composerCardHeight}px` } as React.CSSProperties)
              : undefined
          }
        >
          <Card ref={composerCardRef} className="py-4 sm:py-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Draft Composer
              </CardTitle>
              <CardDescription>
                Choose a post type, then upload media. Images are converted to JPEG where required. Carousels are
                multi-slide feed posts (not Reels).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="autopost-post-type">Post type</Label>
                <Select
                  value={postFormat}
                  onValueChange={(v) => setPostFormat(v as PostFormat)}
                  disabled={!isConnected || instagramConnections.length === 0}
                >
                  <SelectTrigger id="autopost-post-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-120">
                    <SelectItem value="feed_image">Feed photo</SelectItem>
                    <SelectItem value="feed_video">Feed video</SelectItem>
                    <SelectItem value="reel">Reel</SelectItem>
                    <SelectItem value="carousel">Carousel (feed)</SelectItem>
                    <SelectItem value="story">Story</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Reels are single videos. Carousel = up to 10 slides on the feed. Stories expire after 24h.
                </p>
              </div>

              {postFormat === "reel" ? (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="autopost-reel-feed"
                    checked={shareReelToFeed}
                    onCheckedChange={(c) => setShareReelToFeed(c === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="autopost-reel-feed" className="cursor-pointer font-normal leading-snug">
                      Also show this reel on the main feed
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      When off, Meta may still surface the reel in Reels only (per Instagram rules).
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="autopost-account">Instagram account</Label>
                <Select
                  value={selectedComposerConnectionId ?? undefined}
                  onValueChange={(value) => {
                    setSelectedComposerConnectionId(value)
                    if (typeof window !== "undefined") {
                      localStorage.setItem(AUTOPOST_COMPOSER_ACCOUNT_KEY, value)
                    }
                  }}
                  disabled={!isConnected || instagramConnections.length === 0}
                >
                  <SelectTrigger id="autopost-account" className="w-full">
                    <SelectValue placeholder={isConnected ? "Select account" : "Connect Instagram first"} />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-120">
                    {instagramConnections.filter((c) => c.instagramConnectionId).map((c) => (
                      <SelectItem key={c.id} value={c.instagramConnectionId as string}>
                        {c.instagramUsername ? `@${c.instagramUsername}` : c.instagramUserId ?? "Account"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  New posts and drafts are saved for the account you pick here.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="autopost-media">Media</Label>
                <Input
                  key={postFormat}
                  id="autopost-media"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple={postFormat === "carousel"}
                  className="cursor-pointer"
                  onChange={handleMediaFileChange}
                />
                <p className="text-xs text-muted-foreground">
                  {postFormat === "carousel"
                    ? "Select 2–10 images and/or videos. Order is preserved."
                    : "One image or one video depending on post type."}{" "}
                  PNG/WebP/GIF are converted to JPEG where needed (
                  <span className="text-foreground/80">max 10 MB</span> upload).
                </p>
              </div>

              {postFormat === "reel" ? (
                <div className="space-y-2">
                  <Label htmlFor="autopost-reel-cover">Cover image URL (optional)</Label>
                  <Input
                    id="autopost-reel-cover"
                    value={reelCoverUrl}
                    onChange={(e) => setReelCoverUrl(e.target.value)}
                    placeholder="https://… (JPEG, public HTTPS)"
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use a public JPEG URL from your uploads (same storage as media).
                  </p>
                </div>
              ) : null}

              {previewUrls.length > 0 && postFormat === "carousel" ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {previewUrls.map((url, i) => {
                    const file = selectedFiles[i]
                    const kind = file ? inferFileKind(file) : null
                    return (
                      <div
                        key={`${url}-${i}`}
                        className="relative aspect-square overflow-hidden rounded-md border bg-muted/30"
                      >
                        {kind === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt="" className="h-full w-full object-cover" src={url} />
                        ) : kind === "video" ? (
                          <video className="h-full w-full object-cover" src={url} muted playsInline />
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : null}

              {previewUrls.length === 1 && selectedFiles[0]?.type.startsWith("image/") && postFormat !== "carousel" ? (
                <div className="overflow-hidden rounded-md border bg-muted/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Selected media preview"
                    className="max-h-48 w-full object-contain"
                    src={previewUrls[0]}
                  />
                </div>
              ) : null}

              {selectedFiles.length === 1 && selectedFiles[0] && !selectedFiles[0].type.startsWith("image/") ? (
                <p className="text-sm text-muted-foreground">
                  Selected: <span className="text-foreground">{selectedFiles[0].name}</span>
                </p>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="autopost-caption">Caption</Label>
                <Textarea
                  id="autopost-caption"
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  placeholder="Write your caption..."
                  rows={5}
                  disabled={postFormat === "story"}
                />
                {postFormat === "story" ? (
                  <p className="text-xs text-muted-foreground">
                    Story captions are not supported by the Instagram publishing API; compose text in-app if needed.
                  </p>
                ) : null}
              </div>

              <Tabs value={composerTab} onValueChange={(v) => setComposerTab(v as "now" | "schedule")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="now" className="gap-1.5">
                    <Zap className="h-3.5 w-3.5" />
                    Publish now
                  </TabsTrigger>
                  <TabsTrigger value="schedule" className="gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Schedule
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="now" className="mt-4 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Uploads your media, then publishes to Instagram immediately.
                  </p>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => void handlePublishNow()}
                    disabled={!composerReady || isPostingDraft || !isConnected || !selectedComposerConnectionId}
                  >
                    {isPostingDraft && composerTab === "now" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Publishing…
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Publish to Instagram
                      </>
                    )}
                  </Button>
                </TabsContent>
                <TabsContent value="schedule" className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <Label id="autopost-schedule-label">When to post</Label>
                    <Popover open={schedulePickerOpen} onOpenChange={setSchedulePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 w-full justify-start font-normal"
                          id="autopost-schedule-picker"
                          aria-labelledby="autopost-schedule-label"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                          <span className="truncate">{format(scheduleDate, "EEE, MMM d, yyyy 'at' h:mm a")}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <div className="flex flex-col gap-0 sm:flex-row">
                          <Calendar
                            mode="single"
                            selected={scheduleDate}
                            onSelect={(d) => {
                              if (!d) {
                                return
                              }
                              setScheduleDate((prev) => {
                                const next = new Date(d)
                                next.setHours(prev.getHours(), prev.getMinutes(), 0, 0)
                                return next
                              })
                            }}
                            disabled={(date) => isBefore(startOfDay(date), startOfToday())}
                            defaultMonth={scheduleDate}
                          />
                          <div className="flex flex-col gap-2 border-t p-3 sm:w-[200px] sm:border-t-0 sm:border-l">
                            <p className="text-xs font-medium text-muted-foreground">Time</p>
                            <div className="flex items-center gap-2">
                              <Select
                                value={String(scheduleDate.getHours())}
                                onValueChange={(v) => {
                                  const h = Number(v)
                                  setScheduleDate((prev) => {
                                    const next = new Date(prev)
                                    next.setHours(h, prev.getMinutes(), 0, 0)
                                    return next
                                  })
                                }}
                              >
                                <SelectTrigger size="sm" className="w-[72px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent position="popper" className="z-120 max-h-48">
                                  {SCHEDULE_HOURS.map((h) => (
                                    <SelectItem key={h} value={String(h)}>
                                      {pad2(h)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <span className="text-muted-foreground">:</span>
                              <Select
                                value={String(scheduleDate.getMinutes())}
                                onValueChange={(v) => {
                                  const m = Number(v)
                                  setScheduleDate((prev) => {
                                    const next = new Date(prev)
                                    next.setHours(prev.getHours(), m, 0, 0)
                                    return next
                                  })
                                }}
                              >
                                <SelectTrigger size="sm" className="w-[72px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent position="popper" className="z-120 max-h-48">
                                  {SCHEDULE_MINUTES.map((m) => (
                                    <SelectItem key={m} value={String(m)}>
                                      {pad2(m)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="mt-1 w-full"
                              onClick={() => setSchedulePickerOpen(false)}
                            >
                              Done
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground">
                      Uses your local timezone. The post is picked up within about a minute after this time.
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="w-full"
                    variant="secondary"
                    onClick={() => void handleSchedulePost()}
                    disabled={!composerReady || isPostingDraft || !isConnected || !selectedComposerConnectionId}
                  >
                    {isPostingDraft && composerTab === "schedule" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Scheduling…
                      </>
                    ) : (
                      <>
                        <CalendarClock className="mr-2 h-4 w-4" />
                        Schedule post
                      </>
                    )}
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="flex max-h-[min(720px,85vh)] flex-col py-4 sm:py-6 lg:h-(--composer-card-height) lg:max-h-none">
            <CardHeader className="shrink-0">
              <CardTitle className="flex items-center gap-2">
                <LayoutList className="h-4 w-4" />
                Your posts
              </CardTitle>
              <CardDescription>
                Drafts through failed attempts. The account badge on each row is where that post will go (or went).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col px-2 sm:px-6">
              {isLoadingJobs ? (
                <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading posts…
                </div>
              ) : jobs.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No posts yet. Create one from the composer.
                </p>
              ) : (
                <ScrollArea className="h-[min(560px,calc(85vh-12rem))] pr-3 lg:h-full lg:min-h-0 lg:flex-1">
                  <ul className="flex flex-col gap-3">
                    {jobs.map((job) => {
                      const busy = actionJobId === job.id
                      const thumbIsVideo = jobListThumbnailIsVideo(job)
                      const carouselCount = job.media_type === "carousel" ? job.metadata?.carouselItems?.length : undefined
                      const scheduleNote = scheduledVsPublishedNote(job)
                      return (
                        <li
                          key={job.id}
                          className="rounded-xl border border-border/80 bg-muted/20 p-3 shadow-sm"
                        >
                          <div className="flex gap-3">
                            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-background">
                              {!thumbIsVideo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  alt=""
                                  className="h-full w-full object-cover"
                                  src={job.media_url}
                                />
                              ) : (
                                <video
                                  className="h-full w-full object-cover"
                                  src={job.media_url}
                                  muted
                                  playsInline
                                  preload="metadata"
                                />
                              )}
                              <span className="absolute bottom-1 right-1 rounded bg-background/90 px-1 py-0.5 text-[10px] text-muted-foreground">
                                {job.media_type === "carousel" ? (
                                  <Layers className="inline h-3 w-3" />
                                ) : job.media_type === "reel" || job.media_type === "feed_video" ? (
                                  <Film className="inline h-3 w-3" />
                                ) : job.media_type === "story" ? (
                                  <Sparkles className="inline h-3 w-3" />
                                ) : (
                                  <ImageIcon className="inline h-3 w-3" />
                                )}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  variant="secondary"
                                  className="max-w-full truncate px-2.5 py-1 text-sm font-semibold tracking-tight"
                                  title={jobAccountLabel(job)}
                                >
                                  {jobAccountLabel(job)}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {mediaTypeLabel(job.media_type)}
                                {carouselCount != null && carouselCount > 0
                                  ? ` · ${carouselCount} slides`
                                  : ""}
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={cn("text-xs font-medium", statusBadgeClass(job.status))}
                                >
                                  {statusLabel(job.status)}
                                </Badge>
                                <span className="text-[11px] text-muted-foreground">
                                  {postStatusTimeLine(job)}
                                </span>
                              </div>
                              {scheduleNote ? (
                                <p className="text-xs text-muted-foreground">{scheduleNote}</p>
                              ) : null}
                              {job.caption ? (
                                <p className="line-clamp-2 text-sm text-foreground">{job.caption}</p>
                              ) : (
                                <p className="text-xs italic text-muted-foreground">No caption</p>
                              )}
                              {job.status === "failed" && job.last_error ? (
                                <p className="line-clamp-2 text-xs text-destructive">{job.last_error}</p>
                              ) : null}
                              {job.status === "published" && job.provider_publish_id ? (
                                <p className="text-[11px] text-muted-foreground">
                                  Media ID: <span className="font-mono">{job.provider_publish_id}</span>
                                </p>
                              ) : null}
                              <div className="flex flex-wrap gap-2 pt-1">
                                {job.status === "queued" ? (
                                  <>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="default"
                                      disabled={busy || !isConnected}
                                      onClick={() => void handlePublishJobFromList(job)}
                                    >
                                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                      Publish now
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      disabled={busy}
                                      onClick={() => void handleCancelJob(job.id)}
                                    >
                                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                                      Cancel
                                    </Button>
                                  </>
                                ) : null}
                                {job.status === "draft" ? (
                                  <>
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={busy || !isConnected}
                                      onClick={() => void handlePublishJobFromList(job)}
                                    >
                                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                      Publish
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      disabled={busy}
                                      onClick={() => void handleCancelJob(job.id)}
                                    >
                                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                                      Discard
                                    </Button>
                                  </>
                                ) : null}
                                {job.status === "failed" ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    disabled={busy || !isConnected}
                                    onClick={() => void handleRetryFailed(job.id)}
                                  >
                                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                    Retry
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog
        open={disconnectTarget !== null}
        onOpenChange={(open) => {
          if (!open && isDisconnecting) {
            return
          }
          if (!open) {
            setDisconnectTarget(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Disconnect {disconnectTarget?.provider === "tiktok" ? "TikTok" : "Instagram"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the link to{" "}
              <span className="font-medium text-foreground">
                {disconnectTarget?.label ?? "this account"}
              </span>
              . You can connect it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisconnecting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleDisconnect()
              }}
              disabled={isDisconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDisconnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disconnecting…
                </>
              ) : (
                "Disconnect"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
