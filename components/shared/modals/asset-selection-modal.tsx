"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  X,
  ClockCounterClockwise,
  FolderOpen,
  CircleNotch,
  Copy,
  Check,
  Plus,
  SpeakerHigh,
  UploadSimple,
} from "@phosphor-icons/react"
import Image from "next/image"
import type {
  AssetCategory,
  AssetRecord,
  AssetType,
  AssetVisibility,
} from "@/lib/assets/types"
import {
  ASSET_CATEGORIES,
  ASSET_CATEGORY_LABELS,
} from "@/lib/assets/library"
import { createClient } from "@/lib/supabase/client"
import { CreateAssetDialog } from "@/components/canvas/create-asset-dialog"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import { PRIVATE_UPLOAD_BUCKET } from "@/lib/uploads/shared"
import { toast } from "sonner"

interface RawGeneration {
  id: string
  user_id: string
  prompt: string | null
  supabase_storage_path: string
  type: 'image' | 'video' | 'audio'
  model: string | null
  created_at: string
  url: string | null
  status?: "pending" | "completed" | "failed" | null
}

interface Generation extends Omit<RawGeneration, "url"> {
  url: string
}

interface UploadRecord {
  id: string
  bucket: string
  storage_path: string
  mime_type: string
  label: string | null
  created_at: string
  original_filename?: string | null
}

interface UploadListItem {
  id: string
  url: string
  title: string
  createdAt: string
}

interface PaginationState {
  limit: number
  offset: number
  returned: number
  total: number
  hasMore: boolean
}

interface PaginatedTabState<TItem extends { id: string }> {
  items: TItem[]
  hasLoaded: boolean
  initialLoading: boolean
  loadingMore: boolean
  error: string | null
  nextOffset: number
  pagination: PaginationState
}

interface HistoryResponse {
  generations?: RawGeneration[]
  pagination?: Partial<PaginationState>
}

interface AssetsResponse {
  assets?: AssetRecord[]
  pagination?: Partial<PaginationState>
}

type ModalTab = "history" | "assets" | "uploads"

const ASSET_SELECTION_PAGE_LIMIT = 24

function createEmptyPagination(limit = ASSET_SELECTION_PAGE_LIMIT): PaginationState {
  return {
    limit,
    offset: 0,
    returned: 0,
    total: 0,
    hasMore: false,
  }
}

function createEmptyTabState<TItem extends { id: string }>(
  limit = ASSET_SELECTION_PAGE_LIMIT,
): PaginatedTabState<TItem> {
  return {
    items: [],
    hasLoaded: false,
    initialLoading: false,
    loadingMore: false,
    error: null,
    nextOffset: 0,
    pagination: createEmptyPagination(limit),
  }
}

function normalizePagination(
  pagination: Partial<PaginationState> | undefined,
  fallback: {
    limit: number
    offset: number
    returned: number
    total?: number
  },
): PaginationState {
  const limit = typeof pagination?.limit === "number" ? pagination.limit : fallback.limit
  const offset = typeof pagination?.offset === "number" ? pagination.offset : fallback.offset
  const returned = typeof pagination?.returned === "number" ? pagination.returned : fallback.returned
  const total =
    typeof pagination?.total === "number"
      ? pagination.total
      : typeof fallback.total === "number"
        ? fallback.total
        : offset + returned
  const hasMore =
    typeof pagination?.hasMore === "boolean" ? pagination.hasMore : offset + returned < total

  return {
    limit,
    offset,
    returned,
    total,
    hasMore,
  }
}

function mergeUniqueById<TItem extends { id: string }>(existing: TItem[], incoming: TItem[]) {
  const seen = new Set(existing.map((item) => item.id))
  const merged = [...existing]

  for (const item of incoming) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    merged.push(item)
  }

  return merged
}

export type AssetSelectionPick = {
  id?: string
  previewUrl?: string | null
  title?: string
  url: string
  assetType: AssetType
}

interface AssetSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (pick: AssetSelectionPick) => void
}

// Helper function to format date (relative)
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
  })
}

