"use client"

import * as React from "react"
import { Chat, useChat, type UIMessage } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"

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
  const chat = React.useMemo(
    () =>
      new Chat({
        id: `project-chat-${projectId ?? "unbound"}`,
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

  const refreshSession = React.useCallback(async () => {
    return
  }, [])

  const sendAgentMessage = React.useCallback(
    (
      message: {
        role: "user"
        parts: UIMessage["parts"]
      },
      model = "google/gemini-2.5-flash",
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
  }, [setMessages])

  return {
    messages,
    status,
    error,
    session: null,
    commandHistory: [],
    pendingAction: null,
    sendAgentMessage,
    clearAgentMessages,
    setMessages,
    refreshSession,
  }
}
