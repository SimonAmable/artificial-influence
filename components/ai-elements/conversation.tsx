"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export function Conversation({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}
      {...props}
    />
  )
}

export function ConversationContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex-1 space-y-4 overflow-y-auto", className)}
      {...props}
    />
  )
}

export function ConversationEmptyState({
  title,
  description,
  className,
}: {
  title: string
  description: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground",
        className,
      )}
    >
      <p className="font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-sm leading-relaxed">{description}</p>
    </div>
  )
}