export function AssetSelectionModal({ open, onOpenChange, onSelect }: AssetSelectionModalProps) {
  const [activeTab, setActiveTab] = React.useState<ModalTab>("assets")
  const [historyState, setHistoryState] = React.useState<PaginatedTabState<Generation>>(
    createEmptyTabState<Generation>(),
  )
  const [assetsState, setAssetsState] = React.useState<PaginatedTabState<AssetRecord>>(
    createEmptyTabState<AssetRecord>(),
  )
  const [uploadsState, setUploadsState] = React.useState<PaginatedTabState<UploadListItem>>(
    createEmptyTabState<UploadListItem>(),
  )
  const [visibility, setVisibility] = React.useState<AssetVisibility | "all">("all")
  const [category, setCategory] = React.useState<AssetCategory | "all">("all")
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  const [createAssetOpen, setCreateAssetOpen] = React.useState(false)
  const [createAssetInitial, setCreateAssetInitial] = React.useState<{
    url: string
    assetType: AssetType
    title?: string
    uploadId?: string
    supabaseStoragePath?: string
  } | null>(null)
  const [createAssetUploading, setCreateAssetUploading] = React.useState(false)
  const [uploadReferenceUploading, setUploadReferenceUploading] = React.useState(false)
  const createAssetFileInputRef = React.useRef<HTMLInputElement>(null)
  const uploadReferenceInputRef = React.useRef<HTMLInputElement>(null)
  const historyStateRef = React.useRef(historyState)
  const assetsStateRef = React.useRef(assetsState)
  const uploadsStateRef = React.useRef(uploadsState)
  const historyLoadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null)
  const assetsLoadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null)
  const uploadsLoadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    historyStateRef.current = historyState
  }, [historyState])

  React.useEffect(() => {
    assetsStateRef.current = assetsState
  }, [assetsState])

  React.useEffect(() => {
    uploadsStateRef.current = uploadsState
  }, [uploadsState])

  const fetchHistory = React.useCallback(async (append: boolean) => {
    const currentState = historyStateRef.current
    if (append ? currentState.loadingMore : currentState.initialLoading) {
      return
    }

    setHistoryState((prev) => ({
      ...prev,
      error: null,
      initialLoading: append ? prev.initialLoading : true,
      loadingMore: append,
    }))

    try {
      const offset = append ? currentState.nextOffset : 0
      const response = await fetch(
        `/api/generations?type=image&limit=${ASSET_SELECTION_PAGE_LIMIT}&offset=${offset}&excludeFailed=true`,
      )
      if (!response.ok) {
        throw new Error("Failed to fetch history")
      }
      const data = (await response.json()) as HistoryResponse
      const nextGenerations = Array.isArray(data.generations)
        ? data.generations.filter(
            (generation): generation is Generation =>
              generation.status !== "failed" &&
              typeof generation.url === "string" &&
              generation.url.length > 0,
          )
        : []
      const pagination = normalizePagination(data.pagination, {
        limit: ASSET_SELECTION_PAGE_LIMIT,
        offset,
        returned: nextGenerations.length,
      })

      setHistoryState((prev) => ({
        ...prev,
        items: append ? mergeUniqueById(prev.items, nextGenerations) : nextGenerations,
        hasLoaded: true,
        initialLoading: false,
        loadingMore: false,
        error: null,
        nextOffset: pagination.offset + pagination.returned,
        pagination,
      }))
    } catch (error) {
      console.error("Error fetching history:", error)
      setHistoryState((prev) => ({
        ...prev,
        hasLoaded: true,
        initialLoading: false,
        loadingMore: false,
        error: error instanceof Error ? error.message : "Failed to load history",
      }))
    }
  }, [])

  const fetchAssets = React.useCallback(async (append: boolean) => {
    const currentState = assetsStateRef.current
    if (append ? currentState.loadingMore : currentState.initialLoading) {
      return
    }

    setAssetsState((prev) => ({
      ...prev,
      error: null,
      initialLoading: append ? prev.initialLoading : true,
      loadingMore: append,
    }))

    try {
      const offset = append ? currentState.nextOffset : 0
      const params = new URLSearchParams({
        limit: String(ASSET_SELECTION_PAGE_LIMIT),
        offset: String(offset),
      })
      if (visibility !== "all") {
        params.set("visibility", visibility)
      }
      if (category !== "all") {
        params.set("category", category)
      }

      const response = await fetch(`/api/assets?${params.toString()}`)
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || "Failed to fetch assets")
      }

      const data = (await response.json()) as AssetsResponse
      const nextAssets = Array.isArray(data.assets) ? data.assets : []
      const pagination = normalizePagination(data.pagination, {
        limit: ASSET_SELECTION_PAGE_LIMIT,
        offset,
        returned: nextAssets.length,
      })

      setAssetsState((prev) => ({
        ...prev,
        items: append ? mergeUniqueById(prev.items, nextAssets) : nextAssets,
        hasLoaded: true,
        initialLoading: false,
        loadingMore: false,
        error: null,
        nextOffset: pagination.offset + pagination.returned,
        pagination,
      }))
    } catch (error) {
      console.error("Error fetching assets:", error)
      setAssetsState((prev) => ({
        ...prev,
        hasLoaded: true,
        initialLoading: false,
        loadingMore: false,
        error: error instanceof Error ? error.message : "Failed to load assets",
      }))
    }
  }, [category, visibility])

  const fetchUploads = React.useCallback(async (append: boolean) => {
    const currentState = uploadsStateRef.current
    if (append ? currentState.loadingMore : currentState.initialLoading) {
      return
    }

    setUploadsState((prev) => ({
      ...prev,
      error: null,
      initialLoading: append ? prev.initialLoading : true,
      loadingMore: append,
    }))

    try {
      const supabase = createClient()
      const offset = append ? currentState.nextOffset : 0
      const { data, error, count } = await supabase
        .from("uploads")
        .select("id, bucket, storage_path, mime_type, label, created_at, original_filename", {
          count: "exact",
        })
        .like("mime_type", "image/%")
        .order("created_at", { ascending: false })
        .range(offset, offset + ASSET_SELECTION_PAGE_LIMIT - 1)

      if (error) {
        throw new Error(error.message)
      }

      const rows = (data ?? []) as UploadRecord[]
      const nextUploads = await Promise.all(
        rows.map(async (upload) => {
          let url = ""
          if (upload.bucket === PRIVATE_UPLOAD_BUCKET) {
            const signed = await supabase.storage
              .from(upload.bucket)
              .createSignedUrl(upload.storage_path, 60 * 60)
            if (signed.error || !signed.data?.signedUrl) {
              throw new Error(signed.error?.message || "Failed to load uploaded image")
            }
            url = signed.data.signedUrl
          } else {
            url = supabase.storage.from(upload.bucket).getPublicUrl(upload.storage_path).data.publicUrl
          }

          return {
            id: upload.id,
            url,
            title:
              upload.original_filename?.trim() ||
              upload.label?.replace(/^Uploaded:\s*/i, "").trim() ||
              "Uploaded image",
            createdAt: upload.created_at,
          } satisfies UploadListItem
        }),
      )
      const pagination = normalizePagination(
        {
          limit: ASSET_SELECTION_PAGE_LIMIT,
          offset,
          returned: nextUploads.length,
          total: count ?? offset + nextUploads.length,
          hasMore: offset + nextUploads.length < (count ?? offset + nextUploads.length),
        },
        {
          limit: ASSET_SELECTION_PAGE_LIMIT,
          offset,
          returned: nextUploads.length,
          total: count ?? offset + nextUploads.length,
        },
      )

      setUploadsState((prev) => ({
        ...prev,
        items: append ? mergeUniqueById(prev.items, nextUploads) : nextUploads,
        hasLoaded: true,
        initialLoading: false,
        loadingMore: false,
        error: null,
        nextOffset: pagination.offset + pagination.returned,
        pagination,
      }))
    } catch (error) {
      console.error("Error fetching uploads:", error)
      setUploadsState((prev) => ({
        ...prev,
        hasLoaded: true,
        initialLoading: false,
        loadingMore: false,
        error: error instanceof Error ? error.message : "Failed to load uploads",
      }))
    }
  }, [])

  React.useEffect(() => {
    setAssetsState(createEmptyTabState<AssetRecord>())
  }, [visibility, category])

  React.useEffect(() => {
    if (!open) return

    if (activeTab === "history" && !historyState.hasLoaded && !historyState.initialLoading) {
      void fetchHistory(false)
      return
    }

    if (activeTab === "assets" && !assetsState.hasLoaded && !assetsState.initialLoading) {
      void fetchAssets(false)
      return
    }

    if (activeTab === "uploads" && !uploadsState.hasLoaded && !uploadsState.initialLoading) {
      void fetchUploads(false)
    }
  }, [
    activeTab,
    assetsState.hasLoaded,
    assetsState.initialLoading,
    fetchAssets,
    fetchHistory,
    fetchUploads,
    historyState.hasLoaded,
    historyState.initialLoading,
    open,
    uploadsState.hasLoaded,
    uploadsState.initialLoading,
  ])

  React.useEffect(() => {
    let target: HTMLDivElement | null = null
    let activeState: PaginatedTabState<{ id: string }> | null = null
    let loadMore: (() => void) | null = null

    if (activeTab === "history") {
      target = historyLoadMoreSentinelRef.current
      activeState = historyState
      loadMore = () => void fetchHistory(true)
    } else if (activeTab === "assets") {
      target = assetsLoadMoreSentinelRef.current
      activeState = assetsState
      loadMore = () => void fetchAssets(true)
    } else if (activeTab === "uploads") {
      target = uploadsLoadMoreSentinelRef.current
      activeState = uploadsState
      loadMore = () => void fetchUploads(true)
    }

    if (
      !target ||
      !activeState ||
      !activeState.hasLoaded ||
      activeState.initialLoading ||
      activeState.loadingMore ||
      activeState.error ||
      !activeState.pagination.hasMore ||
      !loadMore
    ) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: "400px 0px" },
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [
    activeTab,
    assetsState,
    fetchAssets,
    fetchHistory,
    fetchUploads,
    historyState,
    uploadsState,
  ])

  const handleSelect = (pick: AssetSelectionPick) => {
    onSelect(pick)
    onOpenChange(false)
  }

  const handleCopyPrompt = async (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(`${id}-prompt`)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      console.error('Failed to copy prompt:', error)
    }
  }

  const handleCreateAssetFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const type = file.type
    const isImage = type.startsWith("image/")
    const isVideo = type.startsWith("video/")
    const isAudio = type.startsWith("audio/")
    if (!isImage && !isVideo && !isAudio) {
      toast.error("Please select an image, video, or audio file")
      return
    }
    setCreateAssetUploading(true)
    try {
      const result = await uploadFileToSupabase(file, "asset-library")
      if (!result) return
      if (result.fileType === "other") {
        toast.error("Unsupported file type. Use image, video, or audio.")
        return
      }
      setCreateAssetInitial({
        url: result.url,
        assetType: result.fileType,
        title: result.fileName,
        uploadId: result.uploadId,
        supabaseStoragePath: result.storagePath,
      })
      setActiveTab("assets")
      setCreateAssetOpen(true)
    } finally {
      setCreateAssetUploading(false)
    }
  }

  const handleUploadReferenceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }

    setUploadReferenceUploading(true)
    try {
      const result = await uploadFileToSupabase(file, "reference-uploads")
      if (!result) return
      if (result.fileType !== "image") {
        toast.error("Only image uploads can be used as reference images here")
        return
      }

      setUploadsState(createEmptyTabState<UploadListItem>())
      toast.success("Uploaded image ready to use")
      void fetchUploads(false)
    } finally {
      setUploadReferenceUploading(false)
    }
  }

  // Handle keyboard navigation
  React.useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="!fixed !inset-0 !left-0 !top-0 !m-0 !flex !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 !flex-col !gap-0 overflow-hidden !rounded-none border-0 !p-0"
        aria-describedby="asset-selection-description"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-6 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
          <DialogHeader className="min-w-0 flex-1 gap-1 p-0 pr-2 text-left">
            <DialogTitle className="text-left text-xl font-semibold leading-snug">
              Select Reference Image
            </DialogTitle>
            <p
              id="asset-selection-description"
              className="text-left text-sm leading-relaxed text-muted-foreground"
            >
              Choose an image from your uploads, saved assets, or generation history
            </p>
          </DialogHeader>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 shrink-0 rounded-full"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" weight="bold" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as ModalTab)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="flex shrink-0 flex-col gap-3 px-6 pt-2 pb-0">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
              <div className="flex min-w-0 flex-col gap-3">
                <TabsList>
                  <TabsTrigger value="assets" className="gap-2">
                    <FolderOpen className="h-4 w-4" />
                    Assets
                  </TabsTrigger>
                  <TabsTrigger value="history" className="gap-2">
                    <ClockCounterClockwise className="h-4 w-4" />
                    History
                  </TabsTrigger>
                  <TabsTrigger value="uploads" className="gap-2">
                    <UploadSimple className="h-4 w-4" />
                    Uploads
                  </TabsTrigger>
                </TabsList>
                {activeTab === "assets" ? (
                  <Tabs
                    value={visibility}
                    onValueChange={(value) => setVisibility(value as AssetVisibility | "all")}
                  >
                    <TabsList>
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="private">Private</TabsTrigger>
                      <TabsTrigger value="public">Public</TabsTrigger>
                    </TabsList>
                  </Tabs>
                ) : null}
              </div>
              <input
                ref={createAssetFileInputRef}
                type="file"
                accept="image/*,video/*,audio/*"
                className="sr-only"
                aria-hidden
                tabIndex={-1}
                onChange={handleCreateAssetFileChange}
              />
              <input
                ref={uploadReferenceInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                aria-hidden
                tabIndex={-1}
                onChange={handleUploadReferenceFileChange}
              />
              {activeTab === "assets" ? (
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  disabled={createAssetUploading}
                  onClick={() => createAssetFileInputRef.current?.click()}
                >
                  {createAssetUploading ? (
                    <CircleNotch className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" weight="bold" />
                  )}
                  Create asset
                </Button>
              ) : activeTab === "uploads" ? (
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  disabled={uploadReferenceUploading}
                  onClick={() => uploadReferenceInputRef.current?.click()}
                >
                  {uploadReferenceUploading ? (
                    <CircleNotch className="h-4 w-4 animate-spin" />
                  ) : (
                    <UploadSimple className="h-4 w-4" weight="bold" />
                  )}
                  Upload image
                </Button>
              ) : null}
            </div>
            {activeTab === "assets" ? (
              <div className="min-w-0 w-full">
                <Tabs
                  value={category}
                  onValueChange={(value) => setCategory(value as AssetCategory | "all")}
                >
                  <div
                    className="-mx-1 flex max-w-full overflow-x-auto overscroll-x-contain px-1 pb-0.5"
                    role="presentation"
                  >
                    <TabsList className="inline-flex h-auto min-h-9 w-max max-w-none flex-nowrap justify-start">
                      <TabsTrigger value="all" className="shrink-0 grow-0 basis-auto">
                        All
                      </TabsTrigger>
                      {ASSET_CATEGORIES.map((item) => (
                        <TabsTrigger key={item} value={item} className="shrink-0 grow-0 basis-auto">
                          {ASSET_CATEGORY_LABELS[item]}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>
                </Tabs>
              </div>
            ) : null}
          </div>

          {/* Assets Tab */}
          <TabsContent value="assets" className="m-0 min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
            {assetsState.initialLoading ? (
              <div className="flex min-h-48 items-start justify-center pt-8">
                <CircleNotch className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : assetsState.error && assetsState.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <p className="text-sm">{assetsState.error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchAssets(false)}
                  className="mt-4"
                >
                  Try Again
                </Button>
              </div>
            ) : assetsState.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <FolderOpen className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">No saved assets</p>
                <p className="text-xs mt-1">Try another category or save an asset to see it here</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-sm text-muted-foreground">
                  Showing {assetsState.items.length} of {assetsState.pagination.total}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {assetsState.items.map((asset) => (
                    <div
                      key={asset.id}
                      className="overflow-hidden rounded-md"
                    >
                      <div
                        className="group/image relative aspect-square cursor-pointer hover:ring-2 hover:ring-primary transition-all rounded-md"
                        onClick={() =>
                          handleSelect({
                            id: asset.id,
                            previewUrl: asset.thumbnailUrl || asset.url,
                            title: asset.title,
                            url: asset.url,
                            assetType: asset.assetType,
                          })
                        }
                        role="button"
                        tabIndex={0}
                        aria-label={`Select ${asset.assetType} asset`}
                      >
                        {asset.assetType === "image" && (
                          <Image
                            src={asset.thumbnailUrl || asset.url}
                            alt={asset.title}
                            fill
                            className="object-cover rounded-md"
                          />
                        )}
                        {asset.assetType === "video" && (
                          <video
                            src={asset.url}
                            poster={asset.thumbnailUrl ?? undefined}
                            className="absolute inset-0 h-full w-full object-cover rounded-md"
                            preload="metadata"
                            muted
                            playsInline
                          />
                        )}
                        {asset.assetType === "audio" && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-md bg-muted">
                            <SpeakerHigh
                              className="h-12 w-12 text-muted-foreground"
                              weight="duotone"
                              aria-hidden
                            />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center rounded-md">
                          <span className="text-white text-sm font-medium">Select</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5 mt-2 px-1">
                        <p className="text-xs text-foreground truncate font-medium">
                          {asset.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {formatDate(asset.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {assetsState.error ? (
                  <div className="text-center text-sm text-destructive">{assetsState.error}</div>
                ) : null}

                {assetsState.pagination.hasMore ? (
                  <div className="space-y-3">
                    <div ref={assetsLoadMoreSentinelRef} className="h-px w-full" aria-hidden />
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        onClick={() => void fetchAssets(true)}
                        disabled={assetsState.loadingMore}
                      >
                        {assetsState.loadingMore ? "Loading more..." : "Load more"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="m-0 min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
            {historyState.initialLoading ? (
              <div className="flex min-h-48 items-start justify-center pt-8">
                <CircleNotch className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : historyState.error && historyState.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <p className="text-sm">{historyState.error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchHistory(false)}
                  className="mt-4"
                >
                  Try Again
                </Button>
              </div>
            ) : historyState.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <ClockCounterClockwise className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">No generation history</p>
                <p className="text-xs mt-1">Generate your first image to see it here</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-sm text-muted-foreground">
                  Showing {historyState.items.length} of {historyState.pagination.total}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {historyState.items.map((generation) => (
                    <div
                      key={generation.id}
                      className="overflow-hidden rounded-md"
                    >
                      <div
                        className="group/image relative aspect-square cursor-pointer hover:ring-2 hover:ring-primary transition-all rounded-md"
                        onClick={() =>
                          handleSelect({
                            id: generation.id,
                            previewUrl: generation.url,
                            title: generation.prompt || "Generated media",
                            url: generation.url,
                            assetType: generation.type,
                          })
                        }
                        role="button"
                        tabIndex={0}
                        aria-label={`Select ${generation.type}`}
                      >
                        <Image
                          src={generation.url}
                          alt={generation.prompt || "Generated image"}
                          fill
                          className="object-cover rounded-md"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center rounded-md">
                          <span className="text-white text-sm font-medium">Select</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5 mt-2 px-1">
                        <p className="text-xs text-muted-foreground truncate">
                          {formatDate(generation.created_at)}
                        </p>
                        {generation.prompt && (
                          <div
                            className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors group/prompt"
                            onClick={(e) => handleCopyPrompt(e, generation.prompt!, generation.id)}
                            role="button"
                            tabIndex={0}
                            aria-label="Copy prompt"
                          >
                            <p className="text-xs text-foreground truncate flex-1">
                              {generation.prompt}
                            </p>
                            {copiedId === `${generation.id}-prompt` ? (
                              <Check className="h-3 w-3 flex-shrink-0 text-primary" weight="bold" />
                            ) : (
                              <Copy className="h-3 w-3 flex-shrink-0 opacity-0 group-hover/prompt:opacity-100 transition-opacity" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {historyState.error ? (
                  <div className="text-center text-sm text-destructive">{historyState.error}</div>
                ) : null}

                {historyState.pagination.hasMore ? (
                  <div className="space-y-3">
                    <div ref={historyLoadMoreSentinelRef} className="h-px w-full" aria-hidden />
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        onClick={() => void fetchHistory(true)}
                        disabled={historyState.loadingMore}
                      >
                        {historyState.loadingMore ? "Loading more..." : "Load more"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </TabsContent>

          {/* Uploads Tab */}
          <TabsContent value="uploads" className="m-0 min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
            {uploadsState.initialLoading ? (
              <div className="flex min-h-48 items-start justify-center pt-8">
                <CircleNotch className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : uploadsState.error && uploadsState.items.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
                <p className="text-sm">{uploadsState.error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchUploads(false)}
                  className="mt-4"
                >
                  Try Again
                </Button>
              </div>
            ) : uploadsState.items.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
                <UploadSimple className="mb-3 h-12 w-12 opacity-50" />
                <p className="text-sm">No uploaded reference images</p>
                <p className="mt-1 text-xs">Upload an image here to use it without saving it as an asset</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-1.5"
                  onClick={() => uploadReferenceInputRef.current?.click()}
                >
                  <UploadSimple className="h-4 w-4" />
                  Upload image
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-sm text-muted-foreground">
                  Showing {uploadsState.items.length} of {uploadsState.pagination.total}
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {uploadsState.items.map((upload) => (
                    <div key={upload.id} className="overflow-hidden rounded-md">
                      <div
                        className="group/image relative aspect-square cursor-pointer rounded-md transition-all hover:ring-2 hover:ring-primary"
                        onClick={() =>
                          handleSelect({
                            id: upload.id,
                            previewUrl: upload.url,
                            title: upload.title,
                            url: upload.url,
                            assetType: "image",
                          })
                        }
                        role="button"
                        tabIndex={0}
                        aria-label="Select uploaded reference image"
                      >
                        <Image
                          src={upload.url}
                          alt={upload.title}
                          fill
                          className="rounded-md object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/60 opacity-0 transition-opacity group-hover/image:opacity-100">
                          <span className="text-sm font-medium text-white">Select</span>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-col gap-0.5 px-1">
                        <p className="truncate text-xs font-medium text-foreground">{upload.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{formatDate(upload.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {uploadsState.error ? (
                  <div className="text-center text-sm text-destructive">{uploadsState.error}</div>
                ) : null}

                {uploadsState.pagination.hasMore ? (
                  <div className="space-y-3">
                    <div ref={uploadsLoadMoreSentinelRef} className="h-px w-full" aria-hidden />
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        onClick={() => void fetchUploads(true)}
                        disabled={uploadsState.loadingMore}
                      >
                        {uploadsState.loadingMore ? "Loading more..." : "Load more"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {createAssetInitial && (
          <CreateAssetDialog
            open={createAssetOpen}
            onOpenChange={(next) => {
              setCreateAssetOpen(next)
              if (!next) setCreateAssetInitial(null)
            }}
            initial={{
              url: createAssetInitial.url,
              uploadId: createAssetInitial.uploadId,
              supabaseStoragePath: createAssetInitial.supabaseStoragePath,
              assetType: createAssetInitial.assetType,
              title: createAssetInitial.title,
              sourceNodeType: "asset-selection",
            }}
            onSaved={() => {
              void fetchAssets(false)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
