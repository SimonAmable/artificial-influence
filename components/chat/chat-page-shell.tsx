import { ChatSidebar } from "@/components/chat/chat-sidebar"
import { CreativeAgentChat } from "@/components/chat/creative-agent-chat"
import { createClient } from "@/lib/supabase/server"
import { listUserChatThreads } from "@/lib/chat/database-server"
import type { UIMessage } from "ai"

export async function ChatPageShell({
  currentThreadId,
  initialMessages,
}: {
  currentThreadId?: string
  initialMessages?: UIMessage[]
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const threads = user ? await listUserChatThreads(user.id) : []

  return (
    <div className="flex h-dvh min-h-0 bg-background pt-16 md:pt-[60px]">
      {user ? <ChatSidebar currentThreadId={currentThreadId} threads={threads} /> : null}

      <main className="min-w-0 flex-1">
        <CreativeAgentChat
          compact
          enablePersistence
          initialMessages={initialMessages}
          initialThreadId={currentThreadId}
          mobileThreads={user ? threads : undefined}
          syncUrlOnThreadCreate
        />
      </main>
    </div>
  )
}
