"use client"

import { use } from "react"
import * as React from "react"
import { useSearchParams } from "next/navigation"
import { CreativeAgentChat } from "@/components/chat/creative-agent-chat"

function ThreadPageContent({ threadId }: { threadId: string }) {
  const searchParams = useSearchParams()
  const projectId = searchParams.get("projectId")
  return <CreativeAgentChat initialThreadId={threadId} initialProjectId={projectId} />
}

function ChatThreadWithParams({ params }: { params: Promise<{ id: string }> }) {
  const { id: threadId } = use(params)

  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          Loading chat...
        </div>
      }
    >
      <ThreadPageContent threadId={threadId} />
    </React.Suspense>
  )
}

export default function ChatThreadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          Loading chat...
        </div>
      }
    >
      <ChatThreadWithParams params={params} />
    </React.Suspense>
  )
}
