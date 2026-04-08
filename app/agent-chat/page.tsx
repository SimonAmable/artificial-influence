"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"

function AgentChatRedirectContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get("projectId")

  React.useEffect(() => {
    router.replace(projectId ? `/chat?projectId=${encodeURIComponent(projectId)}` : "/chat")
  }, [projectId, router])

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Redirecting to chat...
    </div>
  )
}

export default function AgentChatPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          Redirecting to chat...
        </div>
      }
    >
      <AgentChatRedirectContent />
    </React.Suspense>
  )
}
