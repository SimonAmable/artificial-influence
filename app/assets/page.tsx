"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  ClockCounterClockwise,
  Copy,
  DownloadSimple,
  FolderSimple,
  MagnifyingGlass,
  PencilSimple,
  Play,
  Plus,
  SlidersHorizontal,
  Sparkle,
  UploadSimple,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { BrandKitCard } from "@/components/brand-kit/brand-kit-card"
import { BrandKitNewFlowDialog } from "@/components/brand-kit/brand-kit-new-flow-dialog"
import { CreateAssetDialog } from "@/components/canvas/create-asset-dialog"
import { CreateCollectionDialog } from "@/components/collections/create-collection-dialog"
import { SaveExampleDialog, type SaveExampleSnapshot } from "@/components/image/save-example-dialog"
import { AssetFilterOptions } from "@/components/library/assets/asset-filters"
import { AssetsPanel } from "@/components/library/assets/assets-panel"
import { ASSET_PAGE_LIMIT, COLUMN_COUNT_STORAGE_KEY } from "@/components/library/assets/constants"
import { HistoryFilterOptions } from "@/components/library/history/history-filters"
import { HistoryPanel } from "@/components/library/history/history-panel"
import { EmptyState, LoadingGrid, RetryState } from "@/components/library/history/history-states"
import {
  HISTORY_PAGE_LIMIT,
  HISTORY_TYPES,
} from "@/components/library/history/constants"
import type {
  Generation,
  GenerationType,
  HistoryResponse,
  HistorySource,
  MediaGenerationType,
  PaginatedState,
  PaginationState,
  SaveAssetDraft,
} from "@/components/library/history/types"
import {
  createEmptyPaginatedState,
  createHistoryUrl,
  formatRelativeDate as formatDate,
  historyItemDeleteUrl,
  mergeUniqueById,
  normalizePagination,
} from "@/components/library/history/utils"
import { useDebouncedValue } from "@/components/library/history/use-debounced-value"
import {
  FullscreenMediaViewer,
  type FullscreenMediaViewerAction,
} from "@/components/shared/display/fullscreen-media-viewer"
import { copyMediaToClipboard, downloadMediaFile } from "@/components/shared/display/media-viewer-utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Slider } from "@/components/ui/slider"
import type { AssetCategory, AssetRecord, AssetType, AssetVisibility } from "@/lib/assets/types"
import { deleteAsset } from "@/lib/assets/library"
import type { BrandKit } from "@/lib/brand-kit/types"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import type { SlideshowCollection } from "@/lib/slideshow/types"
import { createClient } from "@/lib/supabase/client"
import { isPresenceProduct } from "@/lib/product/require-presence"

type LibraryTab = "history" | "assets" | "brands" | "collections"

type AssetsResponse = {
  assets?: AssetRecord[]
  pagination?: Partial<PaginationState>
}

type BrandKitsResponse = {
  kits?: BrandKit[]
}

type CollectionsResponse = {
  collections?: SlideshowCollection[]
}

type ViewerItem = {
  kind: "image" | "video"
  url: string
  title: string
  metadata: {
    id?: string
    model?: string | null
    prompt?: string | null
    tool?: string | null
    aspectRatio?: string | null
    type?: string | null
    createdAt?: string | null
  }
  referenceImages?: { imageUrl: string }[]
  actions: FullscreenMediaViewerAction[]
}

const ALL_LIBRARY_TABS: LibraryTab[] = ["history", "assets", "brands", "collections"]

function getLibraryTabs(): LibraryTab[] {
  if (isPresenceProduct()) {
    return ALL_LIBRARY_TABS.filter((tab) => tab !== "brands")
  }
  return ALL_LIBRARY_TABS
}

const tabLabels: Record<LibraryTab, string> = {
  history: "History",
  assets: "Assets",
  brands: "Brands",
  collections: "Collections",
}

function normalizeLibraryTab(value: string | null, tabs: LibraryTab[] = getLibraryTabs()): LibraryTab {
  return tabs.includes(value as LibraryTab) ? (value as LibraryTab) : "assets"
}

function getDefaultCategoryByMediaType(type: AssetType): AssetCategory {
  if (type === "video") return "shorts"
  if (type === "audio") return "element"
  return "character"
}

function mediaMatchesSearch(value: string, fields: Array<string | null | undefined>) {
  const query = value.trim().toLowerCase()
  if (!query) return true
  return fields.some((field) => field?.toLowerCase().includes(query))
}

