"use client"

import * as React from "react"
import Image from "next/image"
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isBefore,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"

import type { AutopostJobRow } from "@/components/autopost/autopost-page"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const VISIBLE_PILLS_PER_DAY = 3

export function getJobCalendarAnchor(job: AutopostJobRow): Date | null {
  let iso: string | null = null
  switch (job.status) {
    case "queued":
      iso = job.scheduled_at ?? job.created_at
      break
    case "published":
      iso = job.published_at ?? job.updated_at
      break
    case "draft":
      iso = job.created_at
      break
    case "processing":
    case "inbox_delivered":
    case "failed":
    case "cancelled":
      iso = job.updated_at
      break
    default:
      iso = job.created_at
  }
  if (!iso) {
    return null
  }
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? d : null
}

function providerIconSrc(provider: string | null | undefined) {
  if (provider === "tiktok") return "/brand_icons/tiktok-icon.svg"
  if (provider === "fanvue") return "/brand_icons/fanvue_logo.png"
  return "/brand_icons/instagram-icon.svg"
}

export type AutopostPostsCalendarProps = {
  jobs: AutopostJobRow[]
  month: Date
  onMonthChange: (nextMonth: Date) => void
  onPostClick: (job: AutopostJobRow) => void
  onDayClick?: (day: Date) => void
  getJobMediaPreview: (job: AutopostJobRow) => { url: string; kind: "image" | "video" } | null
  className?: string
}

export function AutopostPostsCalendar({
  jobs,
  month,
  onMonthChange,
  onPostClick,
  onDayClick,
  getJobMediaPreview,
  className,
}: AutopostPostsCalendarProps) {
  const [expandedDayKeys, setExpandedDayKeys] = React.useState<Set<number>>(() => new Set())

  const toggleDayExpanded = React.useCallback((dayKey: number) => {
    setExpandedDayKeys((prev) => {
      const next = new Set(prev)
      if (next.has(dayKey)) {
        next.delete(dayKey)
      } else {
        next.add(dayKey)
      }
      return next
    })
  }, [])

  const jobsByDayStart = React.useMemo(() => {
    const map = new Map<number, { job: AutopostJobRow; at: Date }[]>()
    for (const job of jobs) {
      const at = getJobCalendarAnchor(job)
      if (!at) {
        continue
      }
      const key = startOfDay(at).getTime()
      const list = map.get(key) ?? []
      list.push({ job, at })
      map.set(key, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.at.getTime() - b.at.getTime())
    }
    return map
  }, [jobs])

  const calendarDays = React.useMemo(() => {
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    return eachDayOfInterval({
      start: startOfWeek(start, { weekStartsOn: 0 }),
      end: endOfWeek(end, { weekStartsOn: 0 }),
    })
  }, [month])

  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const todayStart = startOfDay(new Date())

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold tracking-tight">{format(month, "MMMM yyyy")}</p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label="Previous month"
            onClick={() => onMonthChange(startOfMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label="Next month"
            onClick={() => onMonthChange(startOfMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px rounded-xl bg-border/80 ring-1 ring-border/80">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="bg-background px-1 py-2 text-center text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {label}
          </div>
        ))}

        {calendarDays.map((day) => {
          const inMonth = isSameMonth(day, month)
          const today = isToday(day)
          const dayKey = startOfDay(day).getTime()
          const dayJobs = jobsByDayStart.get(dayKey) ?? []
          const expanded = expandedDayKeys.has(dayKey)
          const visibleCap = expanded ? dayJobs.length : VISIBLE_PILLS_PER_DAY

          const isPastDay = isBefore(startOfDay(day), todayStart)
          const canCreateOnDay = Boolean(onDayClick && inMonth && !isPastDay)

          return (
            <div
              key={day.toISOString()}
              role={canCreateOnDay ? "button" : undefined}
              tabIndex={canCreateOnDay ? 0 : undefined}
              aria-label={
                canCreateOnDay ? `Create post for ${format(day, "MMMM d, yyyy")}` : undefined
              }
              onClick={canCreateOnDay ? () => onDayClick?.(day) : undefined}
              onKeyDown={
                canCreateOnDay
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        onDayClick?.(day)
                      }
                    }
                  : undefined
              }
              className={cn(
                "group/day relative flex min-h-[104px] flex-col gap-1 bg-background p-1.5 sm:min-h-[120px] sm:p-2",
                !inMonth && "bg-muted/20",
                isPastDay && inMonth && "bg-muted/10",
                canCreateOnDay &&
                  "cursor-pointer transition-colors hover:bg-muted/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40",
              )}
            >
              <div className="flex justify-end">
                <span
                  className={cn(
                    "flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-medium tabular-nums",
                    !inMonth && "text-muted-foreground/70",
                    inMonth && !today && "text-foreground",
                    today && "bg-primary text-primary-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                {dayJobs.length === 0 && canCreateOnDay ? (
                  <div
                    className={cn(
                      "flex w-full min-w-0 items-center gap-1.5 rounded-full border border-dashed border-border/60 bg-muted/15 px-1.5 py-1 opacity-0 transition-all",
                      "group-hover/day:border-primary/40 group-hover/day:bg-muted/30 group-hover/day:opacity-100",
                      "group-focus-visible/day:border-primary/40 group-focus-visible/day:bg-muted/30 group-focus-visible/day:opacity-100",
                    )}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors group-hover/day:bg-muted/70 group-hover/day:text-foreground">
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <span className="truncate text-[10px] font-medium text-muted-foreground transition-colors group-hover/day:text-foreground">
                      Create post
                    </span>
                  </div>
                ) : null}

                {dayJobs.slice(0, visibleCap).map(({ job, at }) => {
                  const preview = getJobMediaPreview(job)
                  return (
                    <button
                      key={job.id}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onPostClick(job)
                      }}
                      className={cn(
                        "flex w-full min-w-0 items-center gap-1.5 rounded-full border border-border/60 bg-muted/25 px-1 py-0.5 text-left transition-colors",
                        "hover:border-primary/40 hover:bg-muted/40",
                      )}
                    >
                      <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-muted">
                        {preview?.kind === "video" ? (
                          <video
                            className="h-full w-full object-cover"
                            src={preview.url}
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : preview?.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt="" className="h-full w-full object-cover" src={preview.url} />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                            —
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-baseline gap-1">
                          <span className="shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground">
                            {format(at, "h:mm a")}
                          </span>
                          <span className="truncate text-[10px] leading-tight text-foreground">
                            {job.caption?.trim() || "No caption"}
                          </span>
                        </span>
                      </span>
                      <Image
                        alt=""
                        aria-hidden
                        className={cn(
                          "shrink-0 opacity-90",
                          job.provider === "instagram" && "dark:invert",
                        )}
                        height={14}
                        src={providerIconSrc(job.provider)}
                        width={14}
                      />
                    </button>
                  )
                })}
                {dayJobs.length > VISIBLE_PILLS_PER_DAY ? (
                  <button
                    type="button"
                    className={cn(
                      "w-full truncate px-1 text-left text-[10px] font-medium text-muted-foreground underline-offset-2",
                      "transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    )}
                    aria-expanded={expanded}
                    aria-label={
                      expanded
                        ? "Collapse extra posts for this day"
                        : `Show ${dayJobs.length - VISIBLE_PILLS_PER_DAY} more posts for this day`
                    }
                    onClick={(event) => {
                      event.stopPropagation()
                      toggleDayExpanded(dayKey)
                    }}
                  >
                    {expanded
                      ? "Show less"
                      : `+${dayJobs.length - VISIBLE_PILLS_PER_DAY} more`}
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
