"use client"

import * as React from "react"
import Link from "next/link"
import {
  Books,
  CaretDoubleLeft,
  CaretDoubleRight,
  ClockClockwise,
  ChatCircleDots,
  ClockCounterClockwise,
  HandTap,
  NotePencil,
  Robot,
} from "@phosphor-icons/react"

import { NewChatButton } from "@/components/chat/new-chat-button"
import { SidebarSkillButton } from "@/components/chat/sidebar-skill-button"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ChatThreadListItem } from "@/lib/chat/database-server"
import { cn } from "@/lib/utils"

const SIDEBAR_THREAD_LIMIT = 8

function formatCompactUpdatedAt(value: string) {
  const date = new Date(value)
  const now = new Date()
  const diffMs = Math.max(0, now.getTime() - date.getTime())
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) return "now"
  if (diffMinutes < 60) return `${diffMinutes}m`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d`

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function openSkillPicker() {
  window.dispatchEvent(new CustomEvent("chat-open-skill-picker"))
}

function IconTooltip({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function SidebarActionLink({
  children,
  href,
  icon,
}: {
  children: React.ReactNode
  href: string
  icon: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-foreground/90 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {icon}
      <span className="truncate">{children}</span>
    </Link>
  )
}

function getAutomationRunLabel(thread: ChatThreadListItem) {
  if (thread.source !== "automation") {
    return null
  }

  if (thread.automation_trigger === "manual") {
    return "Manual automation run"
  }

  if (thread.automation_trigger === "scheduled") {
    return "Scheduled automation run"
  }

  return "Automation run"
}

function AutomationRunIndicator({ thread }: { thread: ChatThreadListItem }) {
  const label = getAutomationRunLabel(thread)

  if (!label) {
    return null
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="flex shrink-0 items-center gap-0.5 text-muted-foreground"
          aria-label={label}
        >
          <Robot className="size-3.5" aria-hidden />
          {thread.automation_trigger === "manual" ? (
            <HandTap className="size-3.5" aria-hidden />
          ) : null}
          {thread.automation_trigger === "scheduled" ? (
            <ClockClockwise className="size-3.5" aria-hidden />
          ) : null}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
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
        "flex min-h-8 items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-muted text-foreground"
          : "text-foreground/85 hover:bg-muted/70 hover:text-foreground",
      )}
    >
      <AutomationRunIndicator thread={thread} />
      <span className="min-w-0 flex-1 truncate font-medium">{thread.title}</span>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {formatCompactUpdatedAt(thread.updated_at)}
      </span>
    </Link>
  )
}

function CollapsedHistoryMenu({
  currentThreadId,
  threads,
}: {
  currentThreadId?: string
  threads: ChatThreadListItem[]
}) {
  return (
    <DropdownMenu>
      <IconTooltip label="Chat history">
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Chat history"
            className="rounded-md"
          >
            <ClockCounterClockwise className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
      </IconTooltip>
      <DropdownMenuContent align="start" side="right" className="w-80">
        <DropdownMenuLabel className="font-normal">Chats</DropdownMenuLabel>
        {threads.length === 0 ? (
          <div className="px-3 py-3 text-sm text-muted-foreground">No chats yet</div>
        ) : (
          threads.map((thread) => {
            const isActive = currentThreadId === thread.id
            return (
              <DropdownMenuItem key={thread.id} asChild>
                <Link
                  href={`/chat/${thread.id}`}
                  className={cn("flex w-full items-center gap-2", isActive && "bg-muted")}
                >
                  <AutomationRunIndicator thread={thread} />
                  <span className="min-w-0 flex-1 truncate">{thread.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatCompactUpdatedAt(thread.updated_at)}
                  </span>
                </Link>
              </DropdownMenuItem>
            )
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ChatSidebar({
  currentThreadId,
  threads,
}: {
  currentThreadId?: string
  threads: ChatThreadListItem[]
}) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [showAllThreads, setShowAllThreads] = React.useState(false)
  const sidebarThreads = showAllThreads ? threads : threads.slice(0, SIDEBAR_THREAD_LIMIT)
  const hiddenThreadCount = Math.max(0, threads.length - sidebarThreads.length)

  return (
    <aside
      className={cn(
        "hidden shrink-0 border-r border-border/60 bg-background text-foreground transition-[width] duration-200 md:flex md:h-[calc(100dvh-60px)] md:min-h-0 md:flex-col",
        collapsed ? "w-14" : "w-[292px]",
      )}
    >
      {collapsed ? (
        <div className="flex flex-col items-center gap-1.5 px-2 py-3">
          <IconTooltip label="Expand sidebar">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-md"
              aria-label="Expand sidebar"
              onClick={() => setCollapsed(false)}
            >
              <CaretDoubleRight className="size-4" aria-hidden />
            </Button>
          </IconTooltip>
          <div className="my-1 h-px w-full bg-border/60" aria-hidden />
          <CollapsedHistoryMenu currentThreadId={currentThreadId} threads={sidebarThreads} />
          <IconTooltip label="New chat">
            <NewChatButton
              variant="ghost"
              size="icon-sm"
              className="rounded-md"
              aria-label="New chat"
            >
              <NotePencil className="size-4" aria-hidden />
            </NewChatButton>
          </IconTooltip>
          <IconTooltip label="Automations">
            <Button asChild variant="ghost" size="icon-sm" className="rounded-md">
              <Link href="/automations" aria-label="Automations">
                <Robot className="size-4" aria-hidden />
              </Link>
            </Button>
          </IconTooltip>
          <IconTooltip label="Skills">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-md"
              aria-label="Skills"
              onClick={openSkillPicker}
            >
              <Books className="size-4" aria-hidden />
            </Button>
          </IconTooltip>
        </div>
      ) : (
        <>
          <div className="space-y-1 px-3 py-3">
            <div className="flex items-center gap-1">
              <NewChatButton
                variant="ghost"
                className="h-9 min-w-0 flex-1 justify-start gap-3 rounded-md px-3 text-foreground/90 hover:bg-muted hover:text-foreground"
              >
                <NotePencil className="size-4 shrink-0" aria-hidden />
                <span className="truncate">New chat</span>
              </NewChatButton>
              <IconTooltip label="Collapse sidebar">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-md"
                  aria-label="Collapse sidebar"
                  onClick={() => setCollapsed(true)}
                >
                  <CaretDoubleLeft className="size-4" aria-hidden />
                </Button>
              </IconTooltip>
            </div>
            <SidebarActionLink
              href="/automations"
              icon={<Robot className="size-4 shrink-0" aria-hidden />}
            >
              Automations
            </SidebarActionLink>
            <SidebarSkillButton />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-7">
            <div className="mb-3 flex items-center justify-between px-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Chats</p>
              <ChatCircleDots className="size-3.5 text-muted-foreground" aria-hidden />
            </div>

            {sidebarThreads.length === 0 ? (
              <div className="px-3 py-5 text-sm text-muted-foreground">
                <ClockCounterClockwise className="mb-2 size-4" aria-hidden />
                <p>No chats yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {sidebarThreads.map((thread) => (
                  <SidebarThreadItem
                    key={thread.id}
                    currentThreadId={currentThreadId}
                    thread={thread}
                  />
                ))}
                {hiddenThreadCount > 0 ? (
                  <button
                    type="button"
                    className="mt-1 rounded-md px-3 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setShowAllThreads(true)}
                  >
                    Show more
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  )
}
