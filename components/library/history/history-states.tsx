"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function LoadingGrid({ label }: { label: string }) {
  return (
    <div className="space-y-4">
      <div className="text-center text-sm text-muted-foreground">{label}</div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="aspect-square animate-pulse rounded-2xl border border-border bg-muted/40" />
        ))}
      </div>
    </div>
  )
}

export function RetryState({
  message,
  onRetry,
  centered = false,
}: {
  message: string
  onRetry: () => void
  centered?: boolean
}) {
  return (
    <div className={cn("flex w-full justify-center", centered && "min-h-[calc(100dvh-15rem)] items-center")}>
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-14 text-center">
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  centered = false,
}: {
  icon: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  centered?: boolean
}) {
  return (
    <div className={cn("flex w-full justify-center", centered && "min-h-[calc(100dvh-15rem)] items-center")}>
      <div className="flex w-full max-w-md flex-col items-center rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-14 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
          {icon}
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
        {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </div>
  )
}
