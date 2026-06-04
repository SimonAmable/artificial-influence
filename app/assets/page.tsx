"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowsOutSimple,
  ClockCounterClockwise,
  Copy,
  DotsThreeVertical,
  DownloadSimple,
  FolderSimple,
  Image as ImageIcon,
  Images,
  MagnifyingGlass,
  MusicNote,
  PencilSimple,
  Plus,
  Sparkle,
  Trash,
  UploadSimple,
  Video,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { BrandKitCard } from "@/components/brand-kit/brand-kit-card"
import { BrandKitNewFlowDialog } from "@/components/brand-kit/brand-kit-new-flow-dialog"
import { CreateAssetDialog } from "@/components/canvas/create-asset-dialog"
import {
  FullscreenMediaViewer,
  type FullscreenMediaViewerAction,
} from "@/components/shared/display/fullscreen-media-viewer"
import { copyMediaToClipboard, downloadMediaFile } from "@/components/shared/display/media-viewer-utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AssetCategory, AssetRecord, AssetType, AssetVisibility } from "@/lib/assets/types"
import {
  ASSET_CATEGORIES,
  ASSET_CATEGORY_LABELS,
  deleteAsset,
} from "@/lib/assets/library"
import type { BrandKit } from "@/lib/brand-kit/types"
import { uploadFileToSupabase } from "@/lib/canvas/upload-helpers"
import type { SlideshowCollection } from "@/lib/slideshow/types"
import { createClient } from "@/lib/supabase/client"

type LibraryTab = "history" | "assets" | "brands" | "collections"
type GenerationType = "image" | "video" | "audio" | "all"
type MediaGenerationType = Exclude<GenerationType, "all">

type Generation = {
  id: string
  user_id: string
  prompt: string | null
  supabase_storage_path: string
  type: MediaGenerationType
  model: string | null
  tool?: string | null
  aspect_ratio?: string | null
  created_at: string
  url: string
  reference_image_urls?: string[]
}

type PaginationState = {
  limit: number
  offset: number
  returned: number
  total: number
  hasMore: boolean
}

type PaginatedState<T> = {
  items: T[]
  query: string
  hasLoaded: boolean
  initialLoading: boolean
  loadingMore: boolean
  error: string | null
  nextOffset: number
  pagination: PaginationState
}

type HistoryResponse = {
  generations?: Generation[]
  pagination?: Partial<PaginationState>
}

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

type SaveAssetDraft = {
  url: string
  uploadId?: string
  supabaseStoragePath?: string
  assetType: AssetType
  title: string
  visibility?: AssetVisibility
  category?: AssetCategory
  sourceNodeType?: string
  sourceGenerationId?: string
  tags?: string[]
  description?: string
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

const HISTORY_PAGE_LIMIT = 24
const ASSET_PAGE_LIMIT = 200
const LIBRARY_TABS: LibraryTab[] = ["history", "assets", "brands", "collections"]
const HISTORY_TYPES: GenerationType[] = ["all", "image", "video", "audio"]

const tabLabels: Record<LibraryTab, string> = {
  history: "History",
  assets: "Assets",
  brands: "Brands",
  collections: "Collections",
}

const emptyHistoryMessages: Record<GenerationType, string> = {
  all: "No generations found.",
  image: "No image generations found.",
  video: "No video generations found.",
  audio: "No audio generations found.",
}

function createEmptyPagination(limit: number): PaginationState {
  return {
    limit,
    offset: 0,
    returned: 0,
    total: 0,
    hasMore: false,
  }
}

function createEmptyPaginatedState<T>(limit: number): PaginatedState<T> {
  return {
    items: [],
    query: "",
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
  },
): PaginationState {
  const limit = typeof pagination?.limit === "number" ? pagination.limit : fallback.limit
  const offset = typeof pagination?.offset === "number" ? pagination.offset : fallback.offset
  const returned = typeof pagination?.returned === "number" ? pagination.returned : fallback.returned
  const total = typeof pagination?.total === "number" ? pagination.total : offset + returned
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

function mergeUniqueById<T extends { id: string }>(existing: T[], incoming: T[]) {
  const seen = new Set(existing.map((item) => item.id))
  const merged = [...existing]

  for (const item of incoming) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    merged.push(item)
  }

  return merged
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (Number.isNaN(date.getTime())) return "Unknown"
  if (diffInSeconds < 60) return "Just now"
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  })
}

