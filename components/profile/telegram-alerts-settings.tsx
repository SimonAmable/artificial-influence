"use client"

import * as React from "react"
import { CircleNotch, PaperPlaneTilt } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type TelegramStatusResponse = {
  connected?: boolean
  error?: string
}

type TelegramConnectResponse = {
  deepLink?: string
  error?: string
}

export type TelegramAlertsSettingsProps = {
  variant?: "modal"
}

export function TelegramAlertsSettings({ variant = "modal" }: TelegramAlertsSettingsProps) {
  const isModal = variant === "modal"
  const [loading, setLoading] = React.useState(true)
  const [connecting, setConnecting] = React.useState(false)
  const [disconnecting, setDisconnecting] = React.useState(false)
  const [connected, setConnected] = React.useState(false)

  const refreshStatus = React.useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/telegram/status", { cache: "no-store" })
      const data = (await response.json()) as TelegramStatusResponse
      if (!response.ok) {
        throw new Error(data.error || "Failed to load Telegram status.")
      }
      setConnected(data.connected === true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load Telegram status.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  const handleConnect = React.useCallback(async () => {
    setConnecting(true)
    try {
      const response = await fetch("/api/telegram/connect", { cache: "no-store" })
      const data = (await response.json()) as TelegramConnectResponse
      if (!response.ok || !data.deepLink) {
        throw new Error(data.error || "Could not start Telegram linking.")
      }

      window.open(data.deepLink, "_blank", "noopener,noreferrer")
      toast.message("Finish linking in Telegram", {
        description: "Tap Start in the bot chat, then return here.",
      })

      window.setTimeout(() => {
        void refreshStatus()
      }, 4000)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start Telegram linking.")
    } finally {
      setConnecting(false)
    }
  }, [refreshStatus])

  const handleDisconnect = React.useCallback(async () => {
    setDisconnecting(true)
    try {
      const response = await fetch("/api/telegram/status", { method: "POST" })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to disconnect Telegram.")
      }
      setConnected(false)
      toast.success("Telegram alerts turned off.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disconnect Telegram.")
    } finally {
      setDisconnecting(false)
    }
  }, [])

  return (
    <section className={cn("space-y-4 rounded-2xl border border-border/60 bg-muted/15 p-4 sm:p-5", isModal && "min-w-0")}>
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <PaperPlaneTilt className="size-5" weight="fill" />
        </div>
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold tracking-tight text-foreground">Telegram generation alerts</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Connect Telegram to get a message with a link when async generations finish. Disconnect anytime to turn alerts off.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleNotch className="size-4 animate-spin" />
          Loading Telegram status...
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">
              {connected ? "Alerts on" : "Alerts off"}
            </p>
            <p className="text-xs text-muted-foreground">
              {connected
                ? "Send /disconnect in the bot chat to unlink from Telegram."
                : "One-time connect flow via the Telegram bot."}
            </p>
          </div>
          {connected ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={disconnecting}
              onClick={() => void handleDisconnect()}
            >
              {disconnecting ? <CircleNotch className="size-4 animate-spin" /> : "Turn off"}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              disabled={connecting}
              onClick={() => void handleConnect()}
            >
              {connecting ? <CircleNotch className="size-4 animate-spin" /> : "Connect Telegram"}
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
