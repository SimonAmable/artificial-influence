"use client"

import * as React from "react"
import { startOfMonth } from "date-fns"
import { Loader2, Plus } from "lucide-react"
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

type ScheduleTabProps = {
  connections: FanvueConnectionItem[]
  selectedConnectionId: string | null
  onGoToMediaTab: () => void
}

function inferMediaKind(url: string): "image" | "video" {
  return /\.(mp4|mov|webm|m4v)$/i.test(url) ? "video" : "image"
}

export function ScheduleTab({ connections, selectedConnectionId, onGoToMediaTab }: ScheduleTabProps) {
  const [jobs, setJobs] = React.useState<ContentJobRow[]>([])
  const [isLoadingJobs, setIsLoadingJobs] = React.useState(true)
  const [calendarMonth, setCalendarMonth] = React.useState(() => startOfMonth(new Date()))
  const [composerOpen, setComposerOpen] = React.useState(false)
  const [composerStep, setComposerStep] = React.useState<"account" | "compose">("account")
  const [composerConnection, setComposerConnection] = React.useState<FanvueConnectionItem | null>(null)
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

  React.useEffect(() => {
    void fetchJobs()
  }, [fetchJobs])

  const openComposer = () => {
    setComposerStep("account")
    setComposerConnection(null)
    setComposerOpen(true)
  }

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Scheduled posts</h3>
          <p className="text-sm text-muted-foreground">Drafts, scheduled posts, and published Fanvue content.</p>
        </div>
        <Button type="button" className="rounded-full" onClick={openComposer} disabled={connections.length === 0}>
          <Plus className="mr-2 h-4 w-4" />
          Post
        </Button>
      </div>

      {isLoadingJobs ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading posts...
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">No Fanvue posts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Upload media, then schedule your first post.</p>
          <Button type="button" className="mt-4 rounded-full" onClick={openComposer} disabled={connections.length === 0}>
            Create your first post
          </Button>
        </div>
      ) : (
        <>
          <AutopostPostsCalendar
            jobs={calendarJobs}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            onPostClick={() => undefined}
            getJobMediaPreview={(job) => {
              const url = job.media_url
              if (!url || url.startsWith("fanvue://")) return null
              return { url, kind: inferMediaKind(url) }
            }}
          />

          <div className="space-y-2">
            {jobs.map((job) => (
              <article
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{job.status}</Badge>
                    {job.metadata?.fanvue?.priceCents ? (
                      <Badge variant="outline">
                        ${(job.metadata.fanvue.priceCents / 100).toFixed(2)} PPV
                      </Badge>
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
              </article>
            ))}
          </div>
        </>
      )}

      {composerOpen ? (
        <div className="fixed inset-0 z-50 bg-background/80 p-4 backdrop-blur-sm" onClick={() => setComposerOpen(false)}>
          <div className="mx-auto flex h-full w-full max-w-3xl items-center justify-center">
            <Card
              className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[28px]"
              onClick={(event) => event.stopPropagation()}
            >
              <CardHeader className="border-b border-border/60">
                <CardTitle>Fanvue post</CardTitle>
                <CardDescription>
                  {composerStep === "account"
                    ? "Step 1 of 2 — choose the account"
                    : "Step 2 of 2 — compose your post"}
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-y-auto p-6">
                {composerStep === "account" ? (
                  <AccountPickerStep
                    connections={connections}
                    onConnect={() => {
                      window.location.href = "/api/fanvue/connect?next=/content"
                    }}
                    onSelect={(connection) => {
                      setComposerConnection(connection)
                      setComposerStep("compose")
                    }}
                  />
                ) : composerConnection ? (
                  <FanvueComposerStep
                    connection={composerConnection}
                    onBack={() => setComposerStep("account")}
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
