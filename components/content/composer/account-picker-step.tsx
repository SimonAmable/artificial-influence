"use client"

import * as React from "react"
import Image from "next/image"
import { UserRound } from "lucide-react"

import type { FanvueConnectionItem } from "@/components/content/types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AccountPickerStepProps = {
  connections: FanvueConnectionItem[]
  onSelect: (connection: FanvueConnectionItem) => void
  onConnect: () => void
}

export function AccountPickerStep({ connections, onSelect, onConnect }: AccountPickerStepProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">Where should this post go?</h3>
        <p className="text-sm text-muted-foreground">Pick the Fanvue account for this post.</p>
      </div>

      {connections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">No Fanvue accounts connected</p>
          <Button type="button" className="mt-4 rounded-full" onClick={onConnect}>
            Connect Fanvue
          </Button>
        </div>
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
                <Image alt="" aria-hidden src="/brand_icons/fanvue-icon.svg" width={20} height={20} className="ml-auto" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
