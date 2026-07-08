"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { ProductLogo } from "@/components/product/product-logo"
import { usePathname, useRouter } from "next/navigation"
import type { UIMessage } from "ai"
import {
  ArrowSquareOut,
  CircleNotch,
  ClockCounterClockwise,
  NotePencil,
  XIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
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

const DESKTOP_CHAT_PANEL_WIDTH_PX = 384
const DESKTOP_CHAT_DOCK_PADDING_PX = 12
const DESKTOP_CHAT_SLOT_WIDTH_PX =
  DESKTOP_CHAT_PANEL_WIDTH_PX + DESKTOP_CHAT_DOCK_PADDING_PX * 2

function AIChatPanelShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl bg-background shadow-depth-m",
        className,
      )}
    >
      {children}
    </div>
  )
}

function AIChatPanelBody({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}>
      {children}
    </div>
  )
}

type AIChatContextValue = {
  open: boolean
  isMobile: boolean
  setSidebarOpen: (next: boolean) => void
  hideOnChatPage: boolean
  hideFloatingChatLauncher: boolean
  panelBody: React.ReactNode
  /** Viewport inset (px) for fixed bottom UI when the desktop chat dock is open. */
  dockInsetRight: number
}

const AIChatContext = React.createContext<AIChatContextValue | null>(null)

function useAIChatContext() {
  const context = React.useContext(AIChatContext)

  if (!context) {
    throw new Error("useAIChatContext must be used within AIChatProvider")
  }

  return context
}

/** Right inset (px) for fixed bottom panels so they stay clear of the desktop chat dock. */
export function useAIChatDockInsetRight() {
  return useAIChatContext().dockInsetRight
}

function useAIChatSidebarHidden(pathname: string | null) {
  return pathname === "/chat" || (pathname?.startsWith("/chat/") ?? false)
}

function useHideFloatingChatLauncher(pathname: string | null) {
  return (
    pathname === "/image-editor" ||
    pathname === "/inpaint" ||
    (pathname?.startsWith("/image-editor/") ?? false)
  )
}

export function AIChatProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isMobile = useIsMobile()
  const hideOnChatPage = useAIChatSidebarHidden(pathname)
  const hideFloatingChatLauncher = useHideFloatingChatLauncher(pathname)
  const [open, setOpen] = React.useState(false)
  const [authReady, setAuthReady] = React.useState(false)
  const [userId, setUserId] = React.useState<string | null>(null)
  const [initialMessages, setInitialMessages] = React.useState<UIMessage[]>([])
  const [initialThreadId, setInitialThreadId] = React.useState<string | undefined>(undefined)
  const [isHydratingThread, setIsHydratingThread] = React.useState(false)
  const [hasHydratedStoredThread, setHasHydratedStoredThread] = React.useState(false)
  const [chatRenderKey, setChatRenderKey] = React.useState(0)
  const userIdRef = React.useRef<string | null>(null)

  const setSidebarOpen = React.useCallback((next: boolean) => {
    setOpen(next)
    if (!next) {
      setHasHydratedStoredThread(false)
      setIsHydratingThread(false)
    }
  }, [])

  const toggleSidebarOpen = React.useCallback(() => {
    setOpen((prev) => {
      const next = !prev
      if (!next) {
        setHasHydratedStoredThread(false)
        setIsHydratingThread(false)
      }
      return next
    })
  }, [])

  React.useEffect(() => {
    if (hideOnChatPage) {
      return
    }

    const dockedWidth = !isMobile && open ? DESKTOP_CHAT_SLOT_WIDTH_PX : 0

    window.dispatchEvent(
      new CustomEvent("chat-visibility", {
        detail: { open, docked: !isMobile, width: dockedWidth },
      }),
    )
  }, [hideOnChatPage, isMobile, open])

  React.useEffect(() => {
    const handleOpen = () => setSidebarOpen(true)
    const handleToggle = () => toggleSidebarOpen()

    window.addEventListener("chat-open", handleOpen as EventListener)
    window.addEventListener("chat-toggle", handleToggle as EventListener)

    return () => {
      window.removeEventListener("chat-open", handleOpen as EventListener)
      window.removeEventListener("chat-toggle", handleToggle as EventListener)
    }
  }, [setSidebarOpen, toggleSidebarOpen])

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

  const panelBody = (
    <AIChatPanelBody>
      <AIChatPanelHeader
        authReady={authReady}
        userId={userId}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        onOpenFullChat={handleOpenFullChat}
        onOpenHistory={handleOpenHistory}
        useSheetPrimitives={isMobile}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
    </AIChatPanelBody>
  )

  const dockInsetRight =
    hideOnChatPage || isMobile || !open ? 0 : DESKTOP_CHAT_SLOT_WIDTH_PX

  const contextValue = React.useMemo<AIChatContextValue>(
    () => ({
      open,
      isMobile,
      setSidebarOpen,
      hideOnChatPage,
      hideFloatingChatLauncher,
      panelBody,
      dockInsetRight,
    }),
    [
      dockInsetRight,
      hideFloatingChatLauncher,
      hideOnChatPage,
      isMobile,
      open,
      panelBody,
      setSidebarOpen,
    ],
  )

  return (
    <AIChatContext.Provider value={contextValue}>
      {children}
      {!hideOnChatPage ? <AIChatLauncher /> : null}
      {!hideOnChatPage ? <AIChatMobileSheet /> : null}
    </AIChatContext.Provider>
  )
}

