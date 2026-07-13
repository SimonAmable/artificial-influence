"use client"

import * as React from "react"
import Image from "next/image"
import {
  ClockCounterClockwise,
  MagnifyingGlass,
  SlidersHorizontal,
  UploadSimple,
  X,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { CreateAssetDialog } from "@/components/canvas/create-asset-dialog"
import { AssetFilterOptions } from "@/components/library/assets/asset-filters"
import { AssetsPanel } from "@/components/library/assets/assets-panel"
import {
  ASSET_PAGE_LIMIT,
  COLUMN_COUNT_STORAGE_KEY,
} from "@/components/library/assets/constants"
import { HistoryFilterOptions } from "@/components/library/history/history-filters"
import { HistoryPanel } from "@/components/library/history/history-panel"
import { EmptyState, LoadingGrid, RetryState } from "@/components/library/history/history-states"
import type {
  Generation,
  GenerationType,
  HistorySource,
  PaginatedState,
} from "@/components/library/history/types"
import { useDebouncedValue } from "@/components/library/history/use-debounced-value"
import { useGenerationHistory } from "@/components/library/history/use-generation-history"
import {
  createEmptyPaginatedState,
  formatRelativeDate,
  historyGridColsClass,
  mergeUniqueById,
  normalizePagination,
} from "@/components/library/history/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  AssetCategory,
  AssetRecord,
  AssetType,
  AssetVisibility,
} from "@/lib/assets/types"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import { createClient } from "@/lib/supabase/client"
import { PRIVATE_UPLOAD_BUCKET } from "@/lib/uploads/shared"
import { cn } from "@/lib/utils"

type ModalTab = "history" | "assets" | "uploads"

type AssetsResponse = {
  assets?: AssetRecord[]
  pagination?: Partial<PaginatedState<AssetRecord>["pagination"]>
}

type UploadRecord = {
  id: string
  bucket: string
  storage_path: string
  mime_type: string
  label: string | null
  created_at: string
  original_filename?: string | null
}

type UploadListItem = {
  id: string
  url: string
  title: string
  createdAt: string
}

const UPLOADS_PAGE_LIMIT = 24

const tabLabels: Record<ModalTab, string> = {
  assets: "Assets",
  history: "History",
  uploads: "Uploads",
}

export type AssetSelectionSource = "asset" | "history" | "upload"

export type AssetSelectionPick = {
  id?: string
  /** Which library tab the pick came from — used for durable server-side media proxy. */
  source?: AssetSelectionSource
  previewUrl?: string | null
  title?: string
  url: string
  assetType: AssetType
}

interface AssetSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (pick: AssetSelectionPick) => void
  /** Pre-filter the assets tab to a category (e.g. character picker). */
  presetCategory?: AssetCategory
  /** Hide assets that do not match these types. */
  allowedAssetTypes?: AssetType[]
  /** Which tab opens first when the modal opens. */
  defaultTab?: ModalTab
}

function resolveDefaultHistoryType(allowedAssetTypes?: AssetType[]): GenerationType {
  if (!allowedAssetTypes?.length) return "all"
  if (allowedAssetTypes.length === 1) return allowedAssetTypes[0]
  return "all"
}

