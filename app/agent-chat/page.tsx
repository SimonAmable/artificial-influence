"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { AgentChatWorkspace } from "@/components/editor/agent-chat-workspace"

function AgentChatPageContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get("projectId")
  return <AgentChatWorkspace projectId={projectId} />
}

export default function AgentChatPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <AgentChatPageContent />
    </React.Suspense>
  )
}
