"use client"

import * as React from "react"
import Image from "next/image"
import { UserRound } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { MediaTab } from "@/components/content/media-tab"
import { ScheduleTab } from "@/components/content/schedule-tab"
import { VaultTab } from "@/components/content/vault-tab"
import { ProfileSettingsModal } from "@/components/profile/profile-settings-modal"
import { Button } from "@/components/ui/button"
import type { FanvueConnectionItem } from "@/components/content/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type FanvueStatusResponse = {
  fanvue?: {
    connected: boolean
    connections: FanvueConnectionItem[]
  }
}

const CONTENT_CONNECTION_KEY = "content-selected-fanvue-connection-id"

export function ContentShell() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = React.useState<"media" | "vault" | "schedule">("media")
  const [connections, setConnections] = React.useState<FanvueConnectionItem[]>([])
  const [selectedConnectionId, setSelectedConnectionId] = React.useState<string | null>(null)
  const [isLoadingConnections, setIsLoadingConnections] = React.useState(true)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const hasHandledAuthParams = React.useRef(false)

  const fetchConnections = React.useCallback(async () => {
    setIsLoadingConnections(true)
    try {
      const response = await fetch("/api/social-connections/status", { cache: "no-store" })
      const data = (await response.json()) as FanvueStatusResponse & { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to load Fanvue connections.")
      }

      const list = (data.fanvue?.connections ?? []).filter((connection) => connection.status === "connected")
      setConnections(list as FanvueConnectionItem[])
      setSelectedConnectionId((current) => {
        if (current && list.some((connection) => connection.id === current)) {
          return current
        }
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem(CONTENT_CONNECTION_KEY)
          if (stored && list.some((connection) => connection.id === stored)) {
            return stored
          }
        }
        return list[0]?.id ?? null
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load Fanvue connections.")
      setConnections([])
      setSelectedConnectionId(null)
    } finally {
      setIsLoadingConnections(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchConnections()
  }, [fetchConnections])

  React.useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab === "media" || tab === "vault" || tab === "schedule") {
      setActiveTab(tab)
    }
  }, [searchParams])

  React.useEffect(() => {
    if (hasHandledAuthParams.current) return

    const error = searchParams.get("error")
    const connected = searchParams.get("connected")
    const provider = searchParams.get("provider")

    if (!error && connected !== "1") return
    hasHandledAuthParams.current = true

    if (error) {
      toast.error(error)
    } else if (provider === "fanvue") {
      toast.success("Fanvue account connected.")
      void fetchConnections()
    }

    const nextUrl = new URL(window.location.href)
    nextUrl.searchParams.delete("error")
    nextUrl.searchParams.delete("connected")
    nextUrl.searchParams.delete("provider")
    const search = nextUrl.searchParams.toString()
    window.history.replaceState({}, "", search ? `${nextUrl.pathname}?${search}` : nextUrl.pathname)
  }, [fetchConnections, searchParams])

  const handleSelectConnection = React.useCallback((connectionId: string) => {
    setSelectedConnectionId(connectionId)
    if (typeof window !== "undefined") {
      localStorage.setItem(CONTENT_CONNECTION_KEY, connectionId)
    }
  }, [])

  const handleConnectFanvue = React.useCallback(() => {
    window.location.href = "/api/fanvue/connect?next=/content"
  }, [])

  return (
    <div className="min-h-screen bg-background px-4 pb-8 pt-20 md:pt-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight">Content</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Upload to your Fanvue vault, organize folders, and schedule posts from one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:mt-1">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setSettingsOpen(true)}
            >
              <UserRound data-icon="inline-start" />
              Accounts
              {connections.length > 0 ? (
                <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                  {connections.length}
                </span>
              ) : null}
            </Button>
            <Button
              type="button"
              className="rounded-full bg-primary text-black hover:bg-primary/90 dark:bg-primary dark:text-black dark:hover:bg-primary/90"
              onClick={handleConnectFanvue}
            >
              <Image
                alt=""
                aria-hidden
                src="/brand_icons/fanvue_logo.png"
                width={18}
                height={18}
                className="rounded-sm"
              />
              Connect Fanvue
            </Button>
          </div>
        </div>

        <ProfileSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} initialTab="accounts" />

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
          <TabsList className={cn("grid w-full max-w-md grid-cols-3")}>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="vault">Vault</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
          </TabsList>

          <TabsContent value="media" className="mt-6">
            <MediaTab connectionId={selectedConnectionId} />
          </TabsContent>
          <TabsContent value="vault" className="mt-6">
            <VaultTab connectionId={selectedConnectionId} />
          </TabsContent>
          <TabsContent value="schedule" className="mt-6">
            <ScheduleTab
              connections={connections}
              selectedConnectionId={selectedConnectionId}
              onGoToMediaTab={() => setActiveTab("media")}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
