"use client"

import * as React from "react"
import { setHours, setMinutes, startOfDay, startOfMonth } from "date-fns"
import { CalendarIcon, LayoutList, Loader2, Plus } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

import type { AutopostJobRow } from "@/components/autopost/autopost-page"
import { AutopostPostsCalendar, getJobCalendarAnchor } from "@/components/autopost/autopost-posts-calendar"
import { AccountPickerStep } from "@/components/content/composer/account-picker-step"
import { FanvueComposerStep } from "@/components/content/composer/fanvue-composer-step"
import type { ContentJobRow, FanvueConnectionItem } from "@/components/content/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type ScheduleTabProps = {
  connections: FanvueConnectionItem[]
  selectedConnectionId: string | null
  onGoToMediaTab: () => void
}

type ComposerState = {
  step: "account" | "compose"
  connection: FanvueConnectionItem | null
  scheduleDate: Date
  defaultComposerTab: "now" | "schedule"
  preselectedMediaUuid: string | null
}

function inferMediaKind(url: string): "image" | "video" {
  return /\.(mp4|mov|webm|m4v)$/i.test(url) ? "video" : "image"
}

function buildComposerScheduleDate(day: Date): Date {
  const base = new Date()
  const scheduled = setMinutes(setHours(startOfDay(day), base.getHours()), base.getMinutes())
  if (scheduled.getTime() <= Date.now()) {
    return new Date(Date.now() + 60 * 60 * 1000)
  }
  return scheduled
}

