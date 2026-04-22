import type { SupabaseClient } from "@supabase/supabase-js"
import type { UIMessage } from "ai"
import { replaceChatThreadMessages } from "@/lib/chat/database-server"

type PendingMediaToolPart =
  | {
      type: "tool-generateImageWithNanoBanana"
      toolCallId: string
      state: "input-streaming" | "input-available" | "output-available" | "output-error"
      output?: {
        generationId?: string | null
        predictionId?: string
        status?: "pending" | "completed" | "failed"
      }
    }
  | {
      type: "tool-generateImage"
      toolCallId: string
      state: "input-streaming" | "input-available" | "output-available" | "output-error"
      output?: {
        generationId?: string | null
        predictionId?: string
        status?: "pending" | "completed" | "failed"
      }
    }
  | {
      type: "tool-generateVideo"
      toolCallId: string
      state: "input-streaming" | "input-available" | "output-available" | "output-error"
      output?: {
        generationId?: string | null
        predictionId?: string
        status?: "pending" | "completed" | "failed"
      }
    }

type MediaBinding = {
  generationId?: string | null
  messageId: string
  predictionId: string
  toolCallId: string
}

type StoredGenerationRow = {
  chat_message_id: string | null
  chat_thread_id: string | null
  chat_tool_call_id: string | null
  created_at: string
  error_message: string | null
  id: string
  replicate_prediction_id: string | null
  status: string | null
  supabase_storage_path: string | null
  tool: string | null
  type: "image" | "video" | "audio"
  user_id: string
}

function collectPendingMediaBindings(messages: UIMessage[]) {
  const bindings: MediaBinding[] = []

  for (const message of messages) {
    if (message.role !== "assistant") {
      continue
    }

    for (const part of message.parts) {
      if (
        part.type !== "tool-generateImageWithNanoBanana" &&
        part.type !== "tool-generateImage" &&
        part.type !== "tool-generateVideo"
      ) {
        continue
      }

      const toolPart = part as unknown as PendingMediaToolPart
      const predictionId = toolPart.output?.predictionId?.trim()

      if (
        toolPart.state !== "output-available" ||
        toolPart.output?.status !== "pending" ||
        !predictionId ||
        !toolPart.toolCallId
      ) {
        continue
      }

      bindings.push({
        generationId: toolPart.output?.generationId ?? null,
        messageId: message.id,
        predictionId,
        toolCallId: toolPart.toolCallId,
      })
    }
  }

  return bindings
}

function inferImageMimeType(storagePath: string) {
  const lower = storagePath.toLowerCase()
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".gif")) return "image/gif"
  if (lower.endsWith(".avif")) return "image/avif"
  if (lower.endsWith(".svg")) return "image/svg+xml"
  return "image/png"
}

function inferVideoMimeType(storagePath: string) {
  const lower = storagePath.toLowerCase()
  if (lower.endsWith(".webm")) return "video/webm"
  if (lower.endsWith(".mov")) return "video/quicktime"
  return "video/mp4"
}

function getPublicUrl(supabase: SupabaseClient, storagePath: string) {
  const { data } = supabase.storage.from("public-bucket").getPublicUrl(storagePath)
  return data.publicUrl
}

