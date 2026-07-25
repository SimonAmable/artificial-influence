"use client"

import { useRef, type ReactNode } from "react"
import { ArrowUp, Plus } from "@phosphor-icons/react"

import { AuroraShaderBackground } from "@/components/ui/aurora-shader-background"
import { cn } from "@/lib/utils"

/** Same compact pointer used on ShaderDemoCard. */
export function ModernPointerCursor({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <path d="M3.1 2.15c-.55-.32-1.2.2-1.05.82l2.7 11.7c.16.7 1.08.9 1.55.32l2.55-3.15 4.55.55c.72.09 1.12-.78.62-1.28L3.1 2.15Z" />
    </svg>
  )
}

export function GuideDemoShell({
  children,
  className,
  label,
}: {
  children: ReactNode
  className?: string
  label: string
}) {
  const shellRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={shellRef}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/50 p-3",
        className
      )}
      aria-label={label}
      role="img"
    >
      <AuroraShaderBackground
        className="rounded-[inherit]"
        targetRef={shellRef}
        animate
      />
      <div className="absolute inset-0 bg-background/40" aria-hidden />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  )
}

export function GuideDemoPromptToolbar({ showAttach = true }: { showAttach?: boolean }) {
  return (
    <div className="mt-2 flex items-center justify-between gap-2">
      {showAttach ? (
        <span className="inline-flex size-6 items-center justify-center rounded-md border border-border/60 bg-background/80 text-foreground">
          <Plus className="size-3.5" weight="bold" />
        </span>
      ) : (
        <span />
      )}
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-foreground text-background">
        <ArrowUp className="size-3.5" weight="bold" />
      </span>
    </div>
  )
}