export function ScheduleTab({ connections, selectedConnectionId, onGoToMediaTab }: ScheduleTabProps) {
  const searchParams = useSearchParams()
  const hasHandledComposeParams = React.useRef(false)
  const [jobs, setJobs] = React.useState<ContentJobRow[]>([])
  const [isLoadingJobs, setIsLoadingJobs] = React.useState(true)
  const [postsViewMode, setPostsViewMode] = React.useState<"calendar" | "list">("calendar")
  const [calendarMonth, setCalendarMonth] = React.useState(() => startOfMonth(new Date()))
  const [composerOpen, setComposerOpen] = React.useState(false)
  const [composerState, setComposerState] = React.useState<ComposerState>({
    step: "account",
    connection: null,
    scheduleDate: buildComposerScheduleDate(new Date()),
    defaultComposerTab: "now",
    preselectedMediaUuid: null,
  })
  const [actionJobId, setActionJobId] = React.useState<string | null>(null)

  const fetchJobs = React.useCallback(async () => {
    setIsLoadingJobs(true)
    try {
      const response = await fetch("/api/autopost/jobs", { cache: "no-store" })
      const data = (await response.json()) as { jobs?: ContentJobRow[]; error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to load posts.")
      }
      const fanvueJobs = (data.jobs ?? []).filter((job) => (job.provider ?? "instagram") === "fanvue")
      setJobs(fanvueJobs)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load posts.")
      setJobs([])
    } finally {
      setIsLoadingJobs(false)
    }
  }, [])

  const openComposer = React.useCallback(
    (options?: {
      day?: Date
      defaultComposerTab?: "now" | "schedule"
      preselectedMediaUuid?: string | null
      connection?: FanvueConnectionItem | null
    }) => {
      const scheduleDate = options?.day ? buildComposerScheduleDate(options.day) : buildComposerScheduleDate(new Date())
      const preferredConnection =
        options?.connection ??
        connections.find((connection) => connection.id === selectedConnectionId) ??
        connections[0] ??
        null

      if (preferredConnection) {
        setComposerState({
          step: "compose",
          connection: preferredConnection,
          scheduleDate,
          defaultComposerTab: options?.defaultComposerTab ?? (options?.day ? "schedule" : "now"),
          preselectedMediaUuid: options?.preselectedMediaUuid ?? null,
        })
        setComposerOpen(true)
        return
      }

      setComposerState({
        step: "account",
        connection: null,
        scheduleDate,
        defaultComposerTab: options?.defaultComposerTab ?? (options?.day ? "schedule" : "now"),
        preselectedMediaUuid: options?.preselectedMediaUuid ?? null,
      })
      setComposerOpen(true)
    },
    [connections, selectedConnectionId]
  )

  React.useEffect(() => {
    void fetchJobs()
  }, [fetchJobs])

  React.useEffect(() => {
    if (hasHandledComposeParams.current) return
    if (searchParams.get("compose") !== "1") return
    if (connections.length === 0) return

    hasHandledComposeParams.current = true
    const mediaUuid = searchParams.get("mediaUuid")
    openComposer({
      preselectedMediaUuid: mediaUuid,
      defaultComposerTab: mediaUuid ? "now" : "schedule",
    })

    const nextUrl = new URL(window.location.href)
    nextUrl.searchParams.delete("compose")
    nextUrl.searchParams.delete("mediaUuid")
    const search = nextUrl.searchParams.toString()
    window.history.replaceState({}, "", search ? `${nextUrl.pathname}?${search}` : nextUrl.pathname)
  }, [connections, openComposer, searchParams])

  const handlePublishJob = async (jobId: string) => {
    setActionJobId(jobId)
    try {
      const response = await fetch("/api/autopost/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, publishNow: true }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Publish failed.")
      }
      toast.success("Post published.")
      await fetchJobs()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publish failed.")
    } finally {
      setActionJobId(null)
    }
  }

  const calendarJobs = jobs as unknown as AutopostJobRow[]

  const renderJobList = () => (
    <ScrollArea className="h-[min(640px,calc(100vh-16rem))] pr-3">
      <ul className="flex flex-col gap-3">
        {jobs.map((job) => (
          <li
            key={job.id}
            className="rounded-2xl border border-border/80 bg-muted/15 p-3 shadow-sm transition-colors hover:border-border md:p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{job.status}</Badge>
                  {job.metadata?.fanvue?.priceCents ? (
                    <Badge variant="outline">${(job.metadata.fanvue.priceCents / 100).toFixed(2)} PPV</Badge>
                  ) : null}
                </div>
                <p className="truncate text-sm font-medium text-foreground">
                  {job.caption?.trim() || "Untitled Fanvue post"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {getJobCalendarAnchor(job as unknown as AutopostJobRow)?.toLocaleString() ?? job.created_at}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(job.status === "draft" || job.status === "queued" || job.status === "failed") && (
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-full"
                    disabled={actionJobId === job.id}
                    onClick={() => void handlePublishJob(job.id)}
                  >
                    {job.status === "failed" ? "Retry" : "Publish"}
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </ScrollArea>
  )

  return (
    <div className="space-y-4">
      <Card className="rounded-[30px] border-border/70 bg-muted/10 py-4 sm:py-5">
        <CardHeader className="shrink-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Scheduled posts
              </CardTitle>
              <CardDescription>
                Drafts, scheduled posts, and published Fanvue content. Click a day to schedule a new post.
              </CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
              {jobs.length > 0 ? (
                <ToggleGroup
                  type="single"
                  value={postsViewMode}
                  onValueChange={(value) => {
                    if (value === "list" || value === "calendar") {
                      setPostsViewMode(value)
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full justify-stretch sm:w-auto"
                  aria-label="Posts view"
                >
                  <ToggleGroupItem
                    value="calendar"
                    aria-label="Calendar view"
                    className="flex-1 gap-1.5 px-3 sm:flex-initial"
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    Calendar
                  </ToggleGroupItem>
                  <ToggleGroupItem value="list" aria-label="List view" className="flex-1 gap-1.5 px-3 sm:flex-initial">
                    <LayoutList className="h-3.5 w-3.5" />
                    List
                  </ToggleGroupItem>
                </ToggleGroup>
              ) : null}
              <Button
                type="button"
                className="rounded-full"
                onClick={() => openComposer()}
                disabled={connections.length === 0}
              >
                <Plus className="mr-2 h-4 w-4" />
                Post
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col px-2 sm:px-6">
          {isLoadingJobs ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading posts...
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">No Fanvue posts yet.</p>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => openComposer()}
                disabled={connections.length === 0}
              >
                Create your first post
              </Button>
            </div>
          ) : postsViewMode === "calendar" ? (
            <div className="min-h-0 flex-1 overflow-auto pr-1">
              <AutopostPostsCalendar
                jobs={calendarJobs}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                onDayClick={(day) => openComposer({ day, defaultComposerTab: "schedule" })}
                onPostClick={() => undefined}
                getJobMediaPreview={(job) => {
                  const url = job.media_url
                  if (!url || url.startsWith("fanvue://")) return null
                  return { url, kind: inferMediaKind(url) }
                }}
              />
            </div>
          ) : (
            renderJobList()
          )}
        </CardContent>
      </Card>

      {composerOpen ? (
        <div className="fixed inset-0 z-50 bg-background/80 p-4 backdrop-blur-sm" onClick={() => setComposerOpen(false)}>
          <div className="mx-auto flex h-full w-full max-w-3xl items-center justify-center">
            <Card
              className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden rounded-[28px]"
              onClick={(event) => event.stopPropagation()}
            >
              <CardHeader className="shrink-0 space-y-1.5 px-8 pt-8 pb-4">
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  {composerState.step === "account" ? "Choose account" : "Create Fanvue post"}
                </CardTitle>
                <CardDescription className="text-base">
                  {composerState.step === "account"
                    ? "Select which Fanvue account this post should go to."
                    : "Add media, write a caption, and publish or schedule."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden px-8 pb-8 pt-2">
                {composerState.step === "account" ? (
                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    <AccountPickerStep
                      connections={connections}
                      onConnect={() => {
                        window.location.href = "/api/fanvue/connect?next=/content"
                      }}
                      onSelect={(connection) => {
                        setComposerState((current) => ({
                          ...current,
                          step: "compose",
                          connection,
                        }))
                      }}
                    />
                  </div>
                ) : composerState.connection ? (
                  <FanvueComposerStep
                    connection={composerState.connection}
                    connections={connections}
                    onConnectionChange={(nextConnection) =>
                      setComposerState((current) => ({
                        ...current,
                        connection: nextConnection,
                      }))
                    }
                    initialScheduleDate={composerState.scheduleDate}
                    defaultComposerTab={composerState.defaultComposerTab}
                    preselectedMediaUuid={composerState.preselectedMediaUuid}
                    onGoToMediaTab={() => {
                      setComposerOpen(false)
                      onGoToMediaTab()
                    }}
                    onSuccess={() => {
                      setComposerOpen(false)
                      void fetchJobs()
                    }}
                  />
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  )
}
