"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ClockCounterClockwise } from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  FanvueImageActionDialog,
  type FanvueImageActionMode,
} from "@/components/content/fanvue-image-action-dialog"
import { HistoryPanel } from "@/components/library/history/history-panel"
import { HistorySearchToolbar } from "@/components/library/history/history-search-toolbar"
import type { Generation, GenerationType, SaveAssetDraft } from "@/components/library/history/types"
import { useDebouncedValue } from "@/components/library/history/use-debounced-value"
import { useGenerationHistory } from "@/components/library/history/use-generation-history"
import {
  FullscreenMediaViewer,
  type FullscreenMediaViewerAction,
} from "@/components/shared/display/fullscreen-media-viewer"
import { copyMediaToClipboard, downloadMediaFile } from "@/components/shared/display/media-viewer-utils"
import { Button } from "@/components/ui/button"
import type { AssetType } from "@/lib/assets/types"
import { cn } from "@/lib/utils"

const COLUMN_COUNT_STORAGE_KEY = "unican-content-media-column-count"

type GenerationHistoryViewProps = {
  actionVariant?: "library" | "fanvue"
  connectionId?: string | null
  enabled?: boolean
  className?: string
  onSave?: (draft: SaveAssetDraft) => void
  onSaveExample?: (generation: Generation) => void
  onAnimate?: (generation: Generation) => void
  onEditImage?: (url: string) => void
  onDelete?: (generation: Generation) => void | Promise<void>
  getDefaultCategoryByMediaType?: (type: AssetType) => import("@/lib/assets/types").AssetCategory
}

