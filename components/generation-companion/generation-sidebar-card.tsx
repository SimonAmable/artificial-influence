"use client"

import * as React from "react"
import { CaretDown, CaretUp, Check, SpinnerGap, WarningCircle } from "@phosphor-icons/react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useGenerationTasks } from "./generation-tasks-provider"

export function GenerationSidebarCard() {
  const router = useRouter()
  const { tasks } = useGenerationTasks()
  const [collapsed, setCollapsed] = React.useState(false)
  const recentTasks = tasks
    .filter((task) => task.status === "pending" || task.status === "failed" || task.status === "completed")
    .slice(0, 3)

  if (recentTasks.length === 0) return null

  return (
    <section className="border-b border-border/60 px-3 py-2">
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-muted/50"
      >
        <span className="min-w-0 flex-1 truncate text-xs font-medium">Recent activity</span>
        {collapsed ? (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] tabular-nums text-muted-foreground">
            {recentTasks.length}
          </span>
        ) : null}
        {collapsed ? <CaretDown className="size-3.5 text-muted-foreground" /> : <CaretUp className="size-3.5 text-muted-foreground" />}
      </button>

      {!collapsed ? (
        <div className="mt-1 space-y-1 px-1 pb-0.5">
          {recentTasks.map((task) => {
            const isFailed = task.status === "failed"
            const isCompleted = task.status === "completed"
            const statusLabel = isFailed ? "Failed" : isCompleted ? "Ready" : "Generating"

            return (
              <button
                key={task.id}
                type="button"
                onClick={() => router.push(`/${task.type === "video" ? "video" : "image"}?generation=${encodeURIComponent(task.id)}`)}
                className="flex w-full min-w-0 items-center gap-2 rounded px-1 py-0.5 text-left text-xs text-muted-foreground hover:bg-muted/50"
              >
                {isFailed ? <WarningCircle className="size-3.5 shrink-0 text-destructive" weight="fill" /> : isCompleted ? <Check className="size-3.5 shrink-0 text-emerald-400" weight="bold" /> : <SpinnerGap className="size-3.5 shrink-0 animate-spin text-muted-foreground" />}
                <span className={cn("min-w-0 flex-1 truncate", isFailed && "text-destructive/90")}>
                  {task.type === "video" ? "Video" : "Image"} · {task.model ?? "AI model"}
                </span>
                <span className={cn("shrink-0 text-[10px] font-medium", isFailed ? "text-destructive" : isCompleted ? "text-emerald-400" : "text-muted-foreground")}>
                  {statusLabel}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
