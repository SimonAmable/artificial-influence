import type { GenerationType, HistorySource, PaginationState } from "@/components/library/history/types"
import { cn } from "@/lib/utils"

export function createEmptyPagination(limit: number): PaginationState {
  return {
    limit,
    offset: 0,
    returned: 0,
    total: 0,
    hasMore: false,
  }
}

export function createEmptyPaginatedState<T>(limit: number) {
  return {
    items: [] as T[],
    query: "",
    hasLoaded: false,
    initialLoading: false,
    loadingMore: false,
    error: null as string | null,
    nextOffset: 0,
    pagination: createEmptyPagination(limit),
  }
}

export function normalizePagination(
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

export function mergeUniqueById<T extends { id: string; source?: string }>(existing: T[], incoming: T[]) {
  const seen = new Set(existing.map((item) => `${item.source ?? "generation"}:${item.id}`))
  const merged = [...existing]

  for (const item of incoming) {
    const key = `${item.source ?? "generation"}:${item.id}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(item)
  }

  return merged
}

export function createHistoryUrl(
  type: GenerationType,
  limit: number,
  offset: number,
  search: string,
  tool: string,
  source: HistorySource = "all"
) {
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

  if (tool && tool !== "all") {
    params.set("tool", tool)
  }

  if (source && source !== "all") {
    params.set("source", source)
  }

  return `/api/history?${params.toString()}`
}

export function historyItemDeleteUrl(item: { id: string; source?: "generation" | "upload" }) {
  if (item.source === "upload") {
    return `/api/uploads/${item.id}`
  }
  return `/api/generations/${item.id}`
}

export function formatRelativeDate(dateString: string): string {
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

export function historyGridColsClass(columnCount: number): string {
  const map: Record<number, string> = {
    2: "grid-cols-2",
    3: "grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
    6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
  }
  return map[columnCount] ?? "grid-cols-2"
}

export function historyPanelClassName(className?: string) {
  return cn("w-full space-y-3", className)
}