function FilterOptionsContent({
  activeTab,
  historyType,
  setHistoryType,
  historySource,
  setHistorySource,
  historyTool,
  setHistoryTool,
  assetVisibility,
  setAssetVisibility,
  assetCategory,
  setCategory,
  assetSource,
  setAssetSource,
  columnCount,
  onColumnCountChange,
  isMobile = false,
}: {
  activeTab: LibraryTab
  historyType: GenerationType
  setHistoryType: (type: GenerationType) => void
  historySource: HistorySource
  setHistorySource: (source: HistorySource) => void
  historyTool: string
  setHistoryTool: (tool: string) => void
  assetVisibility: AssetVisibility | "all"
  setAssetVisibility: (visibility: AssetVisibility | "all") => void
  assetCategory: AssetCategory | "all"
  setCategory: (category: AssetCategory | "all") => void
  assetSource: string
  setAssetSource: (source: string) => void
  columnCount: number
  onColumnCountChange: (value: number) => void
  isMobile?: boolean
}) {
  if (activeTab === "history") {
    return (
      <HistoryFilterOptions
        historyType={historyType}
        onHistoryTypeChange={setHistoryType}
        historySource={historySource}
        onHistorySourceChange={setHistorySource}
        historyTool={historyTool}
        onHistoryToolChange={setHistoryTool}
        columnCount={columnCount}
        onColumnCountChange={onColumnCountChange}
        showColumnSlider={isMobile}
      />
    )
  }

  if (activeTab === "assets") {
    return (
      <AssetFilterOptions
        assetVisibility={assetVisibility}
        onAssetVisibilityChange={setAssetVisibility}
        assetCategory={assetCategory}
        onAssetCategoryChange={setCategory}
        assetSource={assetSource}
        onAssetSourceChange={setAssetSource}
        columnCount={columnCount}
        onColumnCountChange={onColumnCountChange}
        showColumnSlider={isMobile}
      />
    )
  }

  return null
}

function LibraryPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const libraryTabs = React.useMemo(() => getLibraryTabs(), [])
  const requestedTab = searchParams.get("tab")
  const [activeTab, setActiveTab] = React.useState<LibraryTab>(() => normalizeLibraryTab(requestedTab, libraryTabs))

  React.useEffect(() => {
    const nextTab = normalizeLibraryTab(requestedTab, libraryTabs)
    setActiveTab((current) => (current === nextTab ? current : nextTab))
  }, [libraryTabs, requestedTab])

  React.useEffect(() => {
    if (requestedTab === "brands" && !libraryTabs.includes("brands")) {
      const params = new URLSearchParams(searchParams.toString())
      params.set("tab", "assets")
      router.replace(`/assets?${params.toString()}`, { scroll: false })
    }
  }, [libraryTabs, requestedTab, router, searchParams])

  const [search, setSearch] = React.useState("")
  const debouncedSearch = useDebouncedValue(search.trim(), 250)
  const [columnCount, setColumnCount] = React.useState(2)
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)
  const [isSheetOpen, setIsSheetOpen] = React.useState(false)

  React.useEffect(() => {
    const saved = window.localStorage.getItem(COLUMN_COUNT_STORAGE_KEY)
    if (saved) {
      const parsed = parseInt(saved, 10)
      if (!isNaN(parsed) && parsed >= 2 && parsed <= 6) {
        setColumnCount(parsed)
      }
    }
  }, [])

  const handleColumnCountChange = React.useCallback((value: number) => {
    setColumnCount(value)
    window.localStorage.setItem(COLUMN_COUNT_STORAGE_KEY, String(value))
  }, [])

  const [historyType, setHistoryType] = React.useState<GenerationType>("all")
  const [historySource, setHistorySource] = React.useState<HistorySource>("all")
  const [historyTool, setHistoryTool] = React.useState<string>("all")
  const [assetVisibility, setAssetVisibility] = React.useState<AssetVisibility | "all">("all")
  const [assetCategory, setAssetCategory] = React.useState<AssetCategory | "all">("all")
  const [assetSource, setAssetSource] = React.useState<string>("all")
  const [historyStates, setHistoryStates] = React.useState<Record<GenerationType, PaginatedState<Generation>>>({
    all: createEmptyPaginatedState<Generation>(HISTORY_PAGE_LIMIT),
    image: createEmptyPaginatedState<Generation>(HISTORY_PAGE_LIMIT),
    video: createEmptyPaginatedState<Generation>(HISTORY_PAGE_LIMIT),
    audio: createEmptyPaginatedState<Generation>(HISTORY_PAGE_LIMIT),
  })
  const [assetsState, setAssetsState] = React.useState<PaginatedState<AssetRecord>>(
    createEmptyPaginatedState<AssetRecord>(ASSET_PAGE_LIMIT),
  )
  const [brandKits, setBrandKits] = React.useState<BrandKit[]>([])
  const [brandsLoading, setBrandsLoading] = React.useState(false)
  const [brandsError, setBrandsError] = React.useState<string | null>(null)
  const [brandsHasLoaded, setBrandsHasLoaded] = React.useState(false)
  const [brandFlowOpen, setBrandFlowOpen] = React.useState(false)
  const [collectionDialogOpen, setCollectionDialogOpen] = React.useState(false)
  const [collections, setCollections] = React.useState<SlideshowCollection[]>([])
  const [collectionsLoading, setCollectionsLoading] = React.useState(false)
  const [collectionsError, setCollectionsError] = React.useState<string | null>(null)
  const [collectionsHasLoaded, setCollectionsHasLoaded] = React.useState(false)
  const [viewerItem, setViewerItem] = React.useState<ViewerItem | null>(null)
  const [copiedUrl, setCopiedUrl] = React.useState<string | null>(null)
  const [saveDraft, setSaveDraft] = React.useState<SaveAssetDraft | null>(null)
  const [saveExampleDialogOpen, setSaveExampleDialogOpen] = React.useState(false)
  const [saveExampleSnapshot, setSaveExampleSnapshot] = React.useState<SaveExampleSnapshot | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [editingAsset, setEditingAsset] = React.useState<AssetRecord | null>(null)
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [isDraggingOver, setIsDraggingOver] = React.useState(false)
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null)

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const dragCounter = React.useRef(0)
  const historyStatesRef = React.useRef(historyStates)
  const historyRequestIdRef = React.useRef(0)
  const historyLoadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    historyStatesRef.current = historyStates
  }, [historyStates])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!cancelled) {
        setCurrentUserId(user?.id ?? null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleActiveTabChange = React.useCallback(
    (nextTab: LibraryTab) => {
      setActiveTab(nextTab)
      const params = new URLSearchParams(searchParams.toString())
      params.set("tab", nextTab)
      router.replace(`/assets?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  const copyReference = React.useCallback(async (url: string, label = "Reference URL copied") => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedUrl(url)
      toast.success(label, {
        description: "Paste it into a generator, prompt, or asset picker when you need this media.",
      })
      window.setTimeout(() => setCopiedUrl((current) => (current === url ? null : current)), 1500)
    } catch {
      toast.error("Could not copy reference URL")
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

  const copyMedia = React.useCallback(async (url: string, type: AssetType) => {
    if (type === "audio") {
      await copyReference(url, "Audio URL copied")
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
  }, [copyReference])

  const openImageEditor = React.useCallback(
    (url: string) => {
      router.push(`/image-editor?image=${encodeURIComponent(url)}`)
    },
    [router],
  )

  const openSaveExampleDialog = React.useCallback((snapshot: SaveExampleSnapshot) => {
    setSaveExampleSnapshot(snapshot)
    setSaveExampleDialogOpen(true)
  }, [])

  const handleAnimateUrl = React.useCallback(
    (url: string, type: AssetType | MediaGenerationType) => {
      if (type !== "image") {
        toast.error("Animate is only available for image media")
        return
      }

      router.push(`/video?startFrame=${encodeURIComponent(url)}`)
    },
    [router],
  )

  const handleSaveExampleFromAsset = React.useCallback(
    (asset: AssetRecord) => {
      if (asset.assetType !== "image") {
        toast.error("Save Example is only available for image media")
        return
      }

      openSaveExampleDialog({
        prompt: asset.description?.trim() || asset.title,
        referenceImageUrls: [asset.url],
        coverUrl: asset.thumbnailUrl || asset.url,
        selectedModel: "",
        selectedAspectRatio: "auto",
        selectedNumImages: 1,
        selectedModelParameters: {},
        enhancePrompt: false,
        sourceGenerationId: asset.sourceGenerationId ?? null,
      })
    },
    [openSaveExampleDialog],
  )

  const handleSaveExampleFromGeneration = React.useCallback(
    (generation: Generation) => {
      if (generation.type !== "image") {
        toast.error("Save Example is only available for image media")
        return
      }

      openSaveExampleDialog({
        prompt: generation.prompt?.trim() || `Image generation ${generation.id.slice(0, 8)}`,
        referenceImageUrls: generation.reference_image_urls ?? [],
        coverUrl: generation.url,
        selectedModel: generation.model ?? "",
        selectedAspectRatio: generation.aspect_ratio ?? "auto",
        selectedNumImages: 1,
        selectedModelParameters: {},
        enhancePrompt: false,
        sourceGenerationId: generation.id,
      })
    },
    [openSaveExampleDialog],
  )

  const openSaveDraft = React.useCallback((draft: SaveAssetDraft) => {
    setSaveDraft(draft)
    setCreateDialogOpen(true)
  }, [])

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
      const nextAssets = Array.isArray(data.assets) ? data.assets : []
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
  }, [assetCategory, assetVisibility, assetSource, debouncedSearch])

  const fetchGenerations = React.useCallback(async (type: GenerationType, append: boolean) => {
    const currentState = historyStatesRef.current[type]
    if (append ? currentState.loadingMore : currentState.initialLoading) return
    const searchQuery = debouncedSearch
    const requestId = ++historyRequestIdRef.current

    setHistoryStates((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        error: null,
        query: searchQuery,
        initialLoading: append ? prev[type].initialLoading : true,
        loadingMore: append,
      },
    }))

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setHistoryStates((prev) => ({
          ...prev,
          [type]: {
            ...prev[type],
            hasLoaded: true,
            initialLoading: false,
            loadingMore: false,
            error: "Please log in to view your generation history.",
          },
        }))
        return
      }

      const offset = append && currentState.query === searchQuery ? currentState.nextOffset : 0
      const response = await fetch(
        createHistoryUrl(type, HISTORY_PAGE_LIMIT, offset, searchQuery, historyTool, historySource)
      )
      if (!response.ok) throw new Error("Failed to fetch history")

      const data = (await response.json()) as HistoryResponse
      if (requestId !== historyRequestIdRef.current) return

      const nextGenerations = Array.isArray(data.generations) ? data.generations : []
      const pagination = normalizePagination(data.pagination, {
        limit: HISTORY_PAGE_LIMIT,
        offset,
        returned: nextGenerations.length,
      })

      setHistoryStates((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          items: append && prev[type].query === searchQuery ? mergeUniqueById(prev[type].items, nextGenerations) : nextGenerations,
          query: searchQuery,
          hasLoaded: true,
          initialLoading: false,
          loadingMore: false,
          error: null,
          nextOffset: pagination.offset + pagination.returned,
          pagination,
        },
      }))
    } catch (error) {
      if (requestId !== historyRequestIdRef.current) return

      setHistoryStates((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          query: searchQuery,
          hasLoaded: true,
          initialLoading: false,
          loadingMore: false,
          error: error instanceof Error ? error.message : "Failed to fetch generations",
        },
      }))
    }
  }, [debouncedSearch, historySource, historyTool])

  const refreshBrands = React.useCallback(async () => {
    setBrandsLoading(true)
    setBrandsError(null)
    try {
      const response = await fetch("/api/brand-kits")
      if (!response.ok) throw new Error("Failed to load brand kits")
      const data = (await response.json()) as BrandKitsResponse
      setBrandKits(Array.isArray(data.kits) ? data.kits : [])
    } catch (error) {
      setBrandKits([])
      setBrandsError(error instanceof Error ? error.message : "Failed to load brand kits")
    } finally {
      setBrandsLoading(false)
      setBrandsHasLoaded(true)
    }
  }, [])

  const refreshCollections = React.useCallback(async () => {
    setCollectionsLoading(true)
    setCollectionsError(null)
    try {
      const response = await fetch("/api/slideshow/collections")
      if (!response.ok) throw new Error("Failed to load collections")
      const data = (await response.json()) as CollectionsResponse
      setCollections(Array.isArray(data.collections) ? data.collections : [])
    } catch (error) {
      setCollections([])
      setCollectionsError(error instanceof Error ? error.message : "Failed to load collections")
    } finally {
      setCollectionsLoading(false)
      setCollectionsHasLoaded(true)
    }
  }, [])

  React.useEffect(() => {
    if (activeTab === "assets") {
      void refreshAssets()
    }
  }, [activeTab, refreshAssets])

  React.useEffect(() => {
    setHistoryStates({
      all: createEmptyPaginatedState<Generation>(HISTORY_PAGE_LIMIT),
      image: createEmptyPaginatedState<Generation>(HISTORY_PAGE_LIMIT),
      video: createEmptyPaginatedState<Generation>(HISTORY_PAGE_LIMIT),
      audio: createEmptyPaginatedState<Generation>(HISTORY_PAGE_LIMIT),
    })
  }, [historyTool, historySource])

  React.useEffect(() => {
    const state = historyStates[historyType]
    if (
      activeTab === "history" &&
      (!state.hasLoaded || state.query !== debouncedSearch) &&
      !state.initialLoading
    ) {
      void fetchGenerations(historyType, false)
    }
  }, [activeTab, debouncedSearch, fetchGenerations, historyStates, historyType])

  React.useEffect(() => {
    if (activeTab === "brands" && !brandsHasLoaded && !brandsLoading) {
      void refreshBrands()
    }
  }, [activeTab, brandsHasLoaded, brandsLoading, refreshBrands])

  React.useEffect(() => {
    if (activeTab === "collections" && !collectionsHasLoaded && !collectionsLoading) {
      void refreshCollections()
    }
  }, [activeTab, collectionsHasLoaded, collectionsLoading, refreshCollections])

  React.useEffect(() => {
    if (activeTab !== "history") return

    const target = historyLoadMoreSentinelRef.current
    const state = historyStates[historyType]
    if (!target || !state.hasLoaded || state.initialLoading || state.loadingMore || state.error || !state.pagination.hasMore) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchGenerations(historyType, true)
        }
      },
      { rootMargin: "400px 0px" },
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [activeTab, fetchGenerations, historyStates, historyType])

  const handleFileUpload = React.useCallback(
    async (file: File) => {
      if (!file) return
      const type = file.type
      const isImage = type.startsWith("image/")
      const isVideo = type.startsWith("video/")
      const isAudio = type.startsWith("audio/")
      if (!isImage && !isVideo && !isAudio) {
        toast.error("Please select an image, video, or audio file")
        return
      }

      const result = await uploadFileToSupabase(file, "asset-library")
      if (!result) return
      if (result.fileType === "other") {
        toast.error("Unsupported file type. Use image, video, or audio.")
        return
      }

      openSaveDraft({
        url: result.url,
        uploadId: result.uploadId,
        supabaseStoragePath: result.storagePath,
        assetType: result.fileType,
        title: result.fileName,
        category: assetCategory !== "all" ? assetCategory : getDefaultCategoryByMediaType(result.fileType),
        visibility: "private",
      })
    },
    [assetCategory, openSaveDraft],
  )

  const handleFileSelect = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ""
      if (!file) return
      await handleFileUpload(file)
    },
    [handleFileUpload],
  )

  const handleDragOver = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer.types.includes("Files")) {
      setIsDraggingOver(true)
    }
  }, [])

  const handleDragEnter = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer.types.includes("Files")) {
      dragCounter.current += 1
      setIsDraggingOver(true)
    }
  }, [])

  const handleDragLeave = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDraggingOver(false)
    }
  }, [])

  const handleDrop = React.useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      dragCounter.current = 0
      setIsDraggingOver(false)

      const files = event.dataTransfer.files
      if (!files || files.length === 0) return
      if (files.length > 1) toast.info("Using the first file only")

      await handleFileUpload(files[0])
    },
    [handleFileUpload],
  )

  const handleDeleteAsset = React.useCallback(async (asset: AssetRecord) => {
    if (!confirm("Delete this saved asset?")) return
    try {
      await deleteAsset(asset.id)
      setAssetsState((prev) => ({
        ...prev,
        items: prev.items.filter((item) => item.id !== asset.id),
        pagination: {
          ...prev.pagination,
          total: Math.max(prev.pagination.total - 1, 0),
        },
      }))
      toast.success("Asset deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete asset")
    }
  }, [])

  const handleDeleteGeneration = React.useCallback(async (generation: Generation) => {
    if (!confirm(generation.source === "upload" ? "Delete this upload?" : "Delete this generation?")) return
    try {
      const response = await fetch(historyItemDeleteUrl(generation), {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Failed to delete media")

      setHistoryStates((prev) => {
        const next = { ...prev }
        for (const type of HISTORY_TYPES) {
          if (!next[type].hasLoaded) continue
          const shouldDecrement = type === "all" || type === generation.type
          next[type] = {
            ...next[type],
            items: next[type].items.filter((item) => item.id !== generation.id),
            pagination: {
              ...next[type].pagination,
              total: shouldDecrement ? Math.max(next[type].pagination.total - 1, 0) : next[type].pagination.total,
            },
          }
        }
        return next
      })
      toast.success(generation.source === "upload" ? "Upload deleted" : "Generation deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete media")
    }
  }, [])

  const openAssetViewer = React.useCallback(
    (asset: AssetRecord) => {
      if (asset.assetType === "audio") return
      const actions: FullscreenMediaViewerAction[] = [
        {
          id: "copy",
          label: "Copy",
          icon: <Copy className="size-4" />,
          onClick: () => void copyMedia(asset.url, asset.assetType),
        },
        {
          id: "reference",
          label: "Use as reference",
          icon: <Sparkle className="size-4" />,
          onClick: () => void copyReference(asset.url),
        },
        ...(asset.assetType === "image"
          ? [
              {
                id: "save-example",
                label: "Save Example",
                icon: <Sparkle className="size-4" weight="regular" />,
                onClick: () => handleSaveExampleFromAsset(asset),
              } satisfies FullscreenMediaViewerAction,
              {
                id: "animate",
                label: "Animate",
                icon: <Play className="size-4" weight="fill" />,
                onClick: () => handleAnimateUrl(asset.url, asset.assetType),
              } satisfies FullscreenMediaViewerAction,
            ]
          : []),
        {
          id: "download",
          label: "Download",
          icon: <DownloadSimple className="size-4" />,
          onClick: () => void downloadByUrl(asset.url, asset.assetType, asset.title),
        },
      ]

      if (asset.assetType === "image") {
        actions.splice(2, 0, {
          id: "edit",
          label: "Edit image",
          icon: <PencilSimple className="size-4" />,
          onClick: () => openImageEditor(asset.url),
        })
      }

      setViewerItem({
        kind: asset.assetType,
        url: asset.url,
        title: asset.title,
        metadata: {
          id: asset.id,
          prompt: asset.description ?? null,
          tool: "asset-library",
          type: asset.assetType,
          createdAt: asset.createdAt,
        },
        actions,
      })
    },
    [copyMedia, copyReference, downloadByUrl, handleAnimateUrl, handleSaveExampleFromAsset, openImageEditor],
  )

  const openGenerationViewer = React.useCallback(
    (generation: Generation) => {
      if (generation.type === "audio") return
      const actions: FullscreenMediaViewerAction[] = [
        {
          id: "save",
          label: "Save to assets",
          icon: <Plus className="size-4" />,
          onClick: () =>
            openSaveDraft({
              url: generation.url,
              assetType: generation.type,
              title: `${generation.type} ${generation.id.slice(0, 8)}`,
              category: getDefaultCategoryByMediaType(generation.type),
              visibility: "private",
              sourceGenerationId: generation.id,
              sourceNodeType: "generation-history",
              description: generation.prompt ?? undefined,
            }),
        },
        ...(generation.type === "image"
          ? [
              {
                id: "save-example",
                label: "Save Example",
                icon: <Sparkle className="size-4" weight="regular" />,
                onClick: () => handleSaveExampleFromGeneration(generation),
              } satisfies FullscreenMediaViewerAction,
              {
                id: "animate",
                label: "Animate",
                icon: <Play className="size-4" weight="fill" />,
                onClick: () => handleAnimateUrl(generation.url, generation.type),
              } satisfies FullscreenMediaViewerAction,
            ]
          : []),
        {
          id: "copy",
          label: "Copy",
          icon: <Copy className="size-4" />,
          onClick: () => void copyMedia(generation.url, generation.type),
        },
        {
          id: "reference",
          label: "Use as reference",
          icon: <Sparkle className="size-4" />,
          onClick: () => void copyReference(generation.url),
        },
        {
          id: "download",
          label: "Download",
          icon: <DownloadSimple className="size-4" />,
          onClick: () => void downloadByUrl(generation.url, generation.type, generation.type),
        },
      ]

      if (generation.type === "image") {
        actions.splice(3, 0, {
          id: "edit",
          label: "Edit image",
          icon: <PencilSimple className="size-4" />,
          onClick: () => openImageEditor(generation.url),
        })
      }

      setViewerItem({
        kind: generation.type,
        url: generation.url,
        title: generation.prompt || `${generation.type} generation`,
        metadata: {
          id: generation.id,
          model: generation.model,
          prompt: generation.prompt,
          tool: generation.tool,
          aspectRatio: generation.aspect_ratio,
          type: generation.type,
          createdAt: generation.created_at,
        },
        referenceImages: generation.reference_image_urls?.map((imageUrl) => ({ imageUrl })) ?? [],
        actions,
      })
    },
    [
      copyMedia,
      copyReference,
      downloadByUrl,
      handleAnimateUrl,
      handleSaveExampleFromGeneration,
      openImageEditor,
      openSaveDraft,
    ],
  )

  const filteredBrandKits = React.useMemo(
    () => brandKits.filter((kit) => mediaMatchesSearch(debouncedSearch, [kit.name, kit.websiteUrl, kit.tagline])),
    [brandKits, debouncedSearch],
  )

  const filteredCollections = React.useMemo(
    () => collections.filter((collection) => mediaMatchesSearch(debouncedSearch, [collection.name, collection.description])),
    [collections, debouncedSearch],
  )

  const totalHistoryCount = Math.max(...HISTORY_TYPES.map((type) => historyStates[type].pagination.total), 0)
  const tabCounts: Partial<Record<LibraryTab, number>> = {
    history: totalHistoryCount,
    assets: assetsState.pagination.total,
    brands: brandKits.length,
    collections: collections.length,
  }

  return (
    <div
      className="relative min-h-screen w-full bg-background text-foreground"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex pointer-events-none flex-col items-center justify-center gap-4 bg-background/95 backdrop-blur-sm"
          >
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
              <UploadSimple className="h-12 w-12 text-primary" weight="bold" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">Drop to add to your library</p>
              <p className="mt-1 text-sm text-muted-foreground">Images, videos, or audio files</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 pb-8 pt-14">
        <div className="mb-0 flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight">Library</h1>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            className="hidden"
            aria-hidden
            onChange={handleFileSelect}
          />
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === "history" ? (
              <Button variant="outline" size="icon" onClick={() => void fetchGenerations(historyType, false)} title="Refresh history">
                <ClockCounterClockwise className="h-4 w-4" />
              </Button>
            ) : null}
            {activeTab === "assets" ? (
              <>
                <Button variant="outline" size="icon" onClick={() => void refreshAssets()} title="Refresh assets">
                  <ClockCounterClockwise className="h-4 w-4" />
                </Button>
                <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <UploadSimple className="h-4 w-4" />
                  Upload
                </Button>
              </>
            ) : null}
            {activeTab === "brands" ? (
              <>
                <Button variant="outline" size="icon" onClick={() => void refreshBrands()} title="Refresh brands">
                  <ClockCounterClockwise className="h-4 w-4" />
                </Button>
                <Button className="gap-2" onClick={() => setBrandFlowOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New brand kit
                </Button>
              </>
            ) : null}
            {activeTab === "collections" ? (
              <>
                <Button variant="outline" size="icon" onClick={() => void refreshCollections()} title="Refresh collections">
                  <ClockCounterClockwise className="h-4 w-4" />
                </Button>
                <Button className="gap-2" onClick={() => setCollectionDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New collection
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <div className="sticky top-[58px] z-30 -mx-4 mb-2 bg-background/90 px-4 pt-0.5 pb-2 border-b border-border/20 backdrop-blur supports-backdrop-filter:bg-background/70">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Tabs value={activeTab} onValueChange={(value) => handleActiveTabChange(value as LibraryTab)}>
              <TabsList className="h-auto max-w-full flex-wrap justify-start overflow-visible">
                {libraryTabs.map((tab) => (
                  <TabsTrigger key={tab} value={tab} className="shrink-0 gap-2 px-4 py-1.5">
                    {tabLabels[tab]}
                    {tabCounts[tab] ? (
                      <span className="hidden sm:inline-block rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {tabCounts[tab]}
                      </span>
                    ) : null}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 min-w-0 md:w-64 lg:w-80 transition-all duration-300">
                <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search..."
                  className="h-9 rounded-full pl-9 bg-muted/40 border-border/50 focus:bg-background transition-all"
                />
              </div>

              {(activeTab === "history" || activeTab === "assets") && (
                <>
                  {/* Desktop Popover Filters */}
                  <div className="hidden sm:block">
                    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-border/50 bg-muted/40 hover:bg-muted">
                          <SlidersHorizontal className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-72 p-0 bg-card border-border/60 shadow-lg">
                        <FilterOptionsContent
                          activeTab={activeTab}
                          historyType={historyType}
                          setHistoryType={setHistoryType}
                          historySource={historySource}
                          setHistorySource={setHistorySource}
                          historyTool={historyTool}
                          setHistoryTool={setHistoryTool}
                          assetVisibility={assetVisibility}
                          setAssetVisibility={setAssetVisibility}
                          assetCategory={assetCategory}
                          setCategory={setAssetCategory}
                          assetSource={assetSource}
                          setAssetSource={setAssetSource}
                          columnCount={columnCount}
                          onColumnCountChange={handleColumnCountChange}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Mobile Sheet Filters */}
                  <div className="block sm:hidden">
                    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                      <SheetTrigger asChild>
                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-border/50 bg-muted/40 hover:bg-muted">
                          <SlidersHorizontal className="h-4 w-4" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="bottom" className="rounded-t-3xl border-t border-border/60 bg-card p-2 pb-6 max-h-[85vh]">
                        <SheetHeader className="px-4 pt-3 pb-1">
                          <SheetTitle className="text-left font-semibold text-lg">Filters</SheetTitle>
                        </SheetHeader>
                        <FilterOptionsContent
                          activeTab={activeTab}
                          historyType={historyType}
                          setHistoryType={setHistoryType}
                          historySource={historySource}
                          setHistorySource={setHistorySource}
                          historyTool={historyTool}
                          setHistoryTool={setHistoryTool}
                          assetVisibility={assetVisibility}
                          setAssetVisibility={setAssetVisibility}
                          assetCategory={assetCategory}
                          setCategory={setAssetCategory}
                          assetSource={assetSource}
                          setAssetSource={setAssetSource}
                          columnCount={columnCount}
                          onColumnCountChange={handleColumnCountChange}
                          isMobile={true}
                        />
                      </SheetContent>
                    </Sheet>
                  </div>

                  {/* Desktop Columns Slider */}
                  <div className="hidden lg:flex items-center gap-2 border-l border-border/40 pl-3">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Columns: <span className="text-primary font-medium">{columnCount}</span></span>
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
              )}
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => handleActiveTabChange(value as LibraryTab)} className="w-full">
          <TabsContent value="history" className="mt-0 w-full pt-3">
            <HistoryPanel
              activeType={historyType}
              state={historyStates[historyType]}
              items={historyStates[historyType].items}
              searchQuery={debouncedSearch}
              onRefresh={() => void fetchGenerations(historyType, false)}
              onLoadMore={() => void fetchGenerations(historyType, true)}
              loadMoreRef={historyLoadMoreSentinelRef}
              onOpen={openGenerationViewer}
              onSave={openSaveDraft}
              onSaveExample={handleSaveExampleFromGeneration}
              onAnimate={(media) => handleAnimateUrl(media.url, media.type)}
              onCopy={copyMedia}
              onDownload={downloadByUrl}
              onDelete={handleDeleteGeneration}
              onEditImage={openImageEditor}
              columnCount={columnCount}
              onColumnCountChange={handleColumnCountChange}
              getDefaultCategoryByMediaType={getDefaultCategoryByMediaType}
            />
          </TabsContent>

          <TabsContent value="assets" className="mt-0 w-full pt-3">
            <AssetsPanel
              visibility={assetVisibility}
              category={assetCategory}
              state={assetsState}
              onRefresh={() => void refreshAssets()}
              onUpload={() => fileInputRef.current?.click()}
              currentUserId={currentUserId}
              onOpen={openAssetViewer}
              onSaveExample={handleSaveExampleFromAsset}
              onAnimate={(asset) => handleAnimateUrl(asset.url, asset.assetType)}
              onCopy={copyMedia}
              onReference={copyReference}
              onDownload={downloadByUrl}
              onEdit={(asset) => {
                setEditingAsset(asset)
                setEditDialogOpen(true)
              }}
              onDelete={handleDeleteAsset}
              onEditImage={openImageEditor}
              columnCount={columnCount}
              onColumnCountChange={handleColumnCountChange}
            />
          </TabsContent>

          <TabsContent value="brands" className="mt-0 w-full pt-3">
            <BrandsPanel
              kits={filteredBrandKits}
              loading={brandsLoading}
              error={brandsError}
              onRefresh={() => void refreshBrands()}
              onCreate={() => setBrandFlowOpen(true)}
              onDeleted={(id) => setBrandKits((prev) => prev.filter((kit) => kit.id !== id))}
            />
          </TabsContent>

          <TabsContent value="collections" className="mt-0 w-full pt-3">
            <CollectionsPanel
              collections={filteredCollections}
              totalCount={collections.length}
              searchQuery={debouncedSearch}
              loading={collectionsLoading}
              error={collectionsError}
              onRefresh={() => void refreshCollections()}
              onCreate={() => setCollectionDialogOpen(true)}
              onCopyReference={copyReference}
            />
          </TabsContent>
        </Tabs>
      </div>

      {viewerItem && (
        <FullscreenMediaViewer
          kind={viewerItem.kind}
          url={viewerItem.url}
          title={viewerItem.title}
          metadata={viewerItem.metadata}
          referenceImages={viewerItem.referenceImages}
          copiedUrl={copiedUrl}
          onClose={() => setViewerItem(null)}
          actions={viewerItem.actions}
        />
      )}

      {saveDraft && (
        <CreateAssetDialog
          open={createDialogOpen}
          onOpenChange={(open) => {
            setCreateDialogOpen(open)
            if (!open) setSaveDraft(null)
          }}
          initial={saveDraft}
          onSaved={() => void refreshAssets()}
        />
      )}

      <SaveExampleDialog
        open={saveExampleDialogOpen}
        onOpenChange={(open) => {
          setSaveExampleDialogOpen(open)
          if (!open) setSaveExampleSnapshot(null)
        }}
        snapshot={saveExampleSnapshot}
      />

      {editingAsset && (
        <CreateAssetDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open)
            if (!open) setEditingAsset(null)
          }}
          mode="edit"
          assetId={editingAsset.id}
          initial={{
            url: editingAsset.url,
            uploadId: editingAsset.uploadId || undefined,
            assetType: editingAsset.assetType,
            title: editingAsset.title,
            visibility: editingAsset.visibility,
            category: editingAsset.category,
            tags: editingAsset.tags,
            description: editingAsset.description ?? undefined,
            sourceNodeType: editingAsset.sourceNodeType || undefined,
          }}
          onSaved={() => void refreshAssets()}
        />
      )}

      <BrandKitNewFlowDialog open={brandFlowOpen} onOpenChange={setBrandFlowOpen} />

      <CreateCollectionDialog
        open={collectionDialogOpen}
        onOpenChange={setCollectionDialogOpen}
        onCreated={(collection) => setCollections((prev) => [collection, ...prev])}
      />
    </div>
  )
}

function BrandsPanel({
  kits,
  loading,
  error,
  onRefresh,
  onCreate,
  onDeleted,
}: {
  kits: BrandKit[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onCreate: () => void
  onDeleted: (id: string) => void
}) {
  return (
    <section className="w-full space-y-3">
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-44 animate-pulse rounded-2xl border border-border bg-muted/40" />
          ))}
        </div>
      ) : error ? (
        <RetryState centered message={error} onRetry={onRefresh} />
      ) : kits.length === 0 ? (
        <EmptyState
          centered
          icon={<FolderSimple className="h-7 w-7" />}
          title="No brand kits yet"
          description="Create one manually or from a website."
          action={<Button onClick={onCreate}>Create brand kit</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kits.map((kit) => (
            <BrandKitCard key={kit.id} kit={kit} onDeleted={onDeleted} />
          ))}
        </div>
      )}
    </section>
  )
}

function CollectionsPanel({
  collections,
  totalCount,
  searchQuery,
  loading,
  error,
  onRefresh,
  onCreate,
  onCopyReference,
}: {
  collections: SlideshowCollection[]
  totalCount: number
  searchQuery: string
  loading: boolean
  error: string | null
  onRefresh: () => void
  onCreate: () => void
  onCopyReference: (url: string, label?: string) => void
}) {
  return (
    <section className="w-full space-y-3">
      {loading ? (
        <LoadingGrid label="Loading collections..." />
      ) : error ? (
        <RetryState centered message={error} onRetry={onRefresh} />
      ) : totalCount === 0 ? (
        <EmptyState
          centered
          icon={<FolderSimple className="h-7 w-7" />}
          title="No collections yet"
          description="Create a collection to group images for slideshows and templates."
          action={<Button onClick={onCreate}>Create collection</Button>}
        />
      ) : collections.length === 0 ? (
        <EmptyState
          icon={<MagnifyingGlass className="h-7 w-7" />}
          title={searchQuery ? `No results for "${searchQuery}"` : "No matching collections"}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {collections.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} onCopyReference={onCopyReference} />
          ))}
        </div>
      )}
    </section>
  )
}

function CollectionCard({
  collection,
  onCopyReference,
}: {
  collection: SlideshowCollection
  onCopyReference: (url: string, label?: string) => void
}) {
  const previewItems = collection.items.slice(0, 4)

  return (
    <article className="overflow-hidden rounded-2xl border border-border/70 bg-card/50 shadow-sm">
      <div className="grid aspect-[1.7] grid-cols-2 gap-1 bg-muted p-1">
        {previewItems.length ? (
          previewItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className="relative overflow-hidden rounded-lg bg-background"
              onClick={() => onCopyReference(item.url, "Collection image URL copied")}
            >
              <Image src={item.thumbnailUrl || item.url} alt={item.title} fill className="object-cover" />
            </button>
          ))
        ) : (
          <div className="col-span-2 flex items-center justify-center text-sm text-muted-foreground">
            No images
          </div>
        )}
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{collection.name}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {collection.description || "Image collection"}
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {collection.items.length} images
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Updated {formatDate(collection.updatedAt)}</span>
          <Button asChild variant="outline" size="sm">
            <Link href="/slideshows">Manage</Link>
          </Button>
        </div>
      </div>
    </article>
  )
}

export default function AssetsPage() {
  return (
    <React.Suspense
      fallback={<main className="min-h-screen bg-background px-4 pb-10 pt-16" />}
    >
      <LibraryPageContent />
    </React.Suspense>
  )
}
