"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import type { UIMessage } from "ai"
import {
  ArrowSquareOut,
  CircleNotch,
  ClockCounterClockwise,
  NotePencil,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  clearStoredSidebarThreadId,
  getStoredSidebarThreadId,
  setStoredSidebarThreadId,
} from "@/lib/chat/client-storage"
import { UNICAN_ASSISTANT_NAME } from "@/lib/constants/system-prompts"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"

const SidebarCreativeAgentChat = dynamic(
  () => import("@/components/chat/creative-agent-chat").then((mod) => mod.CreativeAgentChat),
  { ssr: false },
)

export function AIChat() {
  const pathname = usePathname()

  if (pathname === "/chat" || pathname.startsWith("/chat/")) {
    return null
  }

  return <AIChatSidebar />
}

function AIChatSidebar() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [authReady, setAuthReady] = React.useState(false)
  const [userId, setUserId] = React.useState<string | null>(null)
  const [initialMessages, setInitialMessages] = React.useState<UIMessage[]>([])
  const [initialThreadId, setInitialThreadId] = React.useState<string | undefined>(undefined)
  const [isHydratingThread, setIsHydratingThread] = React.useState(false)
  const [hasHydratedStoredThread, setHasHydratedStoredThread] = React.useState(false)
  const [chatRenderKey, setChatRenderKey] = React.useState(0)
  const userIdRef = React.useRef<string | null>(null)

  /** When the sheet closes we clear hydration flags so the next open refetches DB (parent never receives live messages from the child). */
  const setSidebarOpen = React.useCallback((next: boolean) => {
    setOpen(next)
    if (!next) {
      setHasHydratedStoredThread(false)
      setIsHydratingThread(false)
    }
  }, [])

  React.useEffect(() => {
    const handleOpen = () => setSidebarOpen(true)

    window.addEventListener("chat-open", handleOpen as EventListener)

    return () => {
      window.removeEventListener("chat-open", handleOpen as EventListener)
    }
  }, [setSidebarOpen])

  React.useEffect(() => {
    if (!open) {
      return
    }

    const supabase = createSupabaseClient()

    let cancelled = false

    const syncAuthState = (nextUserId: string | null) => {
      const previousUserId = userIdRef.current

      userIdRef.current = nextUserId

      if (cancelled) return

      setUserId(nextUserId)
      setAuthReady(true)

      if (previousUserId !== nextUserId) {
        setInitialMessages([])
        setInitialThreadId(undefined)
        setChatRenderKey((value) => value + 1)
        setHasHydratedStoredThread(false)
        setIsHydratingThread(false)
      }
    }

    void supabase.auth
      .getUser()
      .then(({ data }) => syncAuthState(data.user?.id ?? null))
      .catch(() => syncAuthState(null))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      syncAuthState(session?.user?.id ?? null)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [open])

  React.useEffect(() => {
    if (!open || !authReady || !userId || hasHydratedStoredThread) {
      return
    }

    let cancelled = false

    const hydrateStoredThread = async () => {
      let markHydrated = true

      setIsHydratingThread(true)

      const storedThreadId = getStoredSidebarThreadId(userId)

      if (!storedThreadId) {
        if (!cancelled) {
          setHasHydratedStoredThread(true)
          setIsHydratingThread(false)
        }
        return
      }

      try {
        const response = await fetch(`/api/chat/threads/${storedThreadId}`, {
          credentials: "include",
        })

        if (!response.ok) {
          if (response.status === 401 || response.status === 404) {
            clearStoredSidebarThreadId(userId)
          } else {
            markHydrated = false
          }

          if (!cancelled) {
            setInitialMessages([])
            setInitialThreadId(undefined)
            setChatRenderKey((value) => value + 1)
          }
          return
        }

        const data = await response.json()

        if (cancelled) return

        setInitialMessages(Array.isArray(data.thread?.messages) ? data.thread.messages : [])
        setInitialThreadId(typeof data.thread?.id === "string" ? data.thread.id : undefined)
        setChatRenderKey((value) => value + 1)
      } catch {
        markHydrated = false

        if (!cancelled) {
          setInitialMessages([])
          setInitialThreadId(undefined)
          setChatRenderKey((value) => value + 1)
        }
      } finally {
        if (!cancelled) {
          setHasHydratedStoredThread(markHydrated)
          setIsHydratingThread(false)
        }
      }
    }

    void hydrateStoredThread()

    return () => {
      cancelled = true
    }
  }, [authReady, hasHydratedStoredThread, open, userId])

  const handleThreadIdChange = React.useCallback((threadId: string | undefined) => {
    const userId = userIdRef.current

    setInitialThreadId(threadId)
    setHasHydratedStoredThread(true)

    if (!userId) {
      return
    }

    if (threadId) {
      setStoredSidebarThreadId(userId, threadId)
      return
    }

    setInitialMessages([])
    clearStoredSidebarThreadId(userId)
  }, [])

  const handleNewChat = React.useCallback(() => {
    const userId = userIdRef.current

    if (userId) {
      clearStoredSidebarThreadId(userId)
    }

    setInitialMessages([])
    setInitialThreadId(undefined)
    setHasHydratedStoredThread(true)
    setChatRenderKey((value) => value + 1)
    setSidebarOpen(true)
  }, [setSidebarOpen])

  const handleOpenFullChat = React.useCallback(() => {
    setSidebarOpen(false)
    router.push(initialThreadId ? `/chat/${initialThreadId}` : "/chat")
  }, [initialThreadId, router, setSidebarOpen])

  const handleOpenHistory = React.useCallback(() => {
    setSidebarOpen(false)
    router.push("/chat")
  }, [router, setSidebarOpen])

  return (
    <>
      {!open ? (
        <Button
          onClick={() => setSidebarOpen(true)}
          className="fixed right-6 bottom-6 z-60 h-14 w-14 rounded-full shadow-depth-l"
          size="icon"
        >
          <Image src="/logo.svg" alt="" width={22} height={22} className="dark:invert" />
        </Button>
      ) : null}

      <Sheet open={open} onOpenChange={setSidebarOpen}>
        {open ? (
          <SheetContent
            side="right"
            className="flex h-full w-full max-w-[540px] flex-col overflow-hidden p-0"
          >
            <SheetHeader className="gap-2 border-b border-border/60 px-4 py-4 pr-14 text-left">
              <div className="flex items-center justify-between gap-3">
                <SheetTitle className="flex min-w-0 items-center gap-2 text-base">
                  <span className="flex size-5 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted/40">
                    <Image
                      src="/logo.svg"
                      alt="Website AI"
                      width={12}
                      height={12}
                      className="dark:invert"
                    />
                  </span>
                  <span className="truncate">{UNICAN_ASSISTANT_NAME}</span>
                </SheetTitle>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full"
                        onClick={handleNewChat}
                        aria-label="New chat"
                      >
                        <NotePencil className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={8}>New chat</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full"
                        onClick={handleOpenFullChat}
                        aria-label="Open current chat in full page"
                      >
                        <ArrowSquareOut className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={8}>Open current chat</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full"
                        onClick={handleOpenHistory}
                        aria-label="Open chat history"
                        disabled={!authReady || !userId}
                      >
                        <ClockCounterClockwise className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={8}>Chat history</TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <SheetDescription>Your AI assistant for website tasks.</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-hidden">
              {!authReady || isHydratingThread ? (
                <div className="flex h-full items-center justify-center gap-2 px-4 text-sm text-muted-foreground">
                  <CircleNotch className="h-4 w-4 animate-spin" />
                  Restoring your chat...
                </div>
              ) : (
                <SidebarCreativeAgentChat
                  key={chatRenderKey}
                  compact
                  enablePersistence
                  initialMessages={initialMessages}
                  initialThreadId={initialThreadId}
                  onThreadIdChange={handleThreadIdChange}
                />
              )}
            </div>
          </SheetContent>
        ) : null}
      </Sheet>
    </>
  )
}