function UploadSelectCard({
  upload,
  onSelect,
}: {
  upload: UploadListItem
  onSelect: () => void
}) {
  return (
    <article className="group relative aspect-square overflow-hidden rounded-2xl border border-border/70 bg-card/45 shadow-sm transition-all hover:border-primary/50 hover:shadow-md">
      <button type="button" className="relative block h-full w-full overflow-hidden bg-muted text-left" onClick={onSelect}>
        <Image
          src={upload.url}
          alt={upload.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </button>

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between bg-black/50 p-3 opacity-0 transition-opacity duration-200 sm:group-hover:opacity-100">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">Upload</span>
          <span className="text-[10px] font-medium text-white/80 drop-shadow-sm">
            {formatRelativeDate(upload.createdAt)}
          </span>
        </div>
        <p className="truncate text-xs font-semibold text-white drop-shadow-sm">{upload.title}</p>
        <div className="pointer-events-auto flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            className="h-7 rounded-full border-none bg-white px-3 text-[10px] font-semibold text-black hover:bg-white/90"
            onClick={onSelect}
          >
            Select
          </Button>
        </div>
      </div>

      <div className="absolute inset-x-2 bottom-2 z-10 sm:hidden">
        <Button
          variant="secondary"
          size="sm"
          className="h-8 w-full rounded-full border-none bg-black/70 text-xs font-semibold text-white backdrop-blur"
          onClick={onSelect}
        >
          Select
        </Button>
      </div>
    </article>
  )
}

export function AssetSelectionModal({
  open,
  onOpenChange,
  onSelect,
  presetCategory,
  allowedAssetTypes,
  defaultTab = "assets",
}: AssetSelectionModalProps) {
  const [activeTab, setActiveTab] = React.useState<ModalTab>(defaultTab)
  const [search, setSearch] = React.useState("")
  const debouncedSearch = useDebouncedValue(search.trim(), 250)
  const [columnCount, setColumnCount] = React.useState(4)
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)
  const [isSheetOpen, setIsSheetOpen] = React.useState(false)

  const [historyType, setHistoryType] = React.useState<GenerationType>(() =>
    resolveDefaultHistoryType(allowedAssetTypes),
  )
  const [historySource, setHistorySource] = React.useState<HistorySource>("all")
  const [historyTool, setHistoryTool] = React.useState("all")
  const [assetVisibility, setAssetVisibility] = React.useState<AssetVisibility | "all">("all")
  const [assetCategory, setAssetCategory] = React.useState<AssetCategory | "all">(
    presetCategory ?? "all",
  )
  const [assetSource, setAssetSource] = React.useState("all")

  const [assetsState, setAssetsState] = React.useState<PaginatedState<AssetRecord>>(
    createEmptyPaginatedState<AssetRecord>(ASSET_PAGE_LIMIT),
  )
  const [uploadsState, setUploadsState] = React.useState<PaginatedState<UploadListItem>>(
    createEmptyPaginatedState<UploadListItem>(UPLOADS_PAGE_LIMIT),
  )
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null)
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
  const uploadsLoadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null)
  const uploadsStateRef = React.useRef(uploadsState)

  React.useEffect(() => {
    uploadsStateRef.current = uploadsState
  }, [uploadsState])

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

  React.useEffect(() => {
    if (!open) return
    setActiveTab(defaultTab)
    setAssetCategory(presetCategory ?? "all")
    setHistoryType(resolveDefaultHistoryType(allowedAssetTypes))
    setSearch("")
  }, [allowedAssetTypes, defaultTab, open, presetCategory])

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!cancelled) setCurrentUserId(user?.id ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  const {
    state: historyState,
    loadMoreSentinelRef: historyLoadMoreSentinelRef,
    refresh: refreshHistory,
    loadMore: loadMoreHistory,
  } = useGenerationHistory({
    enabled: open && activeTab === "history",
    historyType,
    historySource,
    historyTool,
    searchQuery: debouncedSearch,
  })

  const refreshAssets = React.useCallback(async () => {
    setAssetsState((prev) => ({
      ...prev,
      error: null,
      initialLoading: true,
      loadingMore: false,
    }))

    try {
      const params = new URLSearchParams({
        limit: String(ASSET_PAGE_LIMIT),
        offset: "0",
      })
      if (assetVisibility !== "all") params.set("visibility", assetVisibility)
      if (assetCategory !== "all") params.set("category", assetCategory)
      if (assetSource !== "all") params.set("sourceNodeType", assetSource)
      if (debouncedSearch) params.set("search", debouncedSearch)

      const response = await fetch(`/api/assets?${params.toString()}`)
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error || "Failed to load assets")
      }

      const data = (await response.json()) as AssetsResponse
      let nextAssets = Array.isArray(data.assets) ? data.assets : []
      if (allowedAssetTypes?.length) {
        nextAssets = nextAssets.filter((asset) => allowedAssetTypes.includes(asset.assetType))
      }
      const pagination = normalizePagination(data.pagination, {
        limit: ASSET_PAGE_LIMIT,
        offset: 0,
        returned: nextAssets.length,
      })

      setAssetsState({
        items: nextAssets,
        query: debouncedSearch,
        hasLoaded: true,
        initialLoading: false,
        loadingMore: false,
        error: null,
        nextOffset: pagination.offset + pagination.returned,
        pagination,
      })
    } catch (error) {
      setAssetsState((prev) => ({
        ...prev,
        items: [],
        hasLoaded: true,
        initialLoading: false,
        loadingMore: false,
        error: error instanceof Error ? error.message : "Failed to load assets",
      }))
    }
  }, [allowedAssetTypes, assetCategory, assetSource, assetVisibility, debouncedSearch])

  const fetchUploads = React.useCallback(async (append: boolean) => {
    const currentState = uploadsStateRef.current
    if (append ? currentState.loadingMore : currentState.initialLoading) return

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
        .range(offset, offset + UPLOADS_PAGE_LIMIT - 1)

      if (error) throw new Error(error.message)

      const rows = (data ?? []) as UploadRecord[]
      let nextUploads = await Promise.all(
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

      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase()
        nextUploads = nextUploads.filter((item) => item.title.toLowerCase().includes(query))
      }

      const total = count ?? offset + nextUploads.length
      const pagination = normalizePagination(
        {
          limit: UPLOADS_PAGE_LIMIT,
          offset,
          returned: nextUploads.length,
          total,
          hasMore: offset + nextUploads.length < total,
        },
        {
          limit: UPLOADS_PAGE_LIMIT,
          offset,
          returned: nextUploads.length,
        },
      )

      setUploadsState((prev) => ({
        ...prev,
        items: append ? mergeUniqueById(prev.items, nextUploads) : nextUploads,
        query: debouncedSearch,
        hasLoaded: true,
        initialLoading: false,
        loadingMore: false,
        error: null,
        nextOffset: pagination.offset + pagination.returned,
        pagination,
      }))
    } catch (error) {
      setUploadsState((prev) => ({
        ...prev,
        hasLoaded: true,
        initialLoading: false,
        loadingMore: false,
        error: error instanceof Error ? error.message : "Failed to load uploads",
      }))
    }
  }, [debouncedSearch])

  React.useEffect(() => {
    setAssetsState(createEmptyPaginatedState<AssetRecord>(ASSET_PAGE_LIMIT))
  }, [assetCategory, assetSource, assetVisibility, debouncedSearch])

  React.useEffect(() => {
    setUploadsState(createEmptyPaginatedState<UploadListItem>(UPLOADS_PAGE_LIMIT))
  }, [debouncedSearch])

  React.useEffect(() => {
    if (!open) return
    if (activeTab === "assets" && !assetsState.hasLoaded && !assetsState.initialLoading) {
      void refreshAssets()
    }
  }, [activeTab, assetsState.hasLoaded, assetsState.initialLoading, open, refreshAssets])

  React.useEffect(() => {
    if (!open) return
    if (activeTab === "uploads" && !uploadsState.hasLoaded && !uploadsState.initialLoading) {
      void fetchUploads(false)
    }
  }, [activeTab, fetchUploads, open, uploadsState.hasLoaded, uploadsState.initialLoading])

  React.useEffect(() => {
    if (activeTab !== "uploads") return
    const target = uploadsLoadMoreSentinelRef.current
    if (
      !target ||
      !uploadsState.hasLoaded ||
      uploadsState.initialLoading ||
      uploadsState.loadingMore ||
      uploadsState.error ||
      !uploadsState.pagination.hasMore
    ) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void fetchUploads(true)
      },
      { rootMargin: "400px 0px" },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [activeTab, fetchUploads, uploadsState])

  const handleSelect = React.useCallback(
    (pick: AssetSelectionPick) => {
      onSelect(pick)
      onOpenChange(false)
    },
    [onOpenChange, onSelect],
  )

  const handleSelectAsset = React.useCallback(
    (asset: AssetRecord) => {
      handleSelect({
        id: asset.id,
        source: "asset",
        previewUrl: asset.thumbnailUrl || asset.url,
        title: asset.title,
        url: asset.url,
        assetType: asset.assetType,
      })
    },
    [handleSelect],
  )

  const handleSelectGeneration = React.useCallback(
    (generation: Generation) => {
      if (allowedAssetTypes?.length && !allowedAssetTypes.includes(generation.type)) {
        toast.error("This media type can’t be used here")
        return
      }
      handleSelect({
        id: generation.id,
        source: generation.source === "upload" ? "upload" : "history",
        previewUrl: generation.url,
        title: generation.prompt || "Generated media",
        url: generation.url,
        assetType: generation.type,
      })
    },
    [allowedAssetTypes, handleSelect],
  )

  const handleCreateAssetFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
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

  const handleUploadReferenceFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
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
      setUploadsState(createEmptyPaginatedState<UploadListItem>(UPLOADS_PAGE_LIMIT))
      toast.success("Uploaded image ready to use")
      void fetchUploads(false)
    } finally {
      setUploadReferenceUploading(false)
    }
  }

  const historyItems = React.useMemo(() => {
    if (!allowedAssetTypes?.length) return historyState.items
    return historyState.items.filter((item) => allowedAssetTypes.includes(item.type))
  }, [allowedAssetTypes, historyState.items])

  const showFilters = activeTab === "history" || activeTab === "assets"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="fixed! inset-0! left-0! top-0! m-0! flex! h-dvh! max-h-dvh! w-screen! max-w-none! translate-x-0! translate-y-0! flex-col! gap-0! overflow-hidden rounded-none! border-0 p-0!"
        aria-describedby="asset-selection-description"
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
          <div className="container mx-auto flex min-h-0 flex-1 flex-col px-4 pb-6 pt-4">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <DialogHeader className="min-w-0 gap-1 p-0 text-left">
                <DialogTitle className="text-left text-3xl font-bold tracking-tight">
                  Library
                </DialogTitle>
                <p
                  id="asset-selection-description"
                  className="text-left text-sm text-muted-foreground"
                >
                  Pick from your assets, history, or uploads
                </p>
              </DialogHeader>

              <div className="flex flex-wrap items-center gap-2 pt-1 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1">
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

                {activeTab === "history" ? (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => void refreshHistory()}
                      title="Refresh history"
                      className="h-9 w-9 rounded-full transition-transform hover:rotate-[-20deg]"
                  >
                    <ClockCounterClockwise className="h-4 w-4" />
                  </Button>
                ) : null}

                {activeTab === "assets" ? (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => void refreshAssets()}
                      title="Refresh assets"
                      className="h-9 w-9 rounded-full transition-transform hover:rotate-[-20deg]"
                    >
                      <ClockCounterClockwise className="h-4 w-4" />
                    </Button>
                    <Button
                      className="gap-2 rounded-full transition-transform hover:-translate-y-0.5"
                      disabled={createAssetUploading}
                      onClick={() => createAssetFileInputRef.current?.click()}
                    >
                      <UploadSimple className="h-4 w-4" />
                      Upload
                    </Button>
                  </>
                ) : null}

                {activeTab === "uploads" ? (
                  <Button
                    className="gap-2 rounded-full transition-transform hover:-translate-y-0.5"
                    disabled={uploadReferenceUploading}
                    onClick={() => uploadReferenceInputRef.current?.click()}
                  >
                    <UploadSimple className="h-4 w-4" />
                    Upload image
                  </Button>
                ) : null}

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenChange(false)}
                  className="h-9 w-9 rounded-full transition-transform hover:rotate-90"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" weight="bold" />
                </Button>
              </div>
            </div>

            <div className="sticky top-0 z-30 -mx-4 mb-2 border-b border-border/20 bg-background/90 px-4 pt-0.5 pb-2 backdrop-blur supports-backdrop-filter:bg-background/70">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <Tabs
                  value={activeTab}
                  onValueChange={(value) => setActiveTab(value as ModalTab)}
                >
                  <TabsList className="h-auto max-w-full flex-wrap justify-start overflow-visible">
                    {(["assets", "history", "uploads"] as const).map((tab) => (
                      <TabsTrigger key={tab} value={tab} className="shrink-0 gap-2 px-4 py-1.5">
                        {tabLabels[tab]}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>

                <div className="flex w-full items-center gap-2 md:w-auto">
                  <div className="relative min-w-0 flex-1 transition-all duration-300 md:w-64 lg:w-80">
                    <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search..."
                      className="h-9 rounded-full border-border/50 bg-muted/40 pl-9 transition-all focus:bg-background"
                    />
                  </div>

                  {showFilters ? (
                    <>
                      <div className="hidden sm:block">
                        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 rounded-full border-border/50 bg-muted/40 hover:bg-muted"
                            >
                              <SlidersHorizontal className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="end"
                            className="w-72 border-border/60 bg-card p-0 shadow-lg"
                          >
                            {activeTab === "history" ? (
                              <HistoryFilterOptions
                                historyType={historyType}
                                onHistoryTypeChange={setHistoryType}
                                historySource={historySource}
                                onHistorySourceChange={setHistorySource}
                                historyTool={historyTool}
                                onHistoryToolChange={setHistoryTool}
                                columnCount={columnCount}
                                onColumnCountChange={handleColumnCountChange}
                              />
                            ) : (
                              <AssetFilterOptions
                                assetVisibility={assetVisibility}
                                onAssetVisibilityChange={setAssetVisibility}
                                assetCategory={assetCategory}
                                onAssetCategoryChange={setAssetCategory}
                                assetSource={assetSource}
                                onAssetSourceChange={setAssetSource}
                                columnCount={columnCount}
                                onColumnCountChange={handleColumnCountChange}
                                lockedCategory={presetCategory}
                              />
                            )}
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="block sm:hidden">
                        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                          <SheetTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 rounded-full border-border/50 bg-muted/40 hover:bg-muted"
                            >
                              <SlidersHorizontal className="h-4 w-4" />
                            </Button>
                          </SheetTrigger>
                          <SheetContent
                            side="bottom"
                            className="max-h-[85vh] rounded-t-3xl border-t border-border/60 bg-card p-2 pb-6"
                          >
                            <SheetHeader className="px-4 pt-3 pb-1">
                              <SheetTitle className="text-left text-lg font-semibold">
                                Filters
                              </SheetTitle>
                            </SheetHeader>
                            {activeTab === "history" ? (
                              <HistoryFilterOptions
                                historyType={historyType}
                                onHistoryTypeChange={setHistoryType}
                                historySource={historySource}
                                onHistorySourceChange={setHistorySource}
                                historyTool={historyTool}
                                onHistoryToolChange={setHistoryTool}
                                columnCount={columnCount}
                                onColumnCountChange={handleColumnCountChange}
                                showColumnSlider
                              />
                            ) : (
                              <AssetFilterOptions
                                assetVisibility={assetVisibility}
                                onAssetVisibilityChange={setAssetVisibility}
                                assetCategory={assetCategory}
                                onAssetCategoryChange={setAssetCategory}
                                assetSource={assetSource}
                                onAssetSourceChange={setAssetSource}
                                columnCount={columnCount}
                                onColumnCountChange={handleColumnCountChange}
                                showColumnSlider
                                lockedCategory={presetCategory}
                              />
                            )}
                          </SheetContent>
                        </Sheet>
                      </div>

                      <div className="hidden items-center gap-2 border-l border-border/40 pl-3 lg:flex">
                        <span className="whitespace-nowrap text-xs text-muted-foreground">
                          Columns:{" "}
                          <span className="font-medium text-primary">{columnCount}</span>
                        </span>
                        <Slider
                          value={[columnCount]}
                          onValueChange={(val) => handleColumnCountChange(val[0])}
                          min={2}
                          max={6}
                          step={1}
                          className="w-20"
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as ModalTab)}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <TabsContent
                value="assets"
                className="mt-0 min-h-0 flex-1 overflow-y-auto pt-3 data-[state=inactive]:hidden"
              >
                <AssetsPanel
                  visibility={assetVisibility}
                  category={assetCategory}
                  state={assetsState}
                  onRefresh={() => void refreshAssets()}
                  onUpload={() => createAssetFileInputRef.current?.click()}
                  currentUserId={currentUserId}
                  mode="select"
                  onOpen={handleSelectAsset}
                  onSelect={handleSelectAsset}
                  columnCount={columnCount}
                  onColumnCountChange={handleColumnCountChange}
                  emptyActionLabel="Upload"
                />
              </TabsContent>

              <TabsContent
                value="history"
                className="mt-0 min-h-0 flex-1 overflow-y-auto pt-3 data-[state=inactive]:hidden"
              >
                <HistoryPanel
                  actionVariant="select"
                  activeType={historyType}
                  state={historyState}
                  items={historyItems}
                  searchQuery={debouncedSearch}
                  onRefresh={() => void refreshHistory()}
                  onLoadMore={() => void loadMoreHistory()}
                  loadMoreRef={historyLoadMoreSentinelRef}
                  onOpen={handleSelectGeneration}
                  onCopy={() => undefined}
                  onDownload={() => undefined}
                  onDelete={() => undefined}
                  columnCount={columnCount}
                  onColumnCountChange={handleColumnCountChange}
                />
              </TabsContent>

              <TabsContent
                value="uploads"
                className="mt-0 min-h-0 flex-1 overflow-y-auto pt-3 data-[state=inactive]:hidden"
              >
                {uploadsState.initialLoading ? (
                  <LoadingGrid label="Loading uploads..." />
                ) : uploadsState.error && uploadsState.items.length === 0 ? (
                  <RetryState
                    centered
                    message={uploadsState.error}
                    onRetry={() => void fetchUploads(false)}
                  />
                ) : uploadsState.items.length === 0 ? (
                  <EmptyState
                    centered
                    icon={<UploadSimple className="h-7 w-7" />}
                    title="No uploaded reference images"
                    description="Upload an image here to use it without saving it as an asset."
                    action={
                      <Button onClick={() => uploadReferenceInputRef.current?.click()}>
                        Upload image
                      </Button>
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                      <div>
                        Showing {uploadsState.items.length} of {uploadsState.pagination.total}
                      </div>
                      <div className="flex items-center gap-2 lg:hidden">
                        <span className="text-xs">
                          Cols: <span className="font-medium text-primary">{columnCount}</span>
                        </span>
                        <Slider
                          value={[columnCount]}
                          onValueChange={(val) => handleColumnCountChange(val[0])}
                          min={2}
                          max={6}
                          step={1}
                          className="w-20"
                        />
                      </div>
                    </div>
                    <div className={cn("grid gap-2 sm:gap-3", historyGridColsClass(columnCount))}>
                      {uploadsState.items.map((upload) => (
                        <UploadSelectCard
                          key={upload.id}
                          upload={upload}
                          onSelect={() =>
                            handleSelect({
                              id: upload.id,
                              source: "upload",
                              previewUrl: upload.url,
                              title: upload.title,
                              url: upload.url,
                              assetType: "image",
                            })
                          }
                        />
                      ))}
                    </div>
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
          </div>
        </div>

        {createAssetInitial ? (
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
              category: presetCategory,
            }}
            onSaved={() => {
              setAssetsState(createEmptyPaginatedState<AssetRecord>(ASSET_PAGE_LIMIT))
              void refreshAssets()
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
