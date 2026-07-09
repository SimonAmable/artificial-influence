"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import type { FanvueConnectionItem, FanvueVaultFolder } from "@/components/content/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type FanvueImageActionMode = "vault" | "post"

type FanvueImageActionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: FanvueImageActionMode
  imageUrl: string | null
  defaultConnectionId?: string | null
}

export function FanvueImageActionDialog({
  open,
  onOpenChange,
  mode,
  imageUrl,
  defaultConnectionId = null,
}: FanvueImageActionDialogProps) {
  const router = useRouter()
  const [connections, setConnections] = React.useState<FanvueConnectionItem[]>([])
  const [folders, setFolders] = React.useState<FanvueVaultFolder[]>([])
  const [connectionId, setConnectionId] = React.useState<string | null>(null)
  const [folderName, setFolderName] = React.useState<string>("none")
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) return

    let cancelled = false
    setIsLoading(true)
    void fetch("/api/social-connections/status", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as {
          fanvue?: { connections?: FanvueConnectionItem[] }
          error?: string
        }
        if (!response.ok || cancelled) return
        const list = (data.fanvue?.connections ?? []).filter((connection) => connection.status === "connected")
        setConnections(list)
        const preferred =
          defaultConnectionId && list.some((connection) => connection.id === defaultConnectionId)
            ? defaultConnectionId
            : list[0]?.id ?? null
        setConnectionId(preferred)
      })
      .catch(() => {
        if (!cancelled) setConnections([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [defaultConnectionId, open])

  React.useEffect(() => {
    if (!open || !connectionId) {
      setFolders([])
      setFolderName("none")
      return
    }

    let cancelled = false
    void fetch(`/api/fanvue/vault/folders?connectionId=${encodeURIComponent(connectionId)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { folders?: FanvueVaultFolder[] }
        if (!response.ok || cancelled) return
        setFolders(data.folders ?? [])
      })
      .catch(() => {
        if (!cancelled) setFolders([])
      })

    return () => {
      cancelled = true
    }
  }, [connectionId, open])

  const handleSubmit = async () => {
    if (!imageUrl || !connectionId) return

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/fanvue/media/upload-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId,
          imageUrl,
          folderName: folderName === "none" ? null : folderName,
        }),
      })
      const data = (await response.json()) as { media?: { uuid?: string }; error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Upload failed.")
      }

      if (mode === "vault") {
        toast.success("Image sent to your Fanvue vault.")
        onOpenChange(false)
        return
      }

      const mediaUuid = data.media?.uuid
      if (!mediaUuid) {
        throw new Error("Upload succeeded but media id was missing.")
      }

      toast.success("Image uploaded. Opening post composer...")
      onOpenChange(false)
      router.push(`/content?tab=schedule&compose=1&mediaUuid=${encodeURIComponent(mediaUuid)}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload image.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "vault" ? "Send to Fanvue vault" : "Create Fanvue post"}</DialogTitle>
          <DialogDescription>
            {mode === "vault"
              ? "Upload this image to your connected Fanvue vault."
              : "Upload this image to Fanvue, then open the post composer."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Fanvue accounts...
          </div>
        ) : connections.length === 0 ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Connect a Fanvue account in Content settings first.</p>
            <Button type="button" className="rounded-full" onClick={() => router.push("/content")}>
              Go to Content
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label>Fanvue account</Label>
              <Select value={connectionId ?? undefined} onValueChange={setConnectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {connections.map((connection) => (
                    <SelectItem key={connection.id} value={connection.id}>
                      {connection.displayName || connection.username || "Fanvue account"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Vault folder (optional)</Label>
              <Select value={folderName} onValueChange={setFolderName}>
                <SelectTrigger>
                  <SelectValue placeholder="No folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No folder</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.name} value={folder.name}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSubmitting || isLoading || connections.length === 0 || !imageUrl}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mode === "vault" ? "Send to vault" : "Upload & compose"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
