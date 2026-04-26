"use client"

import { Books } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

export function SidebarSkillButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-foreground/90 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      onClick={() => {
        window.dispatchEvent(new CustomEvent("chat-open-skill-picker"))
      }}
    >
      <Books className="size-4 shrink-0" aria-hidden />
      <span className="truncate">Skills</span>
    </button>
  )
}
