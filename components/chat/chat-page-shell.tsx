import Link from "next/link"
import { ClockCounterClockwise, NotePencil } from "@phosphor-icons/react/dist/ssr"
import { CreativeAgentChat } from "@/components/chat/creative-agent-chat"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/server"
import { listUserChatThreads, type ChatThreadListItem } from "@/lib/chat/database-server"
import type { UIMessage } from "ai"

function formatUpdatedAt(value: string) {
  const date = new Date(value)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) return "Just now"
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function SidebarThreadItem({
  currentThreadId,
  thread,
}: {
  currentThreadId?: string
  thread: ChatThreadListItem
}) {
  const isActive = currentThreadId === thread.id

  return (
    <Link
      href={`/chat/${thread.id}`}
      className={cn(
        "block rounded-2xl border px-3 py-3 transition-colors",
        isActive
          ? "border-primary/30 bg-primary/10"
          : "border-border/60 bg-background hover:bg-muted/40",
      )}
    >
      <p className="line-clamp-2 text-sm font-medium text-foreground">{thread.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{formatUpdatedAt(thread.updated_at)}</p>
    </Link>
  )
}

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
    <div className="flex h-dvh min-h-0 gap-3 bg-background pt-16 md:gap-4 md:pt-[60px]">
      {user ? (
        <aside className="hidden w-72 shrink-0 md:flex md:h-[calc(100dvh-60px-2rem)] md:min-h-0 md:ml-4 md:my-4 md:flex-col md:overflow-hidden md:rounded-[26px] md:border md:border-border/60 md:bg-background/95 md:shadow-2xl md:backdrop-blur">
          <div className="border-b border-border/60 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Chat History</p>
                <p className="text-xs text-muted-foreground">Your recent creative threads</p>
              </div>
              <Button asChild variant="outline" size="icon-sm">
                <Link href="/chat" aria-label="New chat">
                  <NotePencil className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {threads.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-center">
                <ClockCounterClockwise className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium">No threads yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Start a new chat to build your first thread.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {threads.map((thread) => (
                  <SidebarThreadItem
                    key={thread.id}
                    currentThreadId={currentThreadId}
                    thread={thread}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>
      ) : null}

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
