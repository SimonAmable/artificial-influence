"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { CreativeAgentChat } from "@/components/chat/creative-agent-chat"

function ChatPageContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get("projectId")
  return <CreativeAgentChat initialProjectId={projectId} />
}

export default function ChatPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          Loading chat...
        </div>
      }
    >
      <ChatPageContent />
    </React.Suspense>
  )
}
