"use client"

import * as React from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

function Command({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command"
      className={cn("flex h-full w-full flex-col overflow-hidden", className)}
      {...props}
    />
  )
}

function CommandDialog({
  title = "Command menu",
  description = "Search pages and templates.",
  className,
  children,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string
  description?: string
  className?: string
}) {
  return (
    <Dialog {...props}>
      <DialogContent
        className={cn(
          "top-[12vh] max-h-[min(720px,78vh)] max-w-[min(46rem,calc(100vw-1.5rem))] translate-y-0 overflow-hidden rounded-[1.75rem] border border-border/70 bg-background/95 p-0 shadow-2xl backdrop-blur-xl sm:top-[14vh]",
          className,
        )}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        <Command>{children}</Command>
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({
  className,
  wrapperClassName,
  icon,
  ...props
}: React.ComponentProps<"input"> & {
  wrapperClassName?: string
  icon?: React.ReactNode
}) {
  return (
    <div
      data-slot="command-input-wrapper"
      className={cn(
        "flex h-14 items-center gap-2 border-b border-border/60 px-4",
        wrapperClassName,
      )}
    >
      {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
      <input
        data-slot="command-input"
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  )
}

function CommandList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-list"
      className={cn("max-h-[calc(min(720px,78vh)-3.5rem)] overflow-y-auto p-2", className)}
      {...props}
    />
  )
}

function CommandEmpty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-empty"
      className={cn("px-4 py-10 text-center text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CommandGroup({
  className,
  heading,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  heading?: React.ReactNode
}) {
  return (
    <div data-slot="command-group" className={cn("py-1.5", className)} {...props}>
      {heading ? (
        <div className="px-2 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {heading}
        </div>
      ) : null}
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function CommandItem({
  className,
  active,
  ...props
}: React.ComponentProps<"button"> & {
  active?: boolean
}) {
  return (
    <button
      type="button"
      data-slot="command-item"
      data-active={active ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm outline-none transition-colors hover:bg-muted/80 focus-visible:bg-muted/80 data-[active=true]:bg-muted",
        className,
      )}
      {...props}
    />
  )
}

function CommandSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-separator"
      className={cn("-mx-2 my-2 h-px bg-border/60", className)}
      {...props}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
}
