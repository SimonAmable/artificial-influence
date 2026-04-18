import type { SupabaseClient } from "@supabase/supabase-js"
import type { UIMessage } from "ai"
import { createClient } from "@/lib/supabase/server"
import { sanitizeToolErrorPartsInMessages } from "@/lib/chat/sanitize-ui-messages"

export interface ChatThread {
  id: string
  user_id: string
  title: string
  messages: UIMessage[]
  created_at: string
  updated_at: string
  source?: "user" | "automation"
  automation_id?: string | null
}

export interface ChatThreadListItem {
  id: string
  title: string
  updated_at: string
  /** Present after migration `20260419000000_automations`; defaults to `user` in UI if missing. */
  source?: "user" | "automation"
  automation_id?: string | null
}

function normalizeMessages(messages: UIMessage[] | null | undefined): UIMessage[] {
  return Array.isArray(messages) ? messages : []
}

type ChatMessageRow = {
  created_at: string
  message: UIMessage
  message_id: string
  role: string
  sort_order: number
}

export function deriveChatTitleFromMessages(messages: UIMessage[]): string {
  const firstUserText = messages
    .find((message) => message.role === "user")
    ?.parts.find((part) => part.type === "text" && part.text.trim().length > 0)

  if (!firstUserText || firstUserText.type !== "text") {
    return "New Chat"
  }

  const collapsed = firstUserText.text.replace(/\s+/g, " ").trim()
  return collapsed.length > 60 ? `${collapsed.slice(0, 57)}...` : collapsed
}

export async function createChatThread(userId: string, title?: string): Promise<ChatThread> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("chat_threads")
    .insert({
      user_id: userId,
      title: title?.trim() || "New Chat",
      messages: [],
    })
    .select("*")
    .single()

  if (error) {
    console.error("Error creating chat thread:", error)
    throw new Error(`Failed to create chat thread: ${error.message}`)
  }

  return {
    ...(data as Omit<ChatThread, "messages"> & { messages: UIMessage[] | null }),
    messages: normalizeMessages(data.messages as UIMessage[] | null),
  }
}

export async function getChatThreadById(threadId: string, userId: string): Promise<ChatThread | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("chat_threads")
    .select("*")
    .eq("id", threadId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    console.error("Error loading chat thread:", error)
    throw new Error(`Failed to load chat thread: ${error.message}`)
  }

  if (!data) {
    return null
  }

  const { data: messageRows, error: messagesError } = await supabase
    .from("chat_messages")
    .select("created_at, message, message_id, role, sort_order")
    .eq("thread_id", threadId)
    .order("sort_order", { ascending: true })

  if (messagesError) {
    console.error("Error loading chat messages:", messagesError)
    throw new Error(`Failed to load chat messages: ${messagesError.message}`)
  }

  const normalizedMessages =
    (messageRows as ChatMessageRow[] | null)?.map((row) => row.message) ??
    normalizeMessages(data.messages as UIMessage[] | null)

  return {
    ...(data as Omit<ChatThread, "messages"> & { messages: UIMessage[] | null }),
    messages: normalizedMessages,
  }
}

export async function listUserChatThreads(userId: string): Promise<ChatThreadListItem[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("chat_threads")
    .select("id, title, updated_at, source, automation_id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("Error listing chat threads:", error)
    throw new Error(`Failed to list chat threads: ${error.message}`)
  }

  return (data as ChatThreadListItem[] | null) ?? []
}

export async function updateChatThreadMessages(
  threadId: string,
  userId: string,
  messages: UIMessage[],
): Promise<void> {
  const supabase = await createClient()
  await replaceChatThreadMessages(supabase, threadId, userId, messages)
}

export async function replaceChatThreadMessages(
  supabase: SupabaseClient,
  threadId: string,
  userId: string,
  messages: UIMessage[],
): Promise<void> {
  const sanitized = sanitizeToolErrorPartsInMessages(messages)
  const nextMessages = sanitized.messages
  const title = deriveChatTitleFromMessages(nextMessages)

  const { error } = await supabase
    .from("chat_threads")
    .update({
      messages: nextMessages,
      title,
      updated_at: new Date().toISOString(),
    })
    .eq("id", threadId)
    .eq("user_id", userId)

  if (error) {
    console.error("Error updating chat thread:", error)
    throw new Error(`Failed to update chat thread: ${error.message}`)
  }

  const { error: deleteError } = await supabase
    .from("chat_messages")
    .delete()
    .eq("thread_id", threadId)

  if (deleteError) {
    console.error("Error clearing chat messages:", deleteError)
    throw new Error(`Failed to clear chat messages: ${deleteError.message}`)
  }

  if (messages.length === 0) {
    return
  }

  const { error: insertError } = await supabase
    .from("chat_messages")
    .insert(
      nextMessages.map((message, index) => ({
        thread_id: threadId,
        message_id: message.id,
        role: message.role,
        sort_order: index,
        message,
      })),
    )

  if (insertError) {
    console.error("Error inserting chat messages:", insertError)
    throw new Error(`Failed to insert chat messages: ${insertError.message}`)
  }
}
