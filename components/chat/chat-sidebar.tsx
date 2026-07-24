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
  Stack,
} from "@phosphor-icons/react"

import { NewChatButton } from "@/components/chat/new-chat-button"
import { SidebarSkillButton } from "@/components/chat/sidebar-skill-button"
import { Badge } from "@/components/ui/badge"
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
  badge,
  children,
  href,
  icon,
}: {
  badge?: React.ReactNode
  children: React.ReactNode
  href: string
  icon: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex h-9 items-center gap-3 rounded-full px-3 text-sm font-medium text-foreground/90 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {badge}
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
        "flex min-h-8 items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-muted text-foreground"
          : "text-foreground/85 hover:bg-muted/70 hover:text-foreground",
      )}
    >
      <span className="min-w-0 flex-1 truncate font-medium">{thread.title}</span>
      <AutomationRunIndicator thread={thread} />
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
            className="rounded-full"
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
                  <span className="min-w-0 flex-1 truncate">{thread.title}</span>
                  <AutomationRunIndicator thread={thread} />
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
  const [collapsed, setCollapsed] = React.useState(true)
  const [showAllThreads, setShowAllThreads] = React.useState(false)
  const sidebarThreads = showAllThreads ? threads : threads.slice(0, SIDEBAR_THREAD_LIMIT)
  const hiddenThreadCount = Math.max(0, threads.length - sidebarThreads.length)

  return (
    <div
      className={cn(
        "hidden h-full min-h-0 shrink-0 overflow-hidden md:flex",
        "transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        collapsed ? "w-14" : "w-[292px]",
      )}
    >
      <aside
        className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[22px] border border-black/10 bg-background/95 text-foreground shadow-md backdrop-blur-sm dark:border-border/60"
        data-state={collapsed ? "closed" : "open"}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-1.5 px-2 py-3 animate-in fade-in-0 slide-in-from-left-2 duration-300">
            <IconTooltip label="Expand sidebar">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                aria-label="Expand sidebar"
                onClick={() => setCollapsed(false)}
              >
                <CaretDoubleRight className="size-4" aria-hidden />
              </Button>
            </IconTooltip>
            <CollapsedHistoryMenu currentThreadId={currentThreadId} threads={sidebarThreads} />
            <IconTooltip label="New chat">
              <NewChatButton
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                aria-label="New chat"
              >
                <NotePencil className="size-4" aria-hidden />
              </NewChatButton>
            </IconTooltip>
            <IconTooltip label="Automations">
              <Button asChild variant="ghost" size="icon-sm" className="rounded-full">
                <Link href="/automations" aria-label="Automations">
                  <Robot className="size-4" aria-hidden />
                </Link>
              </Button>
            </IconTooltip>
            <IconTooltip label="Templates (new)">
              <Button asChild variant="ghost" size="icon-sm" className="rounded-full">
                <Link href="/templates" aria-label="Templates">
                  <Stack className="size-4" aria-hidden />
                </Link>
              </Button>
            </IconTooltip>
            <IconTooltip label="Skills">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                aria-label="Skills"
                onClick={openSkillPicker}
              >
                <Books className="size-4" aria-hidden />
              </Button>
            </IconTooltip>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col animate-in fade-in-0 slide-in-from-left-2 duration-300">
            <div className="space-y-1 px-3 py-3">
              <div className="flex items-center gap-1">
                <NewChatButton
                  variant="ghost"
                  className="h-9 min-w-0 flex-1 justify-start gap-3 rounded-full px-3 text-foreground/90 hover:bg-muted hover:text-foreground"
                >
                  <NotePencil className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">New chat</span>
                </NewChatButton>
                <IconTooltip label="Collapse sidebar">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full"
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
              <SidebarActionLink
                href="/templates"
                icon={<Stack className="size-4 shrink-0" aria-hidden />}
                badge={
                  <Badge
                    variant="secondary"
                    className="h-5 rounded-full px-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                  >
                    New
                  </Badge>
                }
              >
                Templates
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
                      className="mt-1 rounded-full px-3 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setShowAllThreads(true)}
                    >
                      Show more
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
