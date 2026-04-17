"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { VideoEditor } from "@/components/video-editor/video-editor"

function EditorPageInner() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get("project")
  return <VideoEditor initialProjectId={projectId} />
}

export default function EditorPage() {
  return (
    <main className="min-h-0 w-full min-w-0">
      <React.Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading editor…</div>}>
        <EditorPageInner />
      </React.Suspense>
    </main>
  )
}
