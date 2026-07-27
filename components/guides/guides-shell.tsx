"use client"

import type { ReactNode } from "react"

import { GuidesSidebar } from "@/components/guides/guides-sidebar"

export function GuidesShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full flex-col gap-10 px-4 pb-16 pt-24 sm:px-6 lg:flex-row lg:gap-12 lg:px-8">
        <GuidesSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