function sortGenerationRows(rows: StoredGenerationRow[]) {
  return [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

function patchMessagesForGenerationResult({
  messages,
  generationRows,
  toolCallId,
  messageId,
  supabase,
}: {
  messages: UIMessage[]
  generationRows: StoredGenerationRow[]
  messageId: string
  supabase: SupabaseClient
  toolCallId: string
}) {
  let didPatch = false
  const sortedRows = sortGenerationRows(generationRows)

  const patchedMessages = messages.map((message) => {
    if (message.id !== messageId) {
      return message
    }

    const nextParts = message.parts.map((part) => {
      if (
        part.type !== "tool-generateImageWithNanoBanana" &&
        part.type !== "tool-generateImage" &&
        part.type !== "tool-generateVideo"
      ) {
        return part
      }

      if (part.toolCallId !== toolCallId) {
        return part
      }

      didPatch = true

      const primaryGeneration = sortedRows[0]
      const failedGeneration = sortedRows.find((row) => row.status === "failed")
      const existingOutput =
        typeof part.output === "object" && part.output != null
          ? (part.output as Record<string, unknown>)
          : {}

      if (failedGeneration) {
        const { output: _ignoredOutput, ...partWithoutOutput } = part as typeof part & {
          output?: unknown
        }

        return {
          ...partWithoutOutput,
          state: "output-error" as const,
          errorText: failedGeneration.error_message || "Generation failed.",
        }
      }

      if (primaryGeneration.type === "video") {
        const completedVideo = sortedRows.find(
          (row) => row.status === "completed" && typeof row.supabase_storage_path === "string",
        )

        if (!completedVideo?.supabase_storage_path) {
          return part
        }

        return {
          ...part,
          state: "output-available" as const,
          output: {
            ...existingOutput,
            generationId: completedVideo.id,
            status: "completed" as const,
            video: {
              mimeType: inferVideoMimeType(completedVideo.supabase_storage_path),
              storagePath: completedVideo.supabase_storage_path,
              url: getPublicUrl(supabase, completedVideo.supabase_storage_path),
            },
          },
        }
      }

      const completedImages = sortedRows.filter(
        (row) => row.status === "completed" && typeof row.supabase_storage_path === "string",
      )

      if (completedImages.length === 0) {
        return part
      }

      return {
        ...part,
        state: "output-available" as const,
        output: {
          ...existingOutput,
          generationId: completedImages[0].id,
          images: completedImages.map((row) => ({
            mimeType: inferImageMimeType(row.supabase_storage_path!),
            url: getPublicUrl(supabase, row.supabase_storage_path!),
          })),
          status: "completed" as const,
          variantCount:
            typeof existingOutput.variantCount === "number"
              ? Math.max(existingOutput.variantCount, completedImages.length)
              : completedImages.length,
        },
      }
    })

    return {
      ...message,
      parts: nextParts,
    }
  })

  return {
    didPatch,
    messages: patchedMessages as UIMessage[],
  }
}

async function syncCompletedGenerationToChat({
  messageId,
  predictionId,
  supabase,
  threadId,
  toolCallId,
  userId,
}: {
  messageId: string
  predictionId: string
  supabase: SupabaseClient
  threadId: string
  toolCallId: string
  userId: string
}) {
  const { data: generationRows, error: generationsError } = await supabase
    .from("generations")
    .select(
      "chat_message_id, chat_thread_id, chat_tool_call_id, created_at, error_message, id, replicate_prediction_id, status, supabase_storage_path, tool, type, user_id",
    )
    .eq("user_id", userId)
    .eq("replicate_prediction_id", predictionId)
    .order("created_at", { ascending: true })

  if (generationsError) {
    throw new Error(`Failed to load generation result for chat sync: ${generationsError.message}`)
  }

  const rows = (generationRows ?? []) as StoredGenerationRow[]
  const hasTerminalState = rows.some((row) => row.status === "completed" || row.status === "failed")

  if (!hasTerminalState) {
    return false
  }

  const { data: threadRow, error: threadError } = await supabase
    .from("chat_threads")
    .select("messages")
    .eq("id", threadId)
    .eq("user_id", userId)
    .maybeSingle()

  if (threadError || !threadRow) {
    throw new Error(`Failed to load chat thread for media sync: ${threadError?.message ?? "Not found"}`)
  }

  const currentMessages = Array.isArray(threadRow.messages) ? (threadRow.messages as UIMessage[]) : []
  const { didPatch, messages } = patchMessagesForGenerationResult({
    generationRows: rows,
    messageId,
    messages: currentMessages,
    supabase,
    toolCallId,
  })

  if (!didPatch) {
    return false
  }

  await replaceChatThreadMessages(supabase, threadId, userId, messages as UIMessage[])
  return true
}

export async function bindPendingGenerationsToChatMessages({
  messages,
  supabase,
  threadId,
  userId,
}: {
  messages: UIMessage[]
  supabase: SupabaseClient
  threadId: string
  userId: string
}) {
  const bindings = collectPendingMediaBindings(messages)

  for (const binding of bindings) {
    const { error } = await supabase
      .from("generations")
      .update({
        chat_message_id: binding.messageId,
        chat_thread_id: threadId,
        chat_tool_call_id: binding.toolCallId,
      })
      .eq("user_id", userId)
      .eq("replicate_prediction_id", binding.predictionId)

    if (error) {
      throw new Error(`Failed to bind chat media generation: ${error.message}`)
    }

    await syncCompletedGenerationToChat({
      messageId: binding.messageId,
      predictionId: binding.predictionId,
      supabase,
      threadId,
      toolCallId: binding.toolCallId,
      userId,
    })

  }
}

export async function syncGenerationResultToPersistedChat({
  predictionId,
  supabase,
}: {
  predictionId: string
  supabase: SupabaseClient
}) {
  const { data: generationRows, error } = await supabase
    .from("generations")
    .select(
      "chat_message_id, chat_thread_id, chat_tool_call_id, created_at, error_message, id, replicate_prediction_id, status, supabase_storage_path, tool, type, user_id",
    )
    .eq("replicate_prediction_id", predictionId)
    .order("created_at", { ascending: true })

  if (error) {
    throw new Error(`Failed to load generation rows for chat sync: ${error.message}`)
  }

  const rows = (generationRows ?? []) as StoredGenerationRow[]
  const primaryRow = rows[0]

  if (!primaryRow?.chat_thread_id || !primaryRow.chat_message_id || !primaryRow.chat_tool_call_id) {
    return false
  }

  const { data: threadRow, error: threadError } = await supabase
    .from("chat_threads")
    .select("messages")
    .eq("id", primaryRow.chat_thread_id)
    .eq("user_id", primaryRow.user_id)
    .maybeSingle()

  if (threadError || !threadRow) {
    throw new Error(`Failed to load chat thread for generation sync: ${threadError?.message ?? "Not found"}`)
  }

  const currentMessages = Array.isArray(threadRow.messages) ? (threadRow.messages as UIMessage[]) : []
  const { didPatch, messages } = patchMessagesForGenerationResult({
    generationRows: rows,
    messageId: primaryRow.chat_message_id,
    messages: currentMessages,
    supabase,
    toolCallId: primaryRow.chat_tool_call_id,
  })

  if (!didPatch) {
    return false
  }

  await replaceChatThreadMessages(
    supabase,
    primaryRow.chat_thread_id,
    primaryRow.user_id,
    messages as UIMessage[],
  )
  return true
}
