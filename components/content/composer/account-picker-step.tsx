"use client"

import * as React from "react"
import Image from "next/image"
import { UserRound } from "lucide-react"

import type { FanvueConnectionItem } from "@/components/content/types"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

type AccountPickerStepProps = {
  connections: FanvueConnectionItem[]
  onSelect: (connection: FanvueConnectionItem) => void
  onConnect: () => void
}

export function AccountPickerStep({ connections, onSelect, onConnect }: AccountPickerStepProps) {
  return (
    <div className="flex flex-col gap-4">
      {connections.length === 0 ? (
        <Empty className="p-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserRound />
            </EmptyMedia>
            <EmptyTitle>No Fanvue accounts connected</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" className="rounded-full" onClick={onConnect}>
              Connect Fanvue
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {connections.map((connection) => {
            const label = connection.username
              ? `@${connection.username}`
              : connection.displayName || "Fanvue account"
            return (
              <button
                key={connection.id}
                type="button"
                onClick={() => onSelect(connection)}
                className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/80 p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                {connection.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" src={connection.avatarUrl} className="h-12 w-12 rounded-2xl object-cover" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                    <UserRound className="h-5 w-5 text-muted-foreground" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {connection.displayName || label}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{label}</p>
                </div>
                <Image alt="" aria-hidden src="/brand_icons/fanvue_logo.png" width={20} height={20} className="ml-auto" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
