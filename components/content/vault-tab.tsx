"use client"

import * as React from "react"
import { FolderOpen, Loader2 } from "lucide-react"
import { toast } from "sonner"

import type { FanvueMediaItem, FanvueVaultFolder } from "@/components/content/types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type VaultTabProps = {
  connectionId: string | null
}

export function VaultTab({ connectionId }: VaultTabProps) {
  const [folders, setFolders] = React.useState<FanvueVaultFolder[]>([])
  const [selectedFolder, setSelectedFolder] = React.useState<string | null>(null)
  const [folderMedia, setFolderMedia] = React.useState<FanvueMediaItem[]>([])
  const [isLoadingFolders, setIsLoadingFolders] = React.useState(false)
  const [isLoadingMedia, setIsLoadingMedia] = React.useState(false)

  const loadFolders = React.useCallback(async () => {
    if (!connectionId) {
      setFolders([])
      setSelectedFolder(null)
      setFolderMedia([])
      return
    }

    setIsLoadingFolders(true)
    try {
      const response = await fetch(
        `/api/fanvue/vault/folders?connectionId=${encodeURIComponent(connectionId)}`,
        { cache: "no-store" }
      )
      const data = (await response.json()) as { folders?: FanvueVaultFolder[]; error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to load vault folders.")
      }
      const nextFolders = data.folders ?? []
      setFolders(nextFolders)
      setSelectedFolder((current) => current ?? nextFolders[0]?.name ?? null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load vault folders.")
      setFolders([])
    } finally {
      setIsLoadingFolders(false)
    }
  }, [connectionId])

  const loadFolderMedia = React.useCallback(async () => {
    if (!connectionId || !selectedFolder) {
      setFolderMedia([])
      return
    }

    setIsLoadingMedia(true)
    try {
      const response = await fetch(
        `/api/fanvue/vault/folders/${encodeURIComponent(selectedFolder)}/media?connectionId=${encodeURIComponent(connectionId)}`,
        { cache: "no-store" }
      )
      const data = (await response.json()) as { items?: FanvueMediaItem[]; error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to load folder media.")
      }
      setFolderMedia(data.items ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load folder media.")
      setFolderMedia([])
    } finally {
      setIsLoadingMedia(false)
    }
  }, [connectionId, selectedFolder])

  React.useEffect(() => {
    void loadFolders()
  }, [loadFolders])

  React.useEffect(() => {
    void loadFolderMedia()
  }, [loadFolderMedia])

  if (!connectionId) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-6 py-10 text-center">
        <p className="text-sm font-medium text-foreground">Connect Fanvue to browse your vault</p>
        <p className="mt-1 text-sm text-muted-foreground">Folders help you organize content before posting.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="space-y-2 rounded-2xl border border-border/70 bg-background/70 p-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-sm font-semibold text-foreground">Folders</p>
          <Button type="button" size="sm" variant="ghost" className="h-8 rounded-full" onClick={() => void loadFolders()}>
            Refresh
          </Button>
        </div>
        {isLoadingFolders ? (
          <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading folders...
          </div>
        ) : folders.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">No vault folders yet.</p>
        ) : (
          <div className="space-y-1">
            {folders.map((folder) => (
              <button
                key={folder.name}
                type="button"
                onClick={() => setSelectedFolder(folder.name)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  selectedFolder === folder.name
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                )}
              >
                <FolderOpen className="h-4 w-4 shrink-0" />
                <span className="truncate">{folder.name}</span>
              </button>
            ))}
          </div>
        )}
      </aside>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {selectedFolder ? selectedFolder : "Select a folder"}
            </h3>
            <p className="text-xs text-muted-foreground">Vault media in this folder</p>
          </div>
        </div>

        {isLoadingMedia ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading folder media...
          </div>
        ) : folderMedia.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">This folder is empty</p>
            <p className="mt-1 text-sm text-muted-foreground">Upload media in the Media tab first.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {folderMedia.map((item) => (
              <article
                key={item.uuid}
                className="overflow-hidden rounded-2xl border border-border/70 bg-background/80"
              >
                <div className="aspect-square bg-muted/30">
                  {item.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" src={item.thumbnailUrl} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-medium text-foreground">
                    {item.name || item.filename || "Untitled"}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
