"use client"

import * as React from "react"
import Image from "next/image"
import { FanvueAccountAvatar } from "@/components/content/active-account-switcher"
import { fanvueConnectionLabel } from "@/components/content/fanvue-account-display"
import type { FanvueConnectionItem } from "@/components/content/types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type FanvueAccountSelectProps = {
  connections: FanvueConnectionItem[]
  value: string
  onValueChange: (connection: FanvueConnectionItem) => void
  className?: string
  disabled?: boolean
}

export function FanvueAccountSelect({
  connections,
  value,
  onValueChange,
  className,
  disabled,
}: FanvueAccountSelectProps) {
  const selected = connections.find((connection) => connection.id === value) ?? connections[0]

  if (!selected) {
    return null
  }

  return (
    <Select
      value={value}
      onValueChange={(nextId) => {
        const next = connections.find((connection) => connection.id === nextId)
        if (next) onValueChange(next)
      }}
      disabled={disabled || connections.length <= 1}
    >
      <SelectTrigger className={cn("h-auto w-full py-2 pl-2", className)}>
        <span className="flex min-w-0 flex-1 items-center gap-3 pr-1">
          <FanvueAccountAvatar connection={selected} />
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-semibold text-foreground">
              {selected.displayName || fanvueConnectionLabel(selected)}
            </span>
            {selected.username ? (
              <span className="block truncate text-xs text-muted-foreground">@{selected.username}</span>
            ) : null}
          </span>
          <Image
            alt=""
            aria-hidden
            src="/brand_icons/fanvue_logo.png"
            width={16}
            height={16}
            className="shrink-0 opacity-80"
          />
        </span>
      </SelectTrigger>
      <SelectContent position="popper">
        {connections.map((connection) => (
          <SelectItem key={connection.id} value={connection.id} className="py-2">
            <span className="flex items-center gap-3">
              <FanvueAccountAvatar connection={connection} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {connection.displayName || fanvueConnectionLabel(connection)}
                </span>
                {connection.username ? (
                  <span className="block truncate text-xs text-muted-foreground">@{connection.username}</span>
                ) : null}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
