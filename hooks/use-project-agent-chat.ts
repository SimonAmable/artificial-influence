"use client"

import * as React from "react"
import { Chat, useChat, type UIMessage } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import {
  fetchEditorAgentSession,
  saveEditorAgentSessionClient,
} from "@/lib/editor/database"
import type { EditorAgentSession } from "@/lib/editor/types"
import { dispatchEditorProjectSync } from "@/lib/editor/runtime"

interface UseProjectAgentChatOptions {
  projectId: string | null
  selectionItemIds: string[]
  playheadFrame: number
}

export function useProjectAgentChat({
  projectId,
  selectionItemIds,
  playheadFrame,
}: UseProjectAgentChatOptions) {
  const [session, setSession] = React.useState<EditorAgentSession | null>(null)
  const chat = React.useMemo(
    () =>
      new Chat({
        id: `agent-${projectId ?? "unbound"}`,
        transport: new DefaultChatTransport({
          api: "/api/chat",
        }),
      }),
    [projectId],
  )

  const { messages, setMessages, sendMessage, status, error } = useChat({
    chat,
    experimental_throttle: 50,
  })

  const refreshSession = React.useCallback(async (broadcastProjectSync = false) => {
    if (!projectId) {
      setSession(null)
      setMessages([])
      return
    }

    const nextSession = await fetchEditorAgentSession(projectId)
    setSession(nextSession)
    setMessages((nextSession.messages as UIMessage[]) ?? [])
    if (broadcastProjectSync) {
      dispatchEditorProjectSync(projectId)
    }
  }, [projectId, setMessages])

  React.useEffect(() => {
    if (!projectId) {
      setSession(null)
      setMessages([])
      return
    }

    let cancelled = false
    void fetchEditorAgentSession(projectId)
      .then((nextSession) => {
        if (!cancelled) {
          setSession(nextSession)
          setMessages((nextSession.messages as UIMessage[]) ?? [])
        }
      })
      .catch((loadError) => {
        console.error("Failed to load agent session:", loadError)
      })

    return () => {
      cancelled = true
    }
  }, [projectId, setMessages])

  React.useEffect(() => {
    if (!projectId) return
    if (status !== "ready" && status !== "error") return
    void refreshSession(true).catch((loadError) => {
      console.error("Failed to refresh agent session:", loadError)
    })
  }, [projectId, refreshSession, status])

  const sendAgentMessage = React.useCallback(
    (
      message: {
        role: "user"
        parts: UIMessage["parts"]
      },
      model = "google/gemini-3-flash-preview",
    ) => {
      if (!projectId) return
      sendMessage(message, {
        body: {
          mode: "agent",
          model,
          projectId,
          selectionItemIds,
          playheadFrame,
        },
      })
    },
    [playheadFrame, projectId, selectionItemIds, sendMessage],
  )

  const clearAgentMessages = React.useCallback(async () => {
    setMessages([])
    if (projectId) {
      const clearedSession = await saveEditorAgentSessionClient(projectId, {
        messages: [],
        pending_action: null,
        command_history: [],
      })
      setSession(clearedSession)
    }
  }, [projectId, setMessages])

  return {
    messages,
    status,
    error,
    session,
    commandHistory: session?.command_history ?? [],
    pendingAction: session?.pending_action ?? null,
    sendAgentMessage,
    clearAgentMessages,
    setMessages,
    refreshSession,
  }
}
