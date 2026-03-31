"use client"

import { useSearchParams } from "next/navigation"
import { AgentChatWorkspace } from "@/components/editor/agent-chat-workspace"

export default function AgentChatPage() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get("projectId")

  return <AgentChatWorkspace projectId={projectId} />
}
