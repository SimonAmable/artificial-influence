"use client"

import * as React from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"

type ExtensionPanelShellProps = {
  children: React.ReactNode
  className?: string
}

export function ExtensionPanelShell({ children, className }: ExtensionPanelShellProps) {
  return (
    <div
      className={cn(
        "flex w-[360px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      <header className="flex items-center gap-3 px-4 pt-4 pb-1">
        <Image src="/logo.svg" alt="" width={28} height={28} className="shrink-0" />
        <div className="min-w-0">
          <p className="font-display text-sm font-bold uppercase tracking-tight text-foreground">
            UniCan
          </p>
          <p className="text-xs text-muted-foreground">Recreate Extension</p>
        </div>
      </header>
      {children}
    </div>
  )
}
