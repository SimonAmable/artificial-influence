"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import {
  Calendar as CalendarIcon,
  CalendarClock,
  Film,
  ImageIcon,
  LayoutList,
  Link2,
  Loader2,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  Zap,
} from "lucide-react"
import { format, isBefore, startOfDay, startOfToday } from "date-fns"
import { toast } from "sonner"

import { ensureJpegForInstagramFeed } from "@/lib/autopost/convert-image-for-instagram"
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
import { cn } from "@/lib/utils"

const AUTOPOST_MEDIA_FOLDER = "autopost-drafts"

function inferDraftMediaType(file: File): "image" | "reel" | null {
  if (file.type.startsWith("image/")) {
    return "image"
  }
  if (file.type.startsWith("video/")) {
    return "reel"
  }
  return null
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
  status: string
  scheduled_at: string | null
  published_at: string | null
  created_at: string
  updated_at: string
  last_error: string | null
  provider_publish_id: string | null
  provider_container_id: string | null
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

type InstagramConnectionStatus = {
  connected: boolean
  connection?: {
    instagramUsername: string | null
    instagramUserId: string | null
    accountType: string | null
    provider: string | null
    tokenExpiresAt: string | null
    updatedAt: string
  }
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
  const [status, setStatus] = React.useState<InstagramConnectionStatus | null>(null)
  const [isLoadingStatus, setIsLoadingStatus] = React.useState(true)
  const [isDisconnecting, setIsDisconnecting] = React.useState(false)
  const [caption, setCaption] = React.useState("")
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [composerTab, setComposerTab] = React.useState<"now" | "schedule">("now")
  const [scheduleDate, setScheduleDate] = React.useState(defaultScheduleDate)
  const [schedulePickerOpen, setSchedulePickerOpen] = React.useState(false)

  const [jobs, setJobs] = React.useState<AutopostJobRow[]>([])
  const [isLoadingJobs, setIsLoadingJobs] = React.useState(true)
  const [isPostingDraft, setIsPostingDraft] = React.useState(false)
  const [actionJobId, setActionJobId] = React.useState<string | null>(null)

  const [disconnectDialogOpen, setDisconnectDialogOpen] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const searchParams = useSearchParams()
  const hasHandledAuthParams = React.useRef(false)

  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const fetchStatus = React.useCallback(async () => {
    setIsLoadingStatus(true)
    try {
      const response = await fetch("/api/instagram/status", { cache: "no-store" })
      const data = (await response.json()) as InstagramConnectionStatus | { error?: string }

      if (!response.ok) {
        throw new Error("error" in data && data.error ? data.error : "Failed to load Instagram connection status.")
      }

      setStatus(data as InstagramConnectionStatus)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load Instagram status")
      setStatus({ connected: false })
    } finally {
      setIsLoadingStatus(false)
    }
  }, [])

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
    void fetchStatus()
    void fetchJobs()
  }, [fetchStatus, fetchJobs])

  React.useEffect(() => {
    if (hasHandledAuthParams.current) {
      return
    }

    const error = searchParams.get("error")
    const connected = searchParams.get("connected")

    if (!error && !connected) {
      return
    }

    hasHandledAuthParams.current = true

    if (error) {
      toast.error(error)
    } else if (connected === "1") {
      toast.success("Instagram account connected.")
      void fetchStatus()
    }

    const nextUrl = new URL(window.location.href)
    nextUrl.searchParams.delete("error")
    nextUrl.searchParams.delete("connected")
    const search = nextUrl.searchParams.toString()
    window.history.replaceState({}, "", search ? `${nextUrl.pathname}?${search}` : nextUrl.pathname)
  }, [fetchStatus, searchParams])

  const handleConnect = () => {
    window.location.href = "/api/instagram/connect"
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      const response = await fetch("/api/instagram/disconnect", { method: "POST" })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to disconnect Instagram account.")
      }
      toast.success("Instagram account disconnected.")
      setDisconnectDialogOpen(false)
      await fetchStatus()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disconnect Instagram account")
    } finally {
      setIsDisconnecting(false)
    }
  }

  const handleMediaFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (!file) {
      setSelectedFile(null)
      setPreviewUrl((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous)
        }
        return null
      })
      return
    }

    if (!inferDraftMediaType(file)) {
      toast.error("Use an image (JPEG, PNG, WebP, GIF) or a video (MP4, MOV).")
      event.target.value = ""
      return
    }

    setPreviewUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous)
      }
      return URL.createObjectURL(file)
    })
    setSelectedFile(file)
  }

  const resetComposer = () => {
    setCaption("")
    setSelectedFile(null)
    setPreviewUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous)
      }
      return null
    })
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    setScheduleDate(defaultScheduleDate())
  }

  const uploadAndCreateDraft = async (scheduledAtIso: string | null) => {
    if (!selectedFile) {
      toast.error("Choose a media file first.")
      return null
    }

    if (!status?.connected) {
      toast.error("Connect Instagram before publishing.")
      return null
    }

    const mediaType = inferDraftMediaType(selectedFile)
    if (!mediaType) {
      toast.error("Unsupported media type.")
      return null
    }

    let fileToUpload: File = selectedFile
    if (mediaType === "image") {
      try {
        fileToUpload = await ensureJpegForInstagramFeed(selectedFile)
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

    const body: Record<string, unknown> = {
      mediaUrl: uploaded.url,
      caption,
      mediaType,
    }
    if (scheduledAtIso) {
      body.scheduledAt = scheduledAtIso
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

    return { jobId, mediaType }
  }

  const handlePublishNow = async () => {
    setIsPostingDraft(true)
    try {
      const result = await uploadAndCreateDraft(null)
      if (!result) {
        return
      }

      const { jobId, mediaType } = result

      if (mediaType === "reel") {
        toast.message("Publishing reel…", {
          description: "Instagram may take up to a few minutes to process the video.",
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
      if (job.media_type === "reel") {
        toast.message("Publishing reel…", {
          description: "Instagram may take up to a few minutes to process the video.",
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

  const connection = status?.connection
  const isConnected = Boolean(status?.connected)

  return (
    <div className="min-h-screen bg-background px-4 pb-6 pt-20 md:pt-24">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Autopost</h1>
          <p className="text-sm text-muted-foreground">
            Connect Instagram, publish immediately, or schedule posts. All activity appears in your post history.
          </p>
        </div>

        <Card className="py-4 sm:py-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Instagram Connection
            </CardTitle>
            <CardDescription>
              Connect with Instagram Login. Publishing uses the Content Publishing API on graph.instagram.com.
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
                  {isConnected ? "Connected" : "Not connected"}
                </Badge>
                {isConnected ? (
                  <div className="rounded-xl border border-border/80 bg-muted/30 p-4 shadow-sm">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                      <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden />
                      <span>Linked Instagram account</span>
                      <Badge variant="secondary" className="ml-auto text-xs font-normal">
                        Active
                      </Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2.5">
                        <p className="text-xs font-medium text-muted-foreground">Username</p>
                        <p className="mt-0.5 text-sm text-foreground">{connection?.instagramUsername || "Unknown"}</p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2.5">
                        <p className="text-xs font-medium text-muted-foreground">Instagram ID</p>
                        <p className="mt-0.5 break-all text-sm text-foreground">
                          {connection?.instagramUserId || "Unknown"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2.5">
                        <p className="text-xs font-medium text-muted-foreground">Account type</p>
                        <p className="mt-0.5 text-sm text-foreground">{connection?.accountType || "Unknown"}</p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2.5">
                        <p className="text-xs font-medium text-muted-foreground">Token expires</p>
                        <p className="mt-0.5 text-sm text-foreground">
                          {connection?.tokenExpiresAt
                            ? new Date(connection.tokenExpiresAt).toLocaleString()
                            : "Not provided"}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">No account linked</p>
                    <p className="mt-1">Connect an Instagram professional account to continue.</p>
                    <p className="mt-2 text-xs">
                      Business and Creator accounts are supported. A Facebook Page link is not required.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="gap-2">
            <Button onClick={handleConnect}>Connect Instagram</Button>
            <Button
              variant="outline"
              onClick={() => setDisconnectDialogOpen(true)}
              disabled={!isConnected || isDisconnecting}
            >
              Disconnect
            </Button>
          </CardFooter>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="py-4 sm:py-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Draft Composer
              </CardTitle>
              <CardDescription>
                Images are converted to JPEG before upload for Instagram feed rules. Use MP4/MOV for reels.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="autopost-media">Media</Label>
                <Input
                  id="autopost-media"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="cursor-pointer"
                  onChange={handleMediaFileChange}
                />
                <p className="text-xs text-muted-foreground">
                  PNG/WebP/GIF are converted to JPEG (transparent areas become white). Public URL for Instagram (
                  <span className="text-foreground/80">max 10 MB</span> upload).
                </p>
              </div>

              {previewUrl && selectedFile?.type.startsWith("image/") ? (
                <div className="overflow-hidden rounded-md border bg-muted/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Selected media preview"
                    className="max-h-48 w-full object-contain"
                    src={previewUrl}
                  />
                </div>
              ) : null}

              {selectedFile && !selectedFile.type.startsWith("image/") ? (
                <p className="text-sm text-muted-foreground">
                  Selected: <span className="text-foreground">{selectedFile.name}</span>
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
                />
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
                    disabled={!selectedFile || isPostingDraft || !isConnected}
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
                    disabled={!selectedFile || isPostingDraft || !isConnected}
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

          <Card className="flex max-h-[min(720px,85vh)] flex-col py-4 sm:py-6">
            <CardHeader className="shrink-0">
              <CardTitle className="flex items-center gap-2">
                <LayoutList className="h-4 w-4" />
                Your posts
              </CardTitle>
              <CardDescription>
                Drafts, scheduled, publishing, published, and failed attempts for your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 px-2 sm:px-6">
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
                <ScrollArea className="h-[min(560px,calc(85vh-12rem))] pr-3">
                  <ul className="flex flex-col gap-3">
                    {jobs.map((job) => {
                      const busy = actionJobId === job.id
                      const isImage = job.media_type === "image"
                      const scheduleNote = scheduledVsPublishedNote(job)
                      return (
                        <li
                          key={job.id}
                          className="rounded-xl border border-border/80 bg-muted/20 p-3 shadow-sm"
                        >
                          <div className="flex gap-3">
                            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-background">
                              {isImage ? (
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
                                {job.media_type === "reel" ? (
                                  <Film className="inline h-3 w-3" />
                                ) : (
                                  <ImageIcon className="inline h-3 w-3" />
                                )}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
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
        open={disconnectDialogOpen}
        onOpenChange={(open) => {
          if (!open && isDisconnecting) {
            return
          }
          setDisconnectDialogOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Instagram?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the link to{" "}
              {connection?.instagramUsername ? (
                <span className="font-medium text-foreground">@{connection.instagramUsername}</span>
              ) : (
                "your Instagram account"
              )}
              . You will need to connect again before publishing.
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
