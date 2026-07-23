"use client"

import * as React from "react"
import {
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export function PromptControlMenuContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectContent>) {
  return (
    <SelectContent
      position="popper"
      side="top"
      sideOffset={4}
      className={cn("min-w-[11rem] p-1", className)}
      {...props}
    >
      {children}
    </SelectContent>
  )
}

export function PromptControlMenuGroup({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <SelectGroup className={className}>
      <SelectLabel className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </SelectLabel>
      {children}
    </SelectGroup>
  )
}

export function PromptControlMenuSeparator() {
  return <SelectSeparator className="my-1" />
}

type PromptControlMenuItemProps = {
  value: string
  label: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  iconPosition?: "start" | "end"
  disabled?: boolean
  className?: string
}

export function PromptControlMenuItem({
  value,
  label,
  description,
  icon,
  iconPosition = "start",
  disabled,
  className,
}: PromptControlMenuItemProps) {
  const iconNode = icon ? (
    <div className="flex size-4 shrink-0 items-center justify-center text-foreground">
      {icon}
    </div>
  ) : null

  return (
    <SelectItem
      value={value}
      disabled={disabled}
      className={cn(
        "group relative rounded-lg py-1.5 pr-9 pl-2.5 text-sm focus:bg-accent/80 data-[highlighted]:bg-accent/80 data-[state=checked]:bg-accent/60",
        className,
      )}
    >
      <div className="flex w-full min-w-0 items-center gap-2">
        {iconPosition === "start" ? iconNode : null}
        <div className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
          <span className="shrink-0 text-sm font-medium">{label}</span>
          {description ? (
            <>
              <span className="shrink-0 text-muted-foreground/40">·</span>
              <span className="truncate text-xs text-muted-foreground">{description}</span>
            </>
          ) : null}
        </div>
        {iconPosition === "end" ? iconNode : null}
      </div>
    </SelectItem>
  )
}

export function QualityOptionIcon({ label }: { label: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-4 items-center justify-center rounded-[3px] px-0.5 text-[8px] font-bold uppercase leading-none transition-colors",
        "bg-foreground text-background",
        "group-focus:bg-background group-focus:text-foreground",
        "group-data-[highlighted]:bg-background group-data-[highlighted]:text-foreground",
      )}
    >
      {label}
    </span>
  )
}
