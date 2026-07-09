"use client"

import * as React from "react"
import Image from "next/image"
import { Loader2, UserRound } from "lucide-react"
import { toast } from "sonner"

import type { FanvueConnectionItem } from "@/components/content/types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const FANVUE_GREEN_BUTTON_CLASS =
  "bg-[#C6FF00] text-black hover:bg-[#b8f000] dark:bg-[#C6FF00] dark:text-black dark:hover:bg-[#b8f000]"

type AccountsStripProps = {
  connections: FanvueConnectionItem[]
  selectedConnectionId: string | null
  onSelectConnection: (connectionId: string) => void
  isLoading?: boolean
  onRefresh: () => void
  hideActions?: boolean
  variant?: "card" | "dialog"
}

export function ContentAccountsStrip({
  connections,
  selectedConnectionId,
  onSelectConnection,
  isLoading,
  onRefresh,
  hideActions = false,
  variant = "card",
}: AccountsStripProps) {
  const [isDisconnecting, setIsDisconnecting] = React.useState(false)

  const handleConnect = () => {
    window.location.href = "/api/fanvue/connect?next=/content"
  }

  const handleDisconnect = async (connectionId: string) => {
    setIsDisconnecting(true)
    try {
      const response = await fetch("/api/fanvue/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Could not disconnect Fanvue.")
      }
      toast.success("Fanvue account disconnected.")
      onRefresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect Fanvue.")
    } finally {
      setIsDisconnecting(false)
    }
  }

  const content = (
    <>
      {variant === "card" ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">Accounts</h2>
            <p className="text-sm text-muted-foreground">
              {connections.length > 0
                ? "Choose which Fanvue account your library and posts use."
                : "Connect Fanvue to upload media, organize your vault, and schedule posts."}
            </p>
          </div>
          {!hideActions ? (
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onRefresh}>
                Refresh
              </Button>
              <Button
                type="button"
                size="sm"
                className={cn("rounded-full", FANVUE_GREEN_BUTTON_CLASS)}
                onClick={handleConnect}
              >
                <Image alt="" aria-hidden src="/brand_icons/fanvue_logo.png" width={16} height={16} className="rounded-sm" />
                Connect Fanvue
              </Button>
            </div>
          ) : null}
        </div>
      ) : !hideActions ? (
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onRefresh}>
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            className={cn("rounded-full", FANVUE_GREEN_BUTTON_CLASS)}
            onClick={handleConnect}
          >
            <Image alt="" aria-hidden src="/brand_icons/fanvue_logo.png" width={16} height={16} className="rounded-sm" />
            Connect Fanvue
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading accounts...
        </div>
      ) : connections.length === 0 ? (
        <button
          type="button"
          onClick={handleConnect}
          className="flex w-full items-center justify-between rounded-2xl border border-dashed border-border/80 bg-background/60 px-4 py-5 text-left transition-colors hover:border-primary/40 hover:bg-muted/20"
        >
          <div>
            <p className="text-sm font-semibold text-foreground">Connect Fanvue</p>
            <p className="text-xs text-muted-foreground">Add your creator account to get started.</p>
          </div>
          <Image alt="" aria-hidden src="/brand_icons/fanvue_logo.png" width={28} height={28} className="rounded-md" />
        </button>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {connections.map((connection) => {
            const selected = connection.id === selectedConnectionId
            const label = connection.username
              ? `@${connection.username}`
              : connection.displayName || "Fanvue account"
            return (
              <article
                key={connection.id}
                className={cn(
                  "flex min-w-[220px] flex-col rounded-2xl border p-4 transition-colors",
                  selected ? "border-primary bg-primary/5" : "border-border/70 bg-background/80"
                )}
              >
                <button
                  type="button"
                  className="flex flex-1 items-start gap-3 text-left"
                  onClick={() => onSelectConnection(connection.id)}
                >
                  {connection.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt=""
                      src={connection.avatarUrl}
                      className="h-12 w-12 rounded-2xl object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                      <UserRound className="h-5 w-5 text-muted-foreground" />
                    </span>
                  )}
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {connection.displayName || label}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{label}</p>
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Connected
                    </span>
                  </div>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-3 h-8 rounded-full"
                  disabled={isDisconnecting}
                  onClick={() => void handleDisconnect(connection.id)}
                >
                  Disconnect
                </Button>
              </article>
            )
          })}
        </div>
      )}
    </>
  )

  if (variant === "dialog") {
    return <div className="space-y-3">{content}</div>
  }

  return (
    <section className="space-y-3 rounded-[28px] border border-border/70 bg-muted/10 p-4">
      {content}
    </section>
  )
}
