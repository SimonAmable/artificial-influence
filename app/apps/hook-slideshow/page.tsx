import * as React from "react"
import { HookSlideshowApp } from "@/components/slideshow/hook-slideshow-app"

export default function HookSlideshowPage() {
  return (
    <main className="min-h-screen w-full min-w-0 overflow-hidden">
      <React.Suspense
        fallback={<div className="px-6 py-24 text-sm text-muted-foreground">Loading Hook Slideshow...</div>}
      >
        <HookSlideshowApp />
      </React.Suspense>
    </main>
  )
}
