"use client"

import * as React from "react"
import { Clock3, Wrench } from "lucide-react"
import type { AgentCommandLogEntry } from "@/lib/editor/types"
import { cn } from "@/lib/utils"

export function ToolExecutionList({
  entries,
  className,
}: {
  entries: AgentCommandLogEntry[]
  className?: string
}) {
  if (entries.length === 0) return null

  return (
    <div className={cn("space-y-3", className)}>
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="rounded-2xl border border-border/60 bg-muted/30 p-4"
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Wrench className="h-3.5 w-3.5" />
            Tool execution
            <Clock3 className="ml-2 h-3.5 w-3.5" />
            {new Date(entry.createdAt).toLocaleTimeString()}
          </div>
          <p className="mt-2 text-sm font-medium text-foreground">{entry.summary}</p>
          {entry.steps && entry.steps.length > 0 ? (
            <div className="mt-3 space-y-2">
              {entry.steps.map((step) => (
                <div
                  key={step.id}
                  className="rounded-xl border border-border/50 bg-background/70 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {step.index}. {step.label}
                    </p>
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {step.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {step.summary}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
