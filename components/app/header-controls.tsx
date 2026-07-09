import * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Shared glass surface for all header toolbar controls (pills + icons). */
export const headerControlSurfaceClassName =
  "rounded-full border-border/70 bg-secondary/40 shadow-sm backdrop-blur-md transition-colors hover:bg-secondary/70 hover:text-foreground aria-expanded:bg-secondary/50"

export const headerPillClassName = cn(
  headerControlSurfaceClassName,
  "h-auto min-h-9 px-3 py-1.5 text-sm font-semibold text-foreground",
)

export const headerIconClassName = cn(headerControlSurfaceClassName, "size-9")

export function HeaderPillButton({
  className,
  variant = "outline",
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant={variant}
      className={cn(headerPillClassName, className)}
      {...props}
    />
  )
}

export function HeaderIconButton({
  className,
  variant = "outline",
  size = "icon",
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant={variant}
      size={size}
      className={cn(headerIconClassName, className)}
      {...props}
    />
  )
}
