"use client"

import * as React from "react"
import {
  FolderOpen,
  FolderPlus,
  LayoutGrid,
  Loader2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

import type { FanvueConnectionItem, FanvueMediaItem, FanvueVaultFolder } from "@/components/content/types"
import { fanvueConnectionLabel } from "@/components/content/fanvue-account-display"
import {
  FanvueMediaPreview,
  getFanvueMediaDisplayName,
} from "@/components/content/fanvue-media-preview"
import {
  isVaultAllFoldersSelection,
  VAULT_ALL_FOLDERS,
  VAULT_ALL_FOLDERS_LABEL,
} from "@/components/content/types"
import {
  AssetSelectionModal,
  type AssetSelectionPick,
} from "@/components/shared/modals/asset-selection-modal"
import { VaultMediaEditDialog } from "@/components/content/vault-media-edit-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type VaultTabProps = {
  connection: FanvueConnectionItem | null
}

export function VaultTab({ connection }: VaultTabProps) {
  const connectionId = connection?.id ?? null
  const [folders, setFolders] = React.useState<FanvueVaultFolder[]>([])
  const [selectedFolder, setSelectedFolder] = React.useState<string | null>(VAULT_ALL_FOLDERS)
  const [folderMedia, setFolderMedia] = React.useState<FanvueMediaItem[]>([])
  const [isLoadingFolders, setIsLoadingFolders] = React.useState(false)
  const [isLoadingMedia, setIsLoadingMedia] = React.useState(false)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [newFolderName, setNewFolderName] = React.useState("")
  const [isCreatingFolder, setIsCreatingFolder] = React.useState(false)
  const [renameDialogOpen, setRenameDialogOpen] = React.useState(false)
  const [renameValue, setRenameValue] = React.useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [assetModalOpen, setAssetModalOpen] = React.useState(false)
  const [editingMedia, setEditingMedia] = React.useState<FanvueMediaItem | null>(null)
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [isAddingAsset, setIsAddingAsset] = React.useState(false)
  const [busyAction, setBusyAction] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

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
      setSelectedFolder((current) => {
        if (isVaultAllFoldersSelection(current)) {
          return VAULT_ALL_FOLDERS
        }
        if (current && nextFolders.some((folder) => folder.name === current)) {
          return current
        }
        return VAULT_ALL_FOLDERS
      })
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
      const mediaUrl = isVaultAllFoldersSelection(selectedFolder)
        ? `/api/fanvue/media?connectionId=${encodeURIComponent(connectionId)}`
        : `/api/fanvue/vault/folders/${encodeURIComponent(selectedFolder)}/media?connectionId=${encodeURIComponent(connectionId)}`

      const response = await fetch(mediaUrl, { cache: "no-store" })
      const data = (await response.json()) as { items?: FanvueMediaItem[]; error?: string }
      if (!response.ok) {
        throw new Error(
          data.error ||
            (isVaultAllFoldersSelection(selectedFolder)
              ? "Failed to load vault media."
              : "Failed to load folder media.")
        )
      }
      setFolderMedia(data.items ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load vault media.")
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

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await loadFolders()
      await loadFolderMedia()
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleCreateFolder = async () => {
    if (!connectionId || !newFolderName.trim()) return
    setIsCreatingFolder(true)
    try {
      const response = await fetch("/api/fanvue/vault/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, name: newFolderName.trim() }),
      })
      const data = (await response.json()) as { folder?: FanvueVaultFolder; error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to create folder.")
      }
      toast.success("Folder created.")
      setNewFolderName("")
      await loadFolders()
      if (data.folder?.name) {
        setSelectedFolder(data.folder.name)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create folder.")
    } finally {
      setIsCreatingFolder(false)
    }
  }

  const handleRenameFolder = async () => {
    if (!connectionId || !selectedFolder || isVaultAllFoldersSelection(selectedFolder) || !renameValue.trim()) {
      return
    }
    setBusyAction("rename")
    try {
      const response = await fetch(`/api/fanvue/vault/folders/${encodeURIComponent(selectedFolder)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, name: renameValue.trim() }),
      })
      const data = (await response.json()) as { folder?: FanvueVaultFolder; error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to rename folder.")
      }
      toast.success("Folder renamed.")
      setRenameDialogOpen(false)
      await loadFolders()
      setSelectedFolder(data.folder?.name ?? renameValue.trim())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rename folder.")
    } finally {
      setBusyAction(null)
    }
  }

  const handleDeleteFolder = async () => {
    if (!connectionId || !selectedFolder || isVaultAllFoldersSelection(selectedFolder)) return
    setBusyAction("delete")
    try {
      const response = await fetch(
        `/api/fanvue/vault/folders/${encodeURIComponent(selectedFolder)}?connectionId=${encodeURIComponent(connectionId)}`,
        { method: "DELETE" }
      )
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete folder.")
      }
      toast.success("Folder deleted.")
      setDeleteDialogOpen(false)
      setSelectedFolder(VAULT_ALL_FOLDERS)
      await loadFolders()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete folder.")
    } finally {
      setBusyAction(null)
    }
  }

  const handleRemoveMediaFromFolder = async (mediaUuid: string) => {
    if (!connectionId || !selectedFolder || isVaultAllFoldersSelection(selectedFolder)) return
    setBusyAction(`remove-${mediaUuid}`)
    try {
      const response = await fetch(
        `/api/fanvue/vault/folders/${encodeURIComponent(selectedFolder)}/media?connectionId=${encodeURIComponent(connectionId)}&mediaUuid=${encodeURIComponent(mediaUuid)}`,
        { method: "DELETE" }
      )
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to remove media from folder.")
      }
      toast.success("Removed from folder.")
      await loadFolderMedia()
      await loadFolders()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove media from folder.")
    } finally {
      setBusyAction(null)
    }
  }

  const handleAssetSelect = async (pick: AssetSelectionPick) => {
    if (!connectionId || !selectedFolder || isVaultAllFoldersSelection(selectedFolder)) return
    if (pick.assetType !== "image" && pick.assetType !== "video") {
      toast.error("Only images and videos can be added to your vault.")
      return
    }

    setIsAddingAsset(true)
    try {
      const response = await fetch("/api/fanvue/media/upload-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId,
          imageUrl: pick.url,
          folderName: selectedFolder,
          displayName: pick.title?.trim() || undefined,
        }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to add asset to folder.")
      }

      toast.success("Asset added to folder.")
      setAssetModalOpen(false)
      await loadFolderMedia()
      await loadFolders()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add asset to folder.")
    } finally {
      setIsAddingAsset(false)
    }
  }

  const handleUploadToFolder = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !connectionId || !selectedFolder) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("connectionId", connectionId)
      if (!isVaultAllFoldersSelection(selectedFolder)) {
        formData.append("folderName", selectedFolder)
      }
      formData.append("file", file)

      const response = await fetch("/api/fanvue/media/upload", {
        method: "POST",
        body: formData,
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Upload failed.")
      }

      toast.success(
        isVaultAllFoldersSelection(selectedFolder)
          ? "Uploaded to your vault."
          : `Uploaded to "${selectedFolder}".`
      )
      await loadFolderMedia()
      await loadFolders()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  if (!connectionId) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderOpen />
          </EmptyMedia>
          <EmptyTitle>Connect Fanvue to browse your vault</EmptyTitle>
          <EmptyDescription>Folders help you organize content before posting.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const isAllFoldersView = isVaultAllFoldersSelection(selectedFolder)
  const isRealFolder = Boolean(selectedFolder && !isAllFoldersView)
  const selectedFolderLabel = isAllFoldersView ? VAULT_ALL_FOLDERS_LABEL : selectedFolder

  const allFoldersButton = (
    <button
      type="button"
      onClick={() => setSelectedFolder(VAULT_ALL_FOLDERS)}
      className={cn(
        "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
        isAllFoldersView
          ? "bg-primary/10 text-foreground"
          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      )}
    >
      <LayoutGrid className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{VAULT_ALL_FOLDERS_LABEL}</span>
      {isAllFoldersView && !isLoadingMedia ? (
        <span className="text-xs tabular-nums text-muted-foreground">{folderMedia.length}</span>
      ) : null}
    </button>
  )

  const folderSidebar = (
    <aside className="hidden space-y-3 rounded-2xl border border-border/70 bg-background/70 p-3 lg:block">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-sm font-semibold text-foreground">Folders</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 rounded-full"
          disabled={isRefreshing}
          onClick={() => void handleRefresh()}
        >
          <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={newFolderName}
          onChange={(event) => setNewFolderName(event.target.value)}
          placeholder="New folder name"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void handleCreateFolder()
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0 rounded-full"
          disabled={isCreatingFolder || !newFolderName.trim()}
          onClick={() => void handleCreateFolder()}
        >
          {isCreatingFolder ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="mr-1.5 h-3.5 w-3.5" />}
          Create
        </Button>
      </div>

      {isLoadingFolders ? (
        <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading folders...
        </div>
      ) : (
        <div className="space-y-1">
          {allFoldersButton}
          {folders.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              Create a folder below to organize vault media.
            </p>
          ) : (
            folders.map((folder) => (
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
                <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                {typeof folder.mediaCount === "number" ? (
                  <span className="text-xs tabular-nums text-muted-foreground">{folder.mediaCount}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      )}
    </aside>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 lg:hidden">
        <div className="min-w-0 flex-1">
          <Label className="sr-only">Folder</Label>
          <Select
            value={selectedFolder ?? undefined}
            onValueChange={setSelectedFolder}
            disabled={isLoadingFolders}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={isLoadingFolders ? "Loading folders..." : "Select a folder"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={VAULT_ALL_FOLDERS}>{VAULT_ALL_FOLDERS_LABEL}</SelectItem>
              {folders.map((folder) => (
                <SelectItem key={folder.name} value={folder.name}>
                  {folder.name}
                  {typeof folder.mediaCount === "number" ? ` (${folder.mediaCount})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={isRefreshing}
          onClick={() => void handleRefresh()}
          aria-label="Refresh vault"
        >
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        {folderSidebar}

        <div className="space-y-3">
          {connection ? (
            <p className="text-xs text-muted-foreground">
              Viewing vault for{" "}
              <span className="font-medium text-foreground">{fanvueConnectionLabel(connection)}</span>
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {selectedFolderLabel ?? "Select a folder"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isAllFoldersView
                  ? "All vault media, including unfiled uploads"
                  : "Vault media in this folder"}
              </p>
            </div>
            {selectedFolder ? (
              <div className="flex flex-wrap items-center gap-2">
                {isRealFolder ? (
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-full"
                    disabled={isAddingAsset}
                    onClick={() => setAssetModalOpen(true)}
                  >
                    {isAddingAsset ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <FolderOpen className="mr-1.5 h-4 w-4" />
                    )}
                    Add asset
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant={isRealFolder ? "outline" : "default"}
                  className="rounded-full"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-1.5 h-4 w-4" />
                  )}
                  Upload
                </Button>
                {isRealFolder ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="rounded-full">
                        <MoreHorizontal className="mr-1.5 h-4 w-4" />
                        Manage folder
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setRenameValue(selectedFolder)
                          setRenameDialogOpen(true)
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Rename folder
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteDialogOpen(true)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete folder
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <Input
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              placeholder="New folder name"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleCreateFolder()
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              className="shrink-0 rounded-full"
              disabled={isCreatingFolder || !newFolderName.trim()}
              onClick={() => void handleCreateFolder()}
            >
              {isCreatingFolder ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderPlus className="mr-2 h-4 w-4" />}
              Create
            </Button>
          </div>

          {isLoadingMedia ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isAllFoldersView ? "Loading vault media..." : "Loading folder media..."}
            </div>
          ) : folderMedia.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Upload />
                </EmptyMedia>
                <EmptyTitle>
                  {isAllFoldersView ? "No vault media yet" : "This folder is empty"}
                </EmptyTitle>
                <EmptyDescription>
                  {isAllFoldersView
                    ? "Upload media to your vault or add assets from your library."
                    : "Upload directly here or add an asset from your library."}
                </EmptyDescription>
              </EmptyHeader>
              {selectedFolder ? (
                <EmptyContent>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {isRealFolder ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={isAddingAsset}
                        onClick={() => setAssetModalOpen(true)}
                      >
                        {isAddingAsset ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <FolderOpen className="mr-2 h-4 w-4" />
                        )}
                        Add asset
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant={isRealFolder ? "outline" : "default"}
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {isUploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Upload
                    </Button>
                  </div>
                </EmptyContent>
              ) : null}
            </Empty>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {folderMedia.map((item) => (
                  <article
                    key={item.uuid}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setEditingMedia(item)
                      setEditDialogOpen(true)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        setEditingMedia(item)
                        setEditDialogOpen(true)
                      }
                    }}
                    className="group cursor-pointer overflow-hidden rounded-2xl border border-border/70 bg-background/80 transition-colors hover:border-border"
                  >
                    <div className="relative">
                      <FanvueMediaPreview item={item} />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/40 to-transparent px-3 pb-2.5 pt-8">
                        <p className="truncate text-sm font-medium text-white">
                          {getFanvueMediaDisplayName(item)}
                        </p>
                      </div>
                      {isRealFolder ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="absolute right-2 top-2 h-7 w-7 rounded-full opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                          disabled={busyAction === `remove-${item.uuid}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            void handleRemoveMediaFromFolder(item.uuid)
                          }}
                          aria-label="Remove from folder"
                        >
                          {busyAction === `remove-${item.uuid}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      ) : null}
                    </div>
                  </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename folder</AlertDialogTitle>
            <AlertDialogDescription>Choose a new name for &ldquo;{selectedFolder}&rdquo;.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyAction === "rename"}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busyAction === "rename" || !renameValue.trim()}
              onClick={(event) => {
                event.preventDefault()
                void handleRenameFolder()
              }}
            >
              {busyAction === "rename" ? "Saving..." : "Save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              Media in &ldquo;{selectedFolder}&rdquo; will be detached from the folder but not deleted from your vault.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyAction === "delete"}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busyAction === "delete"}
              onClick={(event) => {
                event.preventDefault()
                void handleDeleteFolder()
              }}
            >
              {busyAction === "delete" ? "Deleting..." : "Delete folder"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(event) => void handleUploadToFolder(event)}
      />

      {connectionId && isRealFolder ? (
        <AssetSelectionModal
          open={assetModalOpen}
          onOpenChange={setAssetModalOpen}
          onSelect={(pick) => void handleAssetSelect(pick)}
          allowedAssetTypes={["image", "video"]}
        />
      ) : null}

      {connectionId ? (
        <VaultMediaEditDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open)
            if (!open) {
              setEditingMedia(null)
            }
          }}
          connectionId={connectionId}
          media={editingMedia}
          folderName={isRealFolder ? selectedFolder : null}
          folders={folders}
          onSaved={async () => {
            await loadFolderMedia()
          }}
        />
      ) : null}
    </div>
  )
}
