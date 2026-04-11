import { notFound, redirect } from "next/navigation"
import { ChatPageShell } from "@/components/chat/chat-page-shell"
import { getChatThreadById } from "@/lib/chat/database-server"
import { createClient } from "@/lib/supabase/server"

export default async function ChatThreadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const thread = await getChatThreadById(id, user.id)

  if (!thread) {
    notFound()
  }

  return <ChatPageShell currentThreadId={thread.id} initialMessages={thread.messages} />
}
