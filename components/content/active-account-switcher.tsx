"use client"

import * as React from "react"
import Image from "next/image"
import { Check, ChevronDown, Loader2, Settings2, UserRound } from "lucide-react"

import { fanvueConnectionLabel, fanvueConnectionShortLabel } from "@/components/content/fanvue-account-display"
import type { FanvueConnectionItem } from "@/components/content/types"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type FanvueAccountAvatarProps = {
  connection: FanvueConnectionItem
  size?: "sm" | "md"
}

export function FanvueAccountAvatar({ connection, size = "md" }: FanvueAccountAvatarProps) {
  const sizeClass = size === "sm" ? "h-6 w-6 rounded-md" : "h-8 w-8 rounded-lg"

  if (connection.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt="" src={connection.avatarUrl} className={cn(sizeClass, "shrink-0 object-cover")} />
    )
  }

  return (
    <span className={cn("flex shrink-0 items-center justify-center bg-muted", sizeClass)}>
      <UserRound className={cn("text-muted-foreground", size === "sm" ? "h-3 w-3" : "h-4 w-4")} />
    </span>
  )
}

type ActiveAccountSwitcherProps = {
  connections: FanvueConnectionItem[]
  selectedConnectionId: string | null
  onSelectConnection: (connectionId: string) => void
  onConnect: () => void
  onManageAccounts: () => void
  isLoading?: boolean
}

export function ActiveAccountSwitcher({
  connections,
  selectedConnectionId,
  onSelectConnection,
  onConnect,
  onManageAccounts,
  isLoading,
}: ActiveAccountSwitcherProps) {
  const selected =
    connections.find((connection) => connection.id === selectedConnectionId) ?? connections[0] ?? null

  if (isLoading) {
    return (
      <Button type="button" variant="outline" className="rounded-full" disabled>
        <Loader2 className="h-4 w-4 animate-spin" data-icon="inline-start" />
        Loading accounts...
      </Button>
    )
  }

  if (!selected) {
    return (
      <Button type="button" variant="outline" className="rounded-full" onClick={onConnect}>
        <UserRound data-icon="inline-start" />
        Connect account
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="max-w-[240px] rounded-full pl-1.5">
          <FanvueAccountAvatar connection={selected} size="sm" />
          <span className="min-w-0 truncate">{fanvueConnectionShortLabel(selected)}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[280px]">
        {connections.map((connection) => {
          const isActive = connection.id === selected.id
          return (
            <DropdownMenuItem
              key={connection.id}
              className="flex items-center gap-3 py-2"
              onClick={() => onSelectConnection(connection.id)}
            >
              <FanvueAccountAvatar connection={connection} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {connection.displayName || fanvueConnectionLabel(connection)}
                </span>
                {connection.username ? (
                  <span className="block truncate text-xs text-muted-foreground">@{connection.username}</span>
                ) : null}
              </span>
              {isActive ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2" onClick={onConnect}>
          <Image alt="" aria-hidden src="/brand_icons/fanvue_logo.png" width={16} height={16} className="rounded-sm" />
          Connect another account
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onClick={onManageAccounts}>
          <Settings2 className="h-4 w-4" />
          Manage accounts
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
