"use client"

import * as React from "react"
import Image from "next/image"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { isPresenceProduct } from "@/lib/product/require-presence"
import { cn } from "@/lib/utils"

type ConnectionStatus = "connected" | "disconnected" | "expired" | "error" | string

type SocialConnectionItem = {
  id: string
  providerAccountId: string
  provider: "instagram" | "tiktok"
  status: ConnectionStatus
  displayName: string | null
  username: string | null
  instagramConnectionId: string | null
}

type FanvueConnectionItem = {
  id: string
  providerAccountId: string
  status: ConnectionStatus
  displayName: string | null
  username: string | null
}

type StatusResponse = {
  fanvue?: { connected: boolean; connections: FanvueConnectionItem[] }
  providers?: {
    instagram?: { connected: boolean; connections: SocialConnectionItem[] }
    tiktok?: { connected: boolean; connections: SocialConnectionItem[] }
  }
  instagram?: { connected: boolean; connections: SocialConnectionItem[] }
  tiktok?: { connected: boolean; connections: SocialConnectionItem[] }
  error?: string
}

function statusLabel(status: ConnectionStatus) {
  return status.replaceAll("_", " ")
}

function ProviderBrand({
  label,
  iconSrc,
  iconClassName,
}: {
  label: string
  iconSrc: string
  iconClassName?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <Image
        src={iconSrc}
        alt=""
        aria-hidden
        width={40}
        height={40}
        className={cn("size-10 shrink-0 object-contain", iconClassName)}
      />
      <span className="text-base font-semibold leading-none">{label}</span>
    </div>
  )
}

export function AccountsSettingsPanel() {
  const [loading, setLoading] = React.useState(true)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<StatusResponse | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/social-connections/status", { cache: "no-store" })
      const data = (await response.json()) as StatusResponse
      if (!response.ok) {
        throw new Error(data.error || "Failed to load account status.")
      }
      setStatus(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load account status.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const disconnect = React.useCallback(
    async (provider: "fanvue" | "instagram" | "tiktok", connectionId: string) => {
      setBusyId(`${provider}:${connectionId}`)
      try {
        const endpoint =
          provider === "fanvue"
            ? "/api/fanvue/disconnect"
            : provider === "instagram"
              ? "/api/instagram/disconnect"
              : "/api/tiktok/disconnect"
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId }),
        })
        const data = (await response.json()) as { error?: string }
        if (!response.ok) {
          throw new Error(data.error || `Failed to disconnect ${provider}.`)
        }
        toast.success(`${provider[0].toUpperCase()}${provider.slice(1)} account disconnected.`)
        await load()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Disconnect failed.")
      } finally {
        setBusyId(null)
      }
    },
    [load]
  )

  const isPresence = isPresenceProduct()
  const fanvueConnections = (status?.fanvue?.connections ?? []).filter((c) => c.status === "connected")
  const instagramConnections = (status?.providers?.instagram?.connections ?? status?.instagram?.connections ?? []).filter(
    (c) => c.status === "connected"
  )
  const tiktokConnections = (status?.providers?.tiktok?.connections ?? status?.tiktok?.connections ?? []).filter(
    (c) => c.status === "connected"
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {isPresence
            ? "Manage your publishing accounts for Content."
            : "Manage your publishing accounts for Autopost."}
        </p>
        <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      <div className={cn("grid gap-3", isPresence ? "max-w-sm" : "md:grid-cols-2")}>
        {isPresence ? (
          <Card className="rounded-2xl py-4">
            <CardHeader className="space-y-1 pb-3">
              <CardTitle className="text-base">
                <ProviderBrand
                  label="Fanvue"
                  iconSrc="/brand_icons/fanvue_logo.png"
                  iconClassName="rounded-md"
                />
              </CardTitle>
              <CardDescription>{fanvueConnections.length} connected</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button type="button" size="sm" className="w-full rounded-full" onClick={() => (window.location.href = "/api/fanvue/connect")}>
                Connect Fanvue
              </Button>
              {fanvueConnections.map((connection) => (
                <div key={connection.id} className="flex items-center justify-between gap-2 rounded-xl border p-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{connection.displayName || connection.username || "Fanvue account"}</p>
                    <Badge variant="secondary" className="mt-1 rounded-full px-2 py-0 text-[10px]">
                      {statusLabel(connection.status)}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={busyId === `fanvue:${connection.id}`}
                    onClick={() => void disconnect("fanvue", connection.id)}
                  >
                    {busyId === `fanvue:${connection.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Disconnect"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {!isPresence ? (
          <>
            <Card className="rounded-2xl py-4">
              <CardHeader className="space-y-1 pb-3">
                <CardTitle className="text-base">
                  <ProviderBrand
                    label="Instagram"
                    iconSrc="/brand_icons/instagram-icon.svg"
                    iconClassName="dark:invert"
                  />
                </CardTitle>
                <CardDescription>{instagramConnections.length} connected</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  type="button"
                  size="sm"
                  className="w-full rounded-full"
                  onClick={() => (window.location.href = "/api/instagram/connect")}
                >
                  Connect Instagram
                </Button>
                {instagramConnections.map((connection) => {
                  const disconnectId = connection.instagramConnectionId
                  return (
                    <div key={connection.id} className="flex items-center justify-between gap-2 rounded-xl border p-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{connection.displayName || connection.username || "Instagram account"}</p>
                        <Badge variant="secondary" className="mt-1 rounded-full px-2 py-0 text-[10px]">
                          {statusLabel(connection.status)}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        disabled={!disconnectId || busyId === `instagram:${disconnectId}`}
                        onClick={() => (disconnectId ? void disconnect("instagram", disconnectId) : undefined)}
                      >
                        {disconnectId && busyId === `instagram:${disconnectId}` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Disconnect"
                        )}
                      </Button>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <Card className="rounded-2xl py-4">
              <CardHeader className="space-y-1 pb-3">
                <CardTitle className="text-base">
                  <ProviderBrand label="TikTok" iconSrc="/brand_icons/tiktok-icon.svg" />
                </CardTitle>
                <CardDescription>{tiktokConnections.length} connected</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button type="button" size="sm" className="w-full rounded-full" onClick={() => (window.location.href = "/api/tiktok/connect")}>
                  Connect TikTok
                </Button>
                {tiktokConnections.map((connection) => (
                  <div key={connection.id} className="flex items-center justify-between gap-2 rounded-xl border p-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{connection.displayName || connection.username || "TikTok account"}</p>
                      <Badge variant="secondary" className="mt-1 rounded-full px-2 py-0 text-[10px]">
                        {statusLabel(connection.status)}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={busyId === `tiktok:${connection.id}`}
                      onClick={() => void disconnect("tiktok", connection.id)}
                    >
                      {busyId === `tiktok:${connection.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Disconnect"}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading account status...
        </div>
      ) : null}
    </div>
  )
}
