"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  DotsThreeVertical,
  Download,
  Trash,
  Image as ImageIcon,
  Video,
  MusicNote,
  FolderSimple,
} from "@phosphor-icons/react"
import Image from "next/image"
import Link from "next/link"

type GenerationType = "image" | "video" | "audio" | "all"
type MediaGenerationType = Exclude<GenerationType, "all">

interface Generation {
  id: string
  user_id: string
  prompt: string | null
  supabase_storage_path: string
  type: MediaGenerationType
  model: string | null
  created_at: string
  url: string
}

interface PaginationState {
  limit: number
  offset: number
  returned: number
  total: number
  hasMore: boolean
}

interface HistoryResponse {
  generations?: Generation[]
  pagination?: Partial<PaginationState>
}

interface HistoryTabState {
  items: Generation[]
  hasLoaded: boolean
  initialLoading: boolean
  loadingMore: boolean
  error: string | null
  nextOffset: number
  pagination: PaginationState
}

const HISTORY_PAGE_LIMIT = 24
const HISTORY_TABS: GenerationType[] = ["all", "image", "video", "audio"]

const EMPTY_MESSAGES: Record<GenerationType, string> = {
  all: "No generations found.",
  image: "No image generations found.",
  video: "No video generations found.",
  audio: "No audio generations found.",
}

function createEmptyPagination(limit = HISTORY_PAGE_LIMIT): PaginationState {
  return {
    limit,
    offset: 0,
    returned: 0,
    total: 0,
    hasMore: false,
  }
}

function createEmptyTabState(limit = HISTORY_PAGE_LIMIT): HistoryTabState {
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

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

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

function getTypeIcon(type: MediaGenerationType) {
  switch (type) {
    case "image":
      return ImageIcon
    case "video":
      return Video
    case "audio":
      return MusicNote
  }
}

function normalizePagination(
  pagination: Partial<PaginationState> | undefined,
  fallback: {
    limit: number
    offset: number
    returned: number
  }
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

function mergeGenerations(existing: Generation[], incoming: Generation[]) {
  const seen = new Set(existing.map((generation) => generation.id))
  const merged = [...existing]

  for (const generation of incoming) {
    if (seen.has(generation.id)) continue
    seen.add(generation.id)
    merged.push(generation)
  }

  return merged
}

function applyDeletionToTabState(
  state: HistoryTabState,
  generationId: string,
  shouldDecrementTotal: boolean
): HistoryTabState {
  if (!state.hasLoaded) {
    return state
  }

  const items = state.items.filter((generation) => generation.id !== generationId)
  const total = shouldDecrementTotal ? Math.max(state.pagination.total - 1, 0) : state.pagination.total

  return {
    ...state,
    items,
    pagination: {
      ...state.pagination,
      total,
      hasMore: state.nextOffset < total,
    },
  }
}

function createHistoryUrl(type: GenerationType, limit: number, offset: number) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  })

  if (type !== "all") {
    params.set("type", type)
  }

  return `/api/generations?${params.toString()}`
}