export function AIChatDesktopDock() {
  const { open, isMobile, hideOnChatPage, panelBody } = useAIChatContext()

  if (hideOnChatPage || isMobile || !open) {
    return null
  }

  return (
    <aside
      aria-label={`${UNICAN_ASSISTANT_NAME} chat`}
      className="sticky top-[52px] box-border flex h-[calc(100dvh-52px)] shrink-0 flex-col p-3"
      style={{ width: DESKTOP_CHAT_SLOT_WIDTH_PX }}
    >
      <AIChatPanelShell>{panelBody}</AIChatPanelShell>
    </aside>
  )
}

function AIChatLauncher() {
  const { open, hideFloatingChatLauncher, setSidebarOpen } = useAIChatContext()

  if (open || hideFloatingChatLauncher) {
    return null
  }

  return (
    <Button
      onClick={() => setSidebarOpen(true)}
      className="fixed right-6 bottom-6 z-60 h-14 w-14 rounded-full shadow-depth-l"
      size="icon"
    >
      <ProductLogo size={22} alt="" />
    </Button>
  )
}

function AIChatMobileSheet() {
  const { open, isMobile, setSidebarOpen, panelBody } = useAIChatContext()

  if (!isMobile) {
    return null
  }

  return (
    <Sheet open={open} onOpenChange={setSidebarOpen}>
      {open ? (
        <SheetContent
          side="right"
          showCloseButton={false}
          className="flex h-full w-full max-w-none flex-col overflow-visible border-0 bg-transparent p-3 shadow-none data-[side=right]:w-full sm:max-w-none"
        >
          <AIChatPanelShell>{panelBody}</AIChatPanelShell>
        </SheetContent>
      ) : null}
    </Sheet>
  )
}

/** @deprecated Use AIChatProvider + AIChatDesktopDock in layout instead. */
export function AIChat() {
  return null
}

type AIChatPanelHeaderProps = {
  authReady: boolean
  userId: string | null
  onClose: () => void
  onNewChat: () => void
  onOpenFullChat: () => void
  onOpenHistory: () => void
  useSheetPrimitives: boolean
}

function AIChatPanelHeader({
  authReady,
  userId,
  onClose,
  onNewChat,
  onOpenFullChat,
  onOpenHistory,
  useSheetPrimitives,
}: AIChatPanelHeaderProps) {
  const headerClassName =
    "flex shrink-0 items-center gap-2 border-b border-border/50 px-3 py-2.5 sm:px-4 sm:py-3"
  const titleClassName =
    "flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-foreground sm:text-base"

  const titleContent = (
    <>
      <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted/40">
        <ProductLogo size={14} alt="Website AI" />
      </span>
      <span className="truncate">{UNICAN_ASSISTANT_NAME}</span>
    </>
  )

  const toolbarButtons = (
    <div className="flex shrink-0 items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            onClick={onNewChat}
            aria-label="New chat"
          >
            <NotePencil className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>
          New chat
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            onClick={onOpenFullChat}
            aria-label="Open current chat in full page"
          >
            <ArrowSquareOut className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>
          Open current chat
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            onClick={onOpenHistory}
            aria-label="Open chat history"
            disabled={!authReady || !userId}
          >
            <ClockCounterClockwise className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>
          Chat history
        </TooltipContent>
      </Tooltip>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        onClick={onClose}
        aria-label="Close chat"
      >
        <XIcon className="h-4 w-4" />
      </Button>
    </div>
  )

  if (useSheetPrimitives) {
    return (
      <SheetHeader className={cn("flex-row p-0 text-left", headerClassName)}>
        <SheetTitle className={titleClassName}>{titleContent}</SheetTitle>
        {toolbarButtons}
      </SheetHeader>
    )
  }

  return (
    <div className={headerClassName}>
      <h2 className={titleClassName}>{titleContent}</h2>
      {toolbarButtons}
    </div>
  )
}
