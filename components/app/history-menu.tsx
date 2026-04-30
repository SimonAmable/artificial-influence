"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Maximize2, Image as ImageIcon, Video as VideoIcon } from "lucide-react"
import Image from "next/image"

type GenerationType = "image" | "video"

interface Generation {
  id: string
  user_id: string
  prompt: string | null
  supabase_storage_path: string
  type: "image" | "video" | "audio"
  model: string | null
  created_at: string
  url: string
}

interface GroupedGenerations {
  [date: string]: Generation[]
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

interface TabState {
  items: Generation[]
  hasLoaded: boolean
  initialLoading: boolean
  loadingMore: boolean
  error: string | null
  nextOffset: number
  pagination: PaginationState
}

interface HistoryMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  viewMode?: "dialog" | "sidebar"
}

const HISTORY_MENU_LIMIT = 24

function createEmptyPagination(limit = HISTORY_MENU_LIMIT): PaginationState {
  return {
    limit,
    offset: 0,
    returned: 0,
    total: 0,
    hasMore: false,
  }
}

function createEmptyTabState(limit = HISTORY_MENU_LIMIT): TabState {
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

function groupByDate(generations: Generation[]): GroupedGenerations {
  const grouped: GroupedGenerations = {}

  generations.forEach((generation) => {
    const date = new Date(generation.created_at)
    const dateKey = date.toISOString().split("T")[0]

    if (!grouped[dateKey]) {
      grouped[dateKey] = []
    }
    grouped[dateKey].push(generation)
  })

  return grouped
}

function formatDateHeader(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const genDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (genDate.getTime() === today.getTime()) {
    return "Today"
  }

  if (genDate.getTime() === yesterday.getTime()) {
    return "Yesterday"
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

function createHistoryUrl(type: GenerationType, limit: number, offset: number) {
  const params = new URLSearchParams({
    type,
    limit: String(limit),
    offset: String(offset),
  })

  return `/api/generations?${params.toString()}`
}

function HistoryContent({
  activeTab,
  setActiveTab,
  onToggleView,
}: {
  activeTab: GenerationType
  setActiveTab: (tab: GenerationType) => void
  onToggleView?: () => void
}) {
  const [tabStates, setTabStates] = React.useState<Record<GenerationType, TabState>>({
    image: createEmptyTabState(),
    video: createEmptyTabState(),
  })

  const tabStatesRef = React.useRef(tabStates)
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null)
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
      const response = await fetch(createHistoryUrl(type, HISTORY_MENU_LIMIT, offset))

      if (!response.ok) {
        throw new Error(`Failed to fetch ${type} history`)
      }

      const data = (await response.json()) as HistoryResponse
      const nextGenerations = Array.isArray(data.generations) ? data.generations : []
      const pagination = normalizePagination(data.pagination, {
        limit: HISTORY_MENU_LIMIT,
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
      console.error("[HistoryMenu] Error fetching generations:", error)
      setTabStates((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          hasLoaded: true,
          initialLoading: false,
          loadingMore: false,
          error: error instanceof Error ? error.message : `Failed to fetch ${type} history`,
        },
      }))
    }
  }, [])

  React.useEffect(() => {
    void fetchGenerations("image", false)
    void fetchGenerations("video", false)
  }, [fetchGenerations])

  React.useEffect(() => {
    const target = loadMoreSentinelRef.current
    const root = scrollContainerRef.current
    const currentTabState = tabStates[activeTab]

    if (
      !target ||
      !root ||
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
      {
        root,
        rootMargin: "200px 0px",
      }
    )

    observer.observe(target)

    return () => observer.disconnect()
  }, [activeTab, fetchGenerations, tabStates])

  const imageCount = tabStates.image.hasLoaded ? tabStates.image.pagination.total : tabStates.image.items.length
  const videoCount = tabStates.video.hasLoaded ? tabStates.video.pagination.total : tabStates.video.items.length

  const renderTabContent = (type: GenerationType) => {
    const state = tabStates[type]
    const grouped = groupByDate(state.items)

    if (state.initialLoading) {
      return (
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      )
    }

    if (state.error && state.items.length === 0) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">{state.error}</p>
          <Button variant="outline" size="sm" onClick={() => void fetchGenerations(type, false)}>
            Retry
          </Button>
        </div>
      )
    }

    if (Object.keys(grouped).length === 0) {
      return (
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">
            {type === "image" ? "No image history yet" : "No video history yet"}
          </p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="text-xs text-muted-foreground">
          Showing {state.items.length} of {state.pagination.total}
        </div>

        <div className="space-y-6">
          {Object.entries(grouped)
            .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
            .map(([date, generations]) => (
              <div key={date}>
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                  {formatDateHeader(date)}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {generations.map((generation) => (
                    <div
                      key={generation.id}
                      className="relative aspect-square overflow-hidden rounded-lg bg-muted transition-all hover:ring-2 hover:ring-primary"
                    >
                      {type === "image" ? (
                        <Image
                          src={generation.url}
                          alt={generation.prompt || "Generated image"}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <video
                          src={generation.url}
                          className="h-full w-full object-cover"
                          preload="metadata"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>

        {state.error ? <p className="text-center text-xs text-destructive">{state.error}</p> : null}

        {state.pagination.hasMore ? (
          <div className="space-y-2 pt-1">
            <div ref={loadMoreSentinelRef} className="h-px w-full" aria-hidden />
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchGenerations(type, true)}
                disabled={state.loadingMore}
              >
                {state.loadingMore ? "Loading..." : "Load more"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex-1" />
        {onToggleView ? (
          <Button variant="ghost" size="icon" onClick={onToggleView} className="h-8 w-8">
            <Maximize2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as GenerationType)}
        className="flex flex-1 flex-col"
      >
        <TabsList className="mb-4 grid w-full grid-cols-2">
          <TabsTrigger value="image" className="text-sm">
            <ImageIcon className="mr-2 h-4 w-4" />
            Image History ({imageCount})
          </TabsTrigger>
          <TabsTrigger value="video" className="text-sm">
            <VideoIcon className="mr-2 h-4 w-4" />
            Video History ({videoCount})
          </TabsTrigger>
        </TabsList>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
          <TabsContent value="image" className="mt-0">
            {renderTabContent("image")}
          </TabsContent>

          <TabsContent value="video" className="mt-0">
            {renderTabContent("video")}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

export function HistoryMenu({ open, onOpenChange, viewMode = "dialog" }: HistoryMenuProps) {
  const [activeTab, setActiveTab] = React.useState<GenerationType>("image")
  const [currentViewMode, setCurrentViewMode] = React.useState(viewMode)
  const contentKey = `${currentViewMode}-${open ? "open" : "closed"}`

  const toggleViewMode = () => {
    setCurrentViewMode(currentViewMode === "dialog" ? "sidebar" : "dialog")
  }

  if (currentViewMode === "dialog") {
    return (
      <Dialog key={contentKey} open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[80vh] max-w-2xl flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <ImageIcon className="mr-2 h-5 w-5" />
              Generation History
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1">
            <HistoryContent
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onToggleView={toggleViewMode}
            />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet key={contentKey} open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-[400px] flex-col p-0 sm:w-[540px]">
        <SheetHeader className="border-b px-6 pt-6 pb-4">
          <SheetTitle className="flex items-center justify-between">
            <span>Mine</span>
            <Button variant="ghost" size="icon" onClick={toggleViewMode} className="h-8 w-8">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-hidden px-6 py-4">
          <HistoryContent activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
