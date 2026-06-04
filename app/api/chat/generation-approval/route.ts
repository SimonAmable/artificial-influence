import type { ToolExecuteFunction, UIMessage } from "ai"
import { getChatThreadById, updateChatThreadMessages } from "@/lib/chat/database-server"
import {
  getAvailableConversationAudioReferences,
  getAvailableConversationImageReferences,
  getAvailableConversationVideoReferences,
} from "@/lib/chat/conversation-references"
import { bindPendingGenerationsToChatMessages } from "@/lib/chat/media-persistence"
import { createCreativeChatTools } from "@/lib/chat/tools"
import { createGenerateImageWithNanoBananaTool } from "@/lib/chat/tools/generate-image-with-nano-banana"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 300

type GenerationToolName =
  | "generateAudio"
  | "generateImage"
  | "generateImageWithNanoBanana"
  | "generateVideo"

const TOOL_TYPE_TO_NAME: Record<string, GenerationToolName> = {
  "tool-generateAudio": "generateAudio",
  "tool-generateImage": "generateImage",
  "tool-generateImageWithNanoBanana": "generateImageWithNanoBanana",
  "tool-generateVideo": "generateVideo",
}

type GenerationToolPart = {
  approval?: {
    approved?: boolean
    id?: string
    reason?: string
  }
  errorText?: string
  input?: unknown
  output?: unknown
  state?: string
  toolCallId?: string
  type?: string
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  })
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Generation approval failed."
}

function updateGenerationToolPart({
  approved,
  messages,
  output,
  toolCallId,
}: {
  approved: boolean
  messages: UIMessage[]
  output?: unknown
  toolCallId: string
}) {
  let updated = false
  const reason = "User canceled generation."

  const nextMessages = messages.map((message) => {
    let messageChanged = false
    const nextParts = (message.parts ?? []).map((part) => {
      const toolPart = part as GenerationToolPart

      if (
        !updated &&
        typeof toolPart.type === "string" &&
        TOOL_TYPE_TO_NAME[toolPart.type] &&
        toolPart.toolCallId === toolCallId
      ) {
        updated = true
        messageChanged = true

        if (approved) {
          return {
            ...part,
            approval: toolPart.approval
              ? {
                  ...toolPart.approval,
                  approved: true,
                }
              : undefined,
            output,
            state: "output-available",
          } as typeof part
        }

        return {
          ...part,
          approval: {
            ...toolPart.approval,
            approved: false,
            reason,
          },
          state: "output-denied",
        } as typeof part
      }

      return part
    }) as UIMessage["parts"]

    return messageChanged ? { ...message, parts: nextParts } : message
  })

  return { messages: nextMessages, updated }
}

function findGenerationToolPart(messages: UIMessage[], toolCallId: string) {
  for (const message of messages) {
    for (const part of message.parts ?? []) {
      const toolPart = part as GenerationToolPart
      if (
        typeof toolPart.type === "string" &&
        TOOL_TYPE_TO_NAME[toolPart.type] &&
        toolPart.toolCallId === toolCallId
      ) {
        return {
          input: toolPart.input,
          toolName: TOOL_TYPE_TO_NAME[toolPart.type],
        }
      }
    }
  }

  return null
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized. Please log in to use chat." }, 401)
    }

    const body = (await req.json()) as {
      approved?: boolean
      messages?: UIMessage[]
      threadId?: string
      toolCallId?: string
    }

    const approved = body.approved === true
    const toolCallId = typeof body.toolCallId === "string" ? body.toolCallId : ""

    if (!toolCallId) {
      return jsonResponse({ error: "Missing generation tool call id." }, 400)
    }

    if (body.threadId) {
      const thread = await getChatThreadById(body.threadId, user.id)
      if (!thread) {
        return jsonResponse({ error: "Chat thread not found." }, 404)
      }
    }

    const requestMessages = Array.isArray(body.messages) ? body.messages : []
    if (requestMessages.length === 0) {
      return jsonResponse({ error: "No chat messages were provided." }, 400)
    }

    const target = findGenerationToolPart(requestMessages, toolCallId)
    if (!target) {
      return jsonResponse({ error: "Pending generation approval was not found." }, 404)
    }

    if (!approved) {
      const canceled = updateGenerationToolPart({
        approved: false,
        messages: requestMessages,
        toolCallId,
      })

      if (body.threadId) {
        await updateChatThreadMessages(body.threadId, user.id, canceled.messages)
      }

      return jsonResponse({ messages: canceled.messages })
    }

    const tools = createCreativeChatTools({
      availableAudioReferences: getAvailableConversationAudioReferences(requestMessages),
      availableReferences: getAvailableConversationImageReferences(requestMessages),
      availableVideoReferences: getAvailableConversationVideoReferences(requestMessages),
      generationApprovalMode: "auto",
      supabase,
      threadId: body.threadId,
      userId: user.id,
    })

    const toolToExecute =
      target.toolName === "generateImageWithNanoBanana"
        ? createGenerateImageWithNanoBananaTool({
            availableReferences: getAvailableConversationImageReferences(requestMessages),
            supabase,
            threadId: body.threadId,
            userId: user.id,
          })
        : (tools[target.toolName] as {
            execute?: ToolExecuteFunction<unknown, unknown>
          })
    const executableTool = toolToExecute as {
      execute?: ToolExecuteFunction<unknown, unknown>
    }

    if (!executableTool.execute) {
      return jsonResponse({ error: "Generation tool is not executable." }, 400)
    }

    const output = await executableTool.execute(target.input, {
      abortSignal: req.signal,
      messages: [],
      toolCallId,
    })

    const updated = updateGenerationToolPart({
      approved: true,
      messages: requestMessages,
      output,
      toolCallId,
    })

    if (!updated.updated) {
      return jsonResponse({ error: "Pending generation approval was not found." }, 404)
    }

    if (body.threadId) {
      await updateChatThreadMessages(body.threadId, user.id, updated.messages)
      await bindPendingGenerationsToChatMessages({
        messages: updated.messages,
        supabase,
        threadId: body.threadId,
        userId: user.id,
      })
    }

    return jsonResponse({ messages: updated.messages })
  } catch (error) {
    console.error("[chat/generation-approval] Error:", error)
    return jsonResponse({ error: getErrorMessage(error) }, 500)
  }
}
