"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
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
      <Empty>
        <EmptyHeader>
          <EmptyDescription>{message}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </EmptyContent>
      </Empty>
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
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">{icon}</EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          {description ? <EmptyDescription>{description}</EmptyDescription> : null}
        </EmptyHeader>
        {action ? <EmptyContent>{action}</EmptyContent> : null}
      </Empty>
    </div>
  )
}