export function GenerationHistoryView({
  actionVariant = "library",
  connectionId = null,
  enabled = true,
  className,
  onSave,
  onSaveExample,
  onAnimate,
  onEditImage,
  onDelete,
  getDefaultCategoryByMediaType,
}: GenerationHistoryViewProps) {
  const router = useRouter()
  const [search, setSearch] = React.useState("")
  const debouncedSearch = useDebouncedValue(search.trim(), 250)
  const [historyType, setHistoryType] = React.useState<GenerationType>("all")
  const [historyTool, setHistoryTool] = React.useState("all")
  const [columnCount, setColumnCount] = React.useState(2)
  const [viewerGeneration, setViewerGeneration] = React.useState<Generation | null>(null)
  const [copiedUrl, setCopiedUrl] = React.useState<string | null>(null)
  const [fanvueActionOpen, setFanvueActionOpen] = React.useState(false)
  const [fanvueActionMode, setFanvueActionMode] = React.useState<FanvueImageActionMode>("vault")
  const [fanvueActionImageUrl, setFanvueActionImageUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    const saved = window.localStorage.getItem(COLUMN_COUNT_STORAGE_KEY)
    if (!saved) return
    const parsed = Number.parseInt(saved, 10)
    if (!Number.isNaN(parsed) && parsed >= 2 && parsed <= 6) {
      setColumnCount(parsed)
    }
  }, [])

  const handleColumnCountChange = React.useCallback((value: number) => {
    setColumnCount(value)
    window.localStorage.setItem(COLUMN_COUNT_STORAGE_KEY, String(value))
  }, [])

  const { state, loadMoreSentinelRef, refresh, loadMore } = useGenerationHistory({
    enabled,
    historyType,
    historyTool,
    searchQuery: debouncedSearch,
  })

  const openFanvueAction = React.useCallback((mode: FanvueImageActionMode, imageUrl: string) => {
    if (!connectionId) {
      toast.error("Connect a Fanvue account first.")
      return
    }
    setFanvueActionMode(mode)
    setFanvueActionImageUrl(imageUrl)
    setFanvueActionOpen(true)
  }, [connectionId])

  const fanvueActions = React.useMemo(
    () =>
      actionVariant === "fanvue"
        ? {
            onSendToVault: (generation: Generation) => openFanvueAction("vault", generation.url),
            onCreatePost: (generation: Generation) => openFanvueAction("post", generation.url),
          }
        : undefined,
    [actionVariant, openFanvueAction]
  )

  const copyMedia = React.useCallback(async (url: string, type: AssetType) => {
    if (type === "audio") {
      try {
        await navigator.clipboard.writeText(url)
        setCopiedUrl(url)
        toast.success("Audio URL copied")
        window.setTimeout(() => setCopiedUrl((current) => (current === url ? null : current)), 1500)
      } catch {
        toast.error("Could not copy audio URL")
      }
      return
    }

    try {
      const result = await copyMediaToClipboard({ url, kind: type })
      setCopiedUrl(url)
      toast.success(result === "media" ? "Media copied to clipboard" : "Media URL copied")
      window.setTimeout(() => setCopiedUrl((current) => (current === url ? null : current)), 1500)
    } catch {
      toast.error("Could not copy media")
    }
  }, [])

  const downloadByUrl = React.useCallback(async (url: string, type: AssetType, title?: string) => {
    if (type === "audio") {
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${title || "audio"}-${Date.now()}.mp3`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      return
    }

    await downloadMediaFile({
      url,
      kind: type,
      filenamePrefix: title?.replace(/\s+/g, "-").toLowerCase() || type,
    })
  }, [])

  const handleDelete = React.useCallback(
    async (generation: Generation) => {
      if (onDelete) {
        await onDelete(generation)
        refresh()
        return
      }

      try {
        const response = await fetch(`/api/generations/${generation.id}`, { method: "DELETE" })
        const data = (await response.json()) as { error?: string }
        if (!response.ok) {
          throw new Error(data.error || "Failed to delete generation.")
        }
        toast.success("Generation deleted.")
        refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete generation.")
      }
    },
    [onDelete, refresh]
  )

  const viewerActions = React.useMemo((): FullscreenMediaViewerAction[] => {
    if (!viewerGeneration) return []

    const actions: FullscreenMediaViewerAction[] = []
    if (actionVariant === "fanvue" && (viewerGeneration.type === "image" || viewerGeneration.type === "video")) {
      actions.push(
        {
          id: "fanvue-vault",
          label: "Send to Fanvue Vault",
          onClick: () => openFanvueAction("vault", viewerGeneration.url),
        },
        {
          id: "fanvue-post",
          label: "Create Fanvue Post",
          onClick: () => openFanvueAction("post", viewerGeneration.url),
        }
      )
    }

    actions.push(
      {
        id: "copy",
        label: "Copy",
        onClick: () => void copyMedia(viewerGeneration.url, viewerGeneration.type),
      },
      {
        id: "download",
        label: "Download",
        onClick: () => void downloadByUrl(viewerGeneration.url, viewerGeneration.type, viewerGeneration.type),
      }
    )

    return actions
  }, [actionVariant, copyMedia, downloadByUrl, openFanvueAction, viewerGeneration])

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <HistorySearchToolbar
          search={search}
          onSearchChange={setSearch}
          historyType={historyType}
          onHistoryTypeChange={setHistoryType}
          historyTool={historyTool}
          onHistoryToolChange={setHistoryTool}
          columnCount={columnCount}
          onColumnCountChange={handleColumnCountChange}
        />
        <Button type="button" variant="outline" size="icon" className="shrink-0 rounded-full" onClick={refresh}>
          <ClockCounterClockwise className="h-4 w-4" />
        </Button>
      </div>

      {!connectionId && actionVariant === "fanvue" ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
          Connect Fanvue to send studio media to your vault or schedule posts. Your generation history is still shown below.
        </div>
      ) : null}

      <HistoryPanel
        actionVariant={actionVariant}
        activeType={historyType}
        state={state}
        items={state.items}
        searchQuery={debouncedSearch}
        onRefresh={refresh}
        onLoadMore={loadMore}
        loadMoreRef={loadMoreSentinelRef}
        onOpen={setViewerGeneration}
        onCopy={copyMedia}
        onDownload={downloadByUrl}
        onDelete={(generation) => void handleDelete(generation)}
        columnCount={columnCount}
        onColumnCountChange={handleColumnCountChange}
        onSave={onSave}
        onSaveExample={onSaveExample}
        onAnimate={onAnimate}
        onEditImage={onEditImage ?? ((url) => router.push(`/image-editor?image=${encodeURIComponent(url)}`))}
        fanvueActions={fanvueActions}
        getDefaultCategoryByMediaType={getDefaultCategoryByMediaType}
      />

      {viewerGeneration && viewerGeneration.type !== "audio" ? (
        <FullscreenMediaViewer
          kind={viewerGeneration.type}
          url={viewerGeneration.url}
          title={viewerGeneration.prompt || "Generated media"}
          metadata={{
            id: viewerGeneration.id,
            model: viewerGeneration.model,
            prompt: viewerGeneration.prompt,
            tool: viewerGeneration.tool,
            aspectRatio: viewerGeneration.aspect_ratio,
            type: viewerGeneration.type,
            createdAt: viewerGeneration.created_at,
          }}
          referenceImages={(viewerGeneration.reference_image_urls ?? []).map((imageUrl) => ({ imageUrl }))}
          copiedUrl={copiedUrl}
          onClose={() => setViewerGeneration(null)}
          actions={viewerActions}
        />
      ) : null}

      {actionVariant === "fanvue" ? (
        <FanvueImageActionDialog
          open={fanvueActionOpen}
          onOpenChange={setFanvueActionOpen}
          mode={fanvueActionMode}
          imageUrl={fanvueActionImageUrl}
          defaultConnectionId={connectionId}
        />
      ) : null}
    </div>
  )
}
