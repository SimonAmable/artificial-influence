"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export function Message({
  from,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant"
}) {
  return (
    <div
      className={cn(
        "flex gap-2",
        from === "user" ? "justify-end" : "justify-start",
        className,
      )}
      {...props}
    />
  )
}

export function MessageContent({
  from,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant"
}) {
  return (
    <div
      className={cn(
        "max-w-[85%] rounded-2xl px-4 py-3",
        from === "user"
          ? "bg-foreground text-background"
          : "border border-border/60 bg-muted/40 text-foreground",
        className,
      )}
      {...props}
    />
  )
}