function getDefaultCategoryByMediaType(type: AssetType): AssetCategory {
  if (type === "video") return "shorts"
  if (type === "audio") return "element"
  return "character"
}

function MediaTypeIcon({
  type,
  className,
}: {
  type: AssetType | MediaGenerationType
  className?: string
}) {
  if (type === "image") return <ImageIcon className={className} />
  if (type === "video") return <Video className={className} />
  return <MusicNote className={className} />
}

function createHistoryUrl(type: GenerationType, limit: number, offset: number, search: string) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  })

  if (type !== "all") {
    params.set("type", type)
  }

  if (search.trim()) {
    params.set("search", search.trim())
  }

  return `/api/generations?${params.toString()}`
}

function mediaMatchesSearch(value: string, fields: Array<string | null | undefined>) {
  const query = value.trim().toLowerCase()
  if (!query) return true
  return fields.some((field) => field?.toLowerCase().includes(query))
}

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = React.useState(value)

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timeoutId)
  }, [delayMs, value])

  return debounced
}

function LibraryPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get("tab")
  const activeTab = LIBRARY_TABS.includes(requestedTab as LibraryTab) ? (requestedTab as LibraryTab) : "assets"

  const [search, setSearch] = React.useState("")
  const debouncedSearch = useDebouncedValue(search.trim(), 250)
  const [historyType, setHistoryType] = React.useState<GenerationType>("all")
  const [assetVisibility, setAssetVisibility] = React.useState<AssetVisibility | "all">("all")
  const [assetCategory, setAssetCategory] = React.useState<AssetCategory | "all">("all")
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
  const [brandFlowOpen, setBrandFlowOpen] = React.useState(false)
  const [collections, setCollections] = React.useState<SlideshowCollection[]>([])
  const [collectionsLoading, setCollectionsLoading] = React.useState(false)
  const [collectionsError, setCollectionsError] = React.useState<string | null>(null)
  const [viewerItem, setViewerItem] = React.useState<ViewerItem | null>(null)
  const [copiedUrl, setCopiedUrl] = React.useState<string | null>(null)
  const [saveDraft, setSaveDraft] = React.useState<SaveAssetDraft | null>(null)
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

  const setActiveTab = React.useCallback(
    (nextTab: LibraryTab) => {
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
  }, [assetCategory, assetVisibility, debouncedSearch])

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
      const response = await fetch(createHistoryUrl(type, HISTORY_PAGE_LIMIT, offset, searchQuery))
      if (!response.ok) throw new Error("Failed to fetch generations")

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
  }, [debouncedSearch])

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
    }
  }, [])

  React.useEffect(() => {
    if (activeTab === "assets") {
      void refreshAssets()
    }
  }, [activeTab, refreshAssets])

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
    if (activeTab === "brands" && !brandsLoading && !brandsError && brandKits.length === 0) {
      void refreshBrands()
    }
  }, [activeTab, brandKits.length, brandsError, brandsLoading, refreshBrands])

  React.useEffect(() => {
    if (activeTab === "collections" && !collectionsLoading && !collectionsError && collections.length === 0) {
      void refreshCollections()
    }
  }, [activeTab, collections.length, collectionsError, collectionsLoading, refreshCollections])

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
        visibility: assetVisibility !== "all" ? assetVisibility : "private",
      })
    },
    [assetCategory, assetVisibility, openSaveDraft],
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
    if (!confirm("Delete this generation?")) return
    try {
      const response = await fetch(`/api/generations/${generation.id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Failed to delete generation")

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
      toast.success("Generation deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete generation")
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
    [copyMedia, copyReference, downloadByUrl, openImageEditor],
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
    [copyMedia, copyReference, downloadByUrl, openImageEditor, openSaveDraft],
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
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
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
              <Button variant="outline" className="gap-2" onClick={() => void fetchGenerations(historyType, false)}>
                <ClockCounterClockwise className="h-4 w-4" />
                Refresh history
              </Button>
            ) : null}
            {activeTab === "assets" ? (
              <>
                <Button variant="outline" className="gap-2" onClick={() => void refreshAssets()}>
                  <ClockCounterClockwise className="h-4 w-4" />
                  Refresh assets
                </Button>
                <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <UploadSimple className="h-4 w-4" />
                  Upload
                </Button>
              </>
            ) : null}
            {activeTab === "brands" ? (
              <>
                <Button variant="outline" className="gap-2" onClick={() => void refreshBrands()}>
                  <ClockCounterClockwise className="h-4 w-4" />
                  Refresh brands
                </Button>
                <Button className="gap-2" onClick={() => setBrandFlowOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New brand kit
                </Button>
              </>
            ) : null}
            {activeTab === "collections" ? (
              <>
                <Button variant="outline" className="gap-2" onClick={() => void refreshCollections()}>
                  <ClockCounterClockwise className="h-4 w-4" />
                  Refresh collections
                </Button>
                <Button asChild className="gap-2">
                  <Link href="/apps/hook-slideshow">
                    <Plus className="h-4 w-4" />
                    Manage in slideshow
                  </Link>
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <div className="sticky top-[58px] z-30 -mx-4 mb-4 bg-background/90 px-4 py-2 backdrop-blur supports-backdrop-filter:bg-background/70">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as LibraryTab)}>
              <TabsList className="h-auto max-w-full flex-wrap justify-start overflow-visible rounded-full p-0.5">
                {LIBRARY_TABS.map((tab) => (
                  <TabsTrigger key={tab} value={tab} className="shrink-0 gap-2 rounded-full px-4 py-1.5">
                    {tabLabels[tab]}
                    {tabCounts[tab] ? (
                      <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {tabCounts[tab]}
                      </span>
                    ) : null}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="relative min-w-0 lg:w-80">
              <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search titles, prompts, tags..."
                className="h-9 rounded-full pl-9"
              />
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as LibraryTab)}>
          <TabsContent value="history" className="mt-0">
            <HistoryPanel
              activeType={historyType}
              setActiveType={setHistoryType}
              state={historyStates[historyType]}
              items={historyStates[historyType].items}
              searchQuery={debouncedSearch}
              onRefresh={() => void fetchGenerations(historyType, false)}
              onLoadMore={() => void fetchGenerations(historyType, true)}
              loadMoreRef={historyLoadMoreSentinelRef}
              onOpen={openGenerationViewer}
              onSave={openSaveDraft}
              onCopy={copyMedia}
              onReference={copyReference}
              onDownload={downloadByUrl}
              onDelete={handleDeleteGeneration}
              onEditImage={openImageEditor}
            />
          </TabsContent>

          <TabsContent value="assets" className="mt-0">
            <AssetsPanel
              visibility={assetVisibility}
              setVisibility={setAssetVisibility}
              category={assetCategory}
              setCategory={setAssetCategory}
              state={assetsState}
              onRefresh={() => void refreshAssets()}
              onUpload={() => fileInputRef.current?.click()}
              currentUserId={currentUserId}
              onOpen={openAssetViewer}
              onCopy={copyMedia}
              onReference={copyReference}
              onDownload={downloadByUrl}
              onEdit={(asset) => {
                setEditingAsset(asset)
                setEditDialogOpen(true)
              }}
              onDelete={handleDeleteAsset}
              onEditImage={openImageEditor}
            />
          </TabsContent>

          <TabsContent value="brands" className="mt-0">
            <BrandsPanel
              kits={filteredBrandKits}
              loading={brandsLoading}
              error={brandsError}
              onRefresh={() => void refreshBrands()}
              onCreate={() => setBrandFlowOpen(true)}
              onDeleted={(id) => setBrandKits((prev) => prev.filter((kit) => kit.id !== id))}
            />
          </TabsContent>

          <TabsContent value="collections" className="mt-0">
            <CollectionsPanel
              collections={filteredCollections}
              loading={collectionsLoading}
              error={collectionsError}
              onRefresh={() => void refreshCollections()}
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
    </div>
  )
}

function HistoryPanel({
  activeType,
  setActiveType,
  state,
  items,
  searchQuery,
  onRefresh,
  onLoadMore,
  loadMoreRef,
  onOpen,
  onSave,
  onCopy,
  onReference,
  onDownload,
  onDelete,
  onEditImage,
}: {
  activeType: GenerationType
  setActiveType: (type: GenerationType) => void
  state: PaginatedState<Generation>
  items: Generation[]
  searchQuery: string
  onRefresh: () => void
  onLoadMore: () => void
  loadMoreRef: React.RefObject<HTMLDivElement | null>
  onOpen: (generation: Generation) => void
  onSave: (draft: SaveAssetDraft) => void
  onCopy: (url: string, type: AssetType) => void
  onReference: (url: string) => void
  onDownload: (url: string, type: AssetType, title?: string) => void
  onDelete: (generation: Generation) => void
  onEditImage: (url: string) => void
}) {
  return (
    <section className="space-y-3">
      <Tabs value={activeType} onValueChange={(value) => setActiveType(value as GenerationType)}>
        <TabsList className="mb-0 flex h-auto max-w-full flex-wrap justify-start gap-1 rounded-full p-0.5">
          <TabsTrigger value="all" className="rounded-full">All</TabsTrigger>
          <TabsTrigger value="image" className="rounded-full">Images</TabsTrigger>
          <TabsTrigger value="video" className="rounded-full">Videos</TabsTrigger>
          <TabsTrigger value="audio" className="rounded-full">Audio</TabsTrigger>
        </TabsList>
      </Tabs>

      {state.initialLoading ? (
        <LoadingGrid label="Loading history..." />
      ) : state.error && state.items.length === 0 ? (
        <RetryState message={state.error} onRetry={onRefresh} />
      ) : state.items.length === 0 ? (
        <EmptyState
          icon={<ClockCounterClockwise className="h-7 w-7" />}
          title={searchQuery ? `No results for "${searchQuery}"` : emptyHistoryMessages[activeType]}
        />
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Showing {items.length} of {state.pagination.total}
            {searchQuery ? ` for "${searchQuery}"` : ""}
          </div>
          {items.length === 0 ? (
            <EmptyState icon={<MagnifyingGlass className="h-7 w-7" />} title="No matching generations" />
          ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((generation) => (
                <GenerationCard
                  key={generation.id}
                  generation={generation}
                  onOpen={onOpen}
                  onSave={onSave}
                  onCopy={onCopy}
                  onReference={onReference}
                  onDownload={onDownload}
                  onDelete={onDelete}
                  onEditImage={onEditImage}
                />
              ))}
            </div>
          )}

          {state.error ? <div className="text-center text-sm text-destructive">{state.error}</div> : null}
          {state.pagination.hasMore ? (
            <div className="space-y-3">
              <div ref={loadMoreRef} className="h-px w-full" aria-hidden />
              <div className="flex justify-center">
                <Button variant="outline" onClick={onLoadMore} disabled={state.loadingMore}>
                  {state.loadingMore ? "Loading more..." : "Load more"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}

function AssetsPanel({
  visibility,
  setVisibility,
  category,
  setCategory,
  state,
  onRefresh,
  onUpload,
  currentUserId,
  onOpen,
  onCopy,
  onReference,
  onDownload,
  onEdit,
  onDelete,
  onEditImage,
}: {
  visibility: AssetVisibility | "all"
  setVisibility: (visibility: AssetVisibility | "all") => void
  category: AssetCategory | "all"
  setCategory: (category: AssetCategory | "all") => void
  state: PaginatedState<AssetRecord>
  onRefresh: () => void
  onUpload: () => void
  currentUserId: string | null
  onOpen: (asset: AssetRecord) => void
  onCopy: (url: string, type: AssetType) => void
  onReference: (url: string) => void
  onDownload: (url: string, type: AssetType, title?: string) => void
  onEdit: (asset: AssetRecord) => void
  onDelete: (asset: AssetRecord) => void
  onEditImage: (url: string) => void
}) {
  const emptyTitle =
    category !== "all"
      ? `No ${ASSET_CATEGORY_LABELS[category]} yet`
      : visibility === "private"
        ? "No private assets yet"
        : visibility === "public"
          ? "No public assets yet"
          : "Nothing here yet"

  return (
    <section className="space-y-3">
      <Tabs value={visibility} onValueChange={(value) => setVisibility(value as AssetVisibility | "all")}>
        <TabsList className="mb-0 h-auto rounded-full p-0.5">
          <TabsTrigger value="all" className="rounded-full">All</TabsTrigger>
          <TabsTrigger value="private" className="rounded-full">Private</TabsTrigger>
          <TabsTrigger value="public" className="rounded-full">Public</TabsTrigger>
        </TabsList>
      </Tabs>

      <Tabs value={category} onValueChange={(value) => setCategory(value as AssetCategory | "all")}>
        <TabsList className="flex h-auto max-w-full flex-wrap justify-start gap-1 rounded-full p-0.5">
          <TabsTrigger value="all" className="rounded-full">All categories</TabsTrigger>
          {ASSET_CATEGORIES.map((item) => (
            <TabsTrigger key={item} value={item} className="rounded-full">
              {ASSET_CATEGORY_LABELS[item]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {state.initialLoading ? (
        <LoadingGrid label="Loading assets..." />
      ) : state.error ? (
        <RetryState message={state.error} onRetry={onRefresh} />
      ) : state.items.length === 0 ? (
        <EmptyState
          icon={<Images className="h-7 w-7" />}
          title={emptyTitle}
          description="Drop a file anywhere on this page, or use Upload."
          action={<Button onClick={onUpload}>Create asset</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {state.items.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              isOwner={currentUserId !== null && asset.userId === currentUserId}
              onOpen={onOpen}
              onCopy={onCopy}
              onReference={onReference}
              onDownload={onDownload}
              onEdit={onEdit}
              onDelete={onDelete}
              onEditImage={onEditImage}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function GenerationCard({
  generation,
  onOpen,
  onSave,
  onCopy,
  onReference,
  onDownload,
  onDelete,
  onEditImage,
}: {
  generation: Generation
  onOpen: (generation: Generation) => void
  onSave: (draft: SaveAssetDraft) => void
  onCopy: (url: string, type: AssetType) => void
  onReference: (url: string) => void
  onDownload: (url: string, type: AssetType, title?: string) => void
  onDelete: (generation: Generation) => void
  onEditImage: (url: string) => void
}) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-border/70 bg-card/50 shadow-sm transition-colors hover:border-foreground/20">
      <MediaPreview
        type={generation.type}
        url={generation.url}
        alt={generation.prompt || "Generated media"}
        onOpen={generation.type === "audio" ? undefined : () => onOpen(generation)}
      />
      <div className="space-y-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="gap-1">
            <MediaTypeIcon type={generation.type} className="h-3 w-3" />
            <span className="capitalize">{generation.type}</span>
          </Badge>
          <span className="shrink-0 text-xs text-muted-foreground">{formatDate(generation.created_at)}</span>
        </div>

        {generation.model ? (
          <p className="truncate text-xs text-muted-foreground">
            Model: <span className="font-medium">{generation.model}</span>
          </p>
        ) : null}

        <p className="line-clamp-2 min-h-10 text-sm text-foreground">
          {generation.prompt || "Untitled generation"}
        </p>

        <div className="grid grid-cols-2 gap-2">
          {generation.type !== "audio" ? (
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => onOpen(generation)}>
              <ArrowsOutSimple className="h-3.5 w-3.5" />
              Fullscreen
            </Button>
          ) : (
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => onCopy(generation.url, generation.type)}>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              onSave({
                url: generation.url,
                assetType: generation.type,
                title: `${generation.type} ${generation.id.slice(0, 8)}`,
                category: getDefaultCategoryByMediaType(generation.type),
                visibility: "private",
                sourceGenerationId: generation.id,
                sourceNodeType: "generation-history",
                description: generation.prompt ?? undefined,
              })
            }
          >
            <Plus className="h-3.5 w-3.5" />
            Save
          </Button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={() => onReference(generation.url)}>
            <Sparkle className="h-3.5 w-3.5" />
            Use as reference
          </Button>
          <DropdownActions
            canEditImage={generation.type === "image"}
            onEditImage={() => onEditImage(generation.url)}
            onCopy={() => onCopy(generation.url, generation.type)}
            onDownload={() => onDownload(generation.url, generation.type, generation.type)}
            onDelete={() => onDelete(generation)}
          />
        </div>
      </div>
    </article>
  )
}

function AssetCard({
  asset,
  isOwner,
  onOpen,
  onCopy,
  onReference,
  onDownload,
  onEdit,
  onDelete,
  onEditImage,
}: {
  asset: AssetRecord
  isOwner: boolean
  onOpen: (asset: AssetRecord) => void
  onCopy: (url: string, type: AssetType) => void
  onReference: (url: string) => void
  onDownload: (url: string, type: AssetType, title?: string) => void
  onEdit: (asset: AssetRecord) => void
  onDelete: (asset: AssetRecord) => void
  onEditImage: (url: string) => void
}) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-border/70 bg-card/50 shadow-sm transition-colors hover:border-foreground/20">
      <MediaPreview
        type={asset.assetType}
        url={asset.thumbnailUrl || asset.url}
        playableUrl={asset.url}
        alt={asset.title}
        onOpen={asset.assetType === "audio" ? undefined : () => onOpen(asset)}
      />
      <div className="space-y-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="gap-1">
            <MediaTypeIcon type={asset.assetType} className="h-3 w-3" />
            <span className="capitalize">{asset.assetType}</span>
          </Badge>
          <span className="shrink-0 text-xs text-muted-foreground">{formatDate(asset.createdAt)}</span>
        </div>

        <div>
          <p className="truncate text-sm font-medium text-foreground">{asset.title}</p>
          <Badge variant="secondary" className="mt-2 w-fit text-xs">
            {ASSET_CATEGORY_LABELS[asset.category]}
          </Badge>
        </div>

        {asset.tags.length > 0 ? (
          <div className="flex min-h-6 flex-wrap gap-1">
            {asset.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          {asset.assetType !== "audio" ? (
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => onOpen(asset)}>
              <ArrowsOutSimple className="h-3.5 w-3.5" />
              Fullscreen
            </Button>
          ) : (
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => onCopy(asset.url, asset.assetType)}>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
          )}
          {isOwner ? (
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => onEdit(asset)}>
              <PencilSimple className="h-3.5 w-3.5" />
              Edit
            </Button>
          ) : (
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => onReference(asset.url)}>
              <Sparkle className="h-3.5 w-3.5" />
              Reference
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={() => onReference(asset.url)}>
            <Sparkle className="h-3.5 w-3.5" />
            Use as reference
          </Button>
          <DropdownActions
            canEditImage={asset.assetType === "image"}
            canEditAsset={isOwner}
            canDelete={isOwner}
            onEditAsset={() => onEdit(asset)}
            onEditImage={() => onEditImage(asset.url)}
            onCopy={() => onCopy(asset.url, asset.assetType)}
            onDownload={() => onDownload(asset.url, asset.assetType, asset.title)}
            onDelete={() => onDelete(asset)}
          />
        </div>
      </div>
    </article>
  )
}

function MediaPreview({
  type,
  url,
  playableUrl,
  alt,
  onOpen,
}: {
  type: AssetType
  url: string
  playableUrl?: string
  alt: string
  onOpen?: () => void
}) {
  const src = playableUrl || url

  if (type === "image") {
    return (
      <button type="button" className="relative block aspect-square w-full overflow-hidden bg-muted text-left" onClick={onOpen}>
        <Image src={url} alt={alt} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
        {onOpen ? <PreviewPill /> : null}
      </button>
    )
  }

  if (type === "video") {
    return (
      <div className="relative aspect-square w-full overflow-hidden bg-black">
        <video src={src} className="h-full w-full object-cover" preload="metadata" muted playsInline />
        {onOpen ? (
          <button type="button" className="absolute inset-0" onClick={onOpen} aria-label="Open video fullscreen">
            <PreviewPill />
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex aspect-square w-full flex-col items-center justify-center gap-4 bg-muted/50 p-5">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-background shadow-sm">
        <MusicNote className="h-8 w-8 text-muted-foreground" />
      </div>
      <audio src={src} controls className="w-full" />
    </div>
  )
}

function PreviewPill() {
  return (
    <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 text-xs font-medium text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
      <ArrowsOutSimple className="h-3.5 w-3.5" />
      Open
    </span>
  )
}

function DropdownActions({
  canEditAsset = false,
  canEditImage = false,
  canDelete = true,
  onEditAsset,
  onEditImage,
  onCopy,
  onDownload,
  onDelete,
}: {
  canEditAsset?: boolean
  canEditImage?: boolean
  canDelete?: boolean
  onEditAsset?: () => void
  onEditImage?: () => void
  onCopy: () => void
  onDownload: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <DotsThreeVertical className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEditAsset && onEditAsset ? (
          <DropdownMenuItem onClick={onEditAsset}>
            <PencilSimple className="mr-2 h-4 w-4" />
            Edit asset
          </DropdownMenuItem>
        ) : null}
        {canEditImage && onEditImage ? (
          <DropdownMenuItem onClick={onEditImage}>
            <PencilSimple className="mr-2 h-4 w-4" />
            Edit image
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={onCopy}>
          <Copy className="mr-2 h-4 w-4" />
          Copy
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDownload}>
          <DownloadSimple className="mr-2 h-4 w-4" />
          Download
        </DropdownMenuItem>
        {canDelete ? (
          <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
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
    <section className="space-y-3">
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-44 animate-pulse rounded-2xl border border-border bg-muted/40" />
          ))}
        </div>
      ) : error ? (
        <RetryState message={error} onRetry={onRefresh} />
      ) : kits.length === 0 ? (
        <EmptyState
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
  loading,
  error,
  onRefresh,
  onCopyReference,
}: {
  collections: SlideshowCollection[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onCopyReference: (url: string, label?: string) => void
}) {
  return (
    <section className="space-y-3">
      {loading ? (
        <LoadingGrid label="Loading collections..." />
      ) : error ? (
        <RetryState message={error} onRetry={onRefresh} />
      ) : collections.length === 0 ? (
        <EmptyState
          icon={<FolderSimple className="h-7 w-7" />}
          title="No collections yet"
          description="Create image collections from the slideshow app, then they’ll appear here."
          action={
            <Button asChild>
              <Link href="/apps/hook-slideshow">Open slideshow app</Link>
            </Button>
          }
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
            <Link href="/apps/hook-slideshow">Manage</Link>
          </Button>
        </div>
      </div>
    </article>
  )
}

function LoadingGrid({ label }: { label: string }) {
  return (
    <div className="space-y-4">
      <div className="text-center text-sm text-muted-foreground">{label}</div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="aspect-square animate-pulse rounded-2xl border border-border bg-muted/40" />
        ))}
      </div>
    </div>
  )
}

function RetryState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 py-14 text-center">
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" onClick={onRetry}>Retry</Button>
    </div>
  )
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
        {icon}
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
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