export default function HistoryPage() {
  const [activeTab, setActiveTab] = React.useState<GenerationType>("all")
  const [tabStates, setTabStates] = React.useState<Record<GenerationType, HistoryTabState>>({
    all: createEmptyTabState(),
    image: createEmptyTabState(),
    video: createEmptyTabState(),
    audio: createEmptyTabState(),
  })

  const tabStatesRef = React.useRef(tabStates)
  const loadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    tabStatesRef.current = tabStates
  }, [tabStates])

  const fetchGenerations = React.useCallback(async (type: GenerationType, append: boolean) => {
    const currentState = tabStatesRef.current[type]
    if (append ? currentState.loadingMore : currentState.initialLoading) {
      return
    }

    setTabStates((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        error: null,
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
        setTabStates((prev) => ({
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

      const offset = append ? currentState.nextOffset : 0
      const response = await fetch(createHistoryUrl(type, HISTORY_PAGE_LIMIT, offset))

      if (!response.ok) {
        throw new Error("Failed to fetch generations")
      }

      const data = (await response.json()) as HistoryResponse
      const nextGenerations = Array.isArray(data.generations) ? data.generations : []
      const pagination = normalizePagination(data.pagination, {
        limit: HISTORY_PAGE_LIMIT,
        offset,
        returned: nextGenerations.length,
      })

      setTabStates((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          items: append ? mergeGenerations(prev[type].items, nextGenerations) : nextGenerations,
          hasLoaded: true,
          initialLoading: false,
          loadingMore: false,
          error: null,
          nextOffset: pagination.offset + pagination.returned,
          pagination,
        },
      }))
    } catch (error) {
      console.error("Error fetching generations:", error)
      setTabStates((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          hasLoaded: true,
          initialLoading: false,
          loadingMore: false,
          error: error instanceof Error ? error.message : "Failed to fetch generations",
        },
      }))
    }
  }, [])

  React.useEffect(() => {
    const currentTabState = tabStates[activeTab]
    if (!currentTabState.hasLoaded && !currentTabState.initialLoading) {
      void fetchGenerations(activeTab, false)
    }
  }, [activeTab, fetchGenerations, tabStates])

  React.useEffect(() => {
    const target = loadMoreSentinelRef.current
    const currentTabState = tabStates[activeTab]

    if (
      !target ||
      !currentTabState.hasLoaded ||
      currentTabState.initialLoading ||
      currentTabState.loadingMore ||
      currentTabState.error ||
      !currentTabState.pagination.hasMore
    ) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchGenerations(activeTab, true)
        }
      },
      { rootMargin: "400px 0px" }
    )

    observer.observe(target)

    return () => observer.disconnect()
  }, [activeTab, fetchGenerations, tabStates])

  const handleDownload = async (generation: Generation) => {
    try {
      const response = await fetch(generation.url)
      if (!response.ok) {
        throw new Error("Failed to fetch file")
      }

      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const extension =
        generation.type === "image" ? "png" : generation.type === "video" ? "mp4" : "mp3"

      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `${generation.type}-${generation.id}.${extension}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error("Error downloading file:", error)
      const link = document.createElement("a")
      link.href = generation.url
      link.download = `${generation.type}-${generation.id}`
      link.target = "_blank"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleDelete = async (generation: Generation) => {
    if (!confirm("Are you sure you want to delete this asset?")) return

    try {
      const response = await fetch(`/api/generations/${generation.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete generation")
      }

      setTabStates((prev) => ({
        all: applyDeletionToTabState(prev.all, generation.id, true),
        image: applyDeletionToTabState(prev.image, generation.id, generation.type === "image"),
        video: applyDeletionToTabState(prev.video, generation.id, generation.type === "video"),
        audio: applyDeletionToTabState(prev.audio, generation.id, generation.type === "audio"),
      }))
    } catch (error) {
      console.error("Error deleting generation:", error)
    }
  }

  const renderAssetCard = (generation: Generation) => {
    const TypeIcon = getTypeIcon(generation.type)

    return (
      <div key={generation.id} className="group">
        <div className="relative">
          {generation.type === "image" && (
            <div className="relative aspect-square w-full">
              <Image
                src={generation.url}
                alt={generation.prompt || "Generated image"}
                fill
                className="rounded-lg object-cover"
              />
            </div>
          )}
          {generation.type === "video" && (
            <div className="relative w-full">
              <video
                src={generation.url}
                controls
                className="h-auto w-full rounded-lg"
                preload="metadata"
              />
            </div>
          )}
          {generation.type === "audio" && (
            <div>
              <audio src={generation.url} controls className="w-full" />
            </div>
          )}

          <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background"
                >
                  <DotsThreeVertical className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleDownload(generation)}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDelete(generation)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="gap-1">
              <TypeIcon className="h-3 w-3" />
              <span className="capitalize">{generation.type}</span>
            </Badge>
            <span className="text-xs text-muted-foreground">{formatDate(generation.created_at)}</span>
          </div>

          {generation.model && (
            <div className="text-xs text-muted-foreground">
              Model: <span className="font-medium">{generation.model}</span>
            </div>
          )}

          {generation.prompt && (
            <p className="line-clamp-2 text-sm text-foreground">{generation.prompt}</p>
          )}
        </div>
      </div>
    )
  }

  const renderAssetGrid = (type: GenerationType) => {
    const state = tabStates[type]

    if (state.initialLoading) {
      return <div className="py-12 text-center">Loading...</div>
    }

    if (state.error && state.items.length === 0) {
      return (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-muted-foreground">{state.error}</p>
          <Button variant="outline" onClick={() => void fetchGenerations(type, false)}>
            Retry
          </Button>
        </div>
      )
    }

    if (state.items.length === 0) {
      return <div className="py-12 text-center text-muted-foreground">{EMPTY_MESSAGES[type]}</div>
    }

    return (
      <div className="space-y-6">
        <div className="text-sm text-muted-foreground">
          Showing {state.items.length} of {state.pagination.total}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {state.items.map((generation) => renderAssetCard(generation))}
        </div>

        {state.error ? (
          <div className="text-center text-sm text-destructive">{state.error}</div>
        ) : null}

        {state.pagination.hasMore ? (
          <div className="space-y-3">
            <div ref={loadMoreSentinelRef} className="h-px w-full" aria-hidden />
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => void fetchGenerations(type, true)}
                disabled={state.loadingMore}
              >
                {state.loadingMore ? "Loading more..." : "Load more"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="container mx-auto min-h-screen px-4 pb-8 pt-16">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold">Generation History</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            A complete timeline of everything you&apos;ve generated, images, video, and audio.
            Download what you want to keep, or save favorites to your asset library.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link href="/assets">
              <FolderSimple className="h-4 w-4" />
              Go to asset library
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as GenerationType)}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="image">Images</TabsTrigger>
          <TabsTrigger value="video">Videos</TabsTrigger>
          <TabsTrigger value="audio">Audio</TabsTrigger>
        </TabsList>

        {HISTORY_TABS.map((type) => (
          <TabsContent key={type} value={type} className="mt-0">
            {renderAssetGrid(type)}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
