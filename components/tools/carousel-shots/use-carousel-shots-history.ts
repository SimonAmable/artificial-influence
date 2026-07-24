"use client"

import * as React from "react"

import {
  CAROUSEL_SHOTS_HISTORY_PAGE_LIMIT,
  CAROUSEL_SHOTS_TOOL,
} from "@/lib/carousel-shots/constants"
import { isCarouselShotsMetadata, type CarouselShotsMetadata } from "@/lib/carousel-shots/types"

export type CarouselShotsHistoryItem = {
  id: string
  createdAt: string
  metadata: CarouselShotsMetadata
}

type GenerationRow = {
  id: string
  created_at: string
  metadata: unknown
}

type GenerationsResponse = {
  generations?: GenerationRow[]
  pagination?: {
    limit?: number
    offset?: number
    returned?: number
    total?: number
    hasMore?: boolean
  }
  error?: string
  message?: string
}

function normalizeHistory(rows: GenerationRow[]): CarouselShotsHistoryItem[] {
  return rows.reduce<CarouselShotsHistoryItem[]>((items, row) => {
    if (!isCarouselShotsMetadata(row.metadata)) {
      return items
    }

    items.push({
      id: row.id,
      createdAt: row.created_at,
      metadata: row.metadata,
    })
    return items
  }, [])
}

function mergeUniqueById(
  existing: CarouselShotsHistoryItem[],
  incoming: CarouselShotsHistoryItem[],
): CarouselShotsHistoryItem[] {
  const seen = new Set(existing.map((item) => item.id))
  const merged = [...existing]
  for (const item of incoming) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    merged.push(item)
  }
  return merged
}

function responseErrorMessage(data: GenerationsResponse): string {
  if (typeof data.message === "string") return data.message
  if (typeof data.error === "string") return data.error
  return "Failed to load history"
}

export function useCarouselShotsHistory(refreshKey = 0) {
  const [items, setItems] = React.useState<CarouselShotsHistoryItem[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isLoadingMore, setIsLoadingMore] = React.useState(false)
  const [hasMore, setHasMore] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const nextOffsetRef = React.useRef(0)
  const requestIdRef = React.useRef(0)
  const isLoadingMoreRef = React.useRef(false)
  const hasMoreRef = React.useRef(false)

  React.useEffect(() => {
    isLoadingMoreRef.current = isLoadingMore
  }, [isLoadingMore])

  React.useEffect(() => {
    hasMoreRef.current = hasMore
  }, [hasMore])

  const fetchPage = React.useCallback(async (append: boolean) => {
    if (append) {
      if (!hasMoreRef.current || isLoadingMoreRef.current) return
      setIsLoadingMore(true)
    } else {
      setIsLoading(true)
      setIsLoadingMore(false)
      setError(null)
      nextOffsetRef.current = 0
    }

    const requestId = ++requestIdRef.current
    const offset = append ? nextOffsetRef.current : 0

    try {
      const params = new URLSearchParams({
        tool: CAROUSEL_SHOTS_TOOL,
        type: "image",
        limit: String(CAROUSEL_SHOTS_HISTORY_PAGE_LIMIT),
        offset: String(offset),
      })
      const response = await fetch(`/api/generations?${params.toString()}`)
      const data = (await response.json().catch(() => ({}))) as GenerationsResponse

      if (requestId !== requestIdRef.current) return

      if (!response.ok) {
        throw new Error(responseErrorMessage(data))
      }

      const rows = Array.isArray(data.generations) ? data.generations : []
      const nextItems = normalizeHistory(rows)
      const returned = typeof data.pagination?.returned === "number" ? data.pagination.returned : rows.length
      const paginationHasMore =
        typeof data.pagination?.hasMore === "boolean"
          ? data.pagination.hasMore
          : returned >= CAROUSEL_SHOTS_HISTORY_PAGE_LIMIT

      nextOffsetRef.current = offset + returned
      hasMoreRef.current = paginationHasMore
      setHasMore(paginationHasMore)
      setItems((current) => (append ? mergeUniqueById(current, nextItems) : nextItems))
      setError(null)
    } catch (err) {
      if (requestId !== requestIdRef.current) return

      const message = err instanceof Error ? err.message : "Failed to load history"
      setError(message)
      if (!append) {
        setItems([])
        setHasMore(false)
        hasMoreRef.current = false
        nextOffsetRef.current = 0
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false)
        setIsLoadingMore(false)
        isLoadingMoreRef.current = false
      }
    }
  }, [])

  const fetchHistory = React.useCallback(async () => {
    await fetchPage(false)
  }, [fetchPage])

  const loadMore = React.useCallback(() => {
    void fetchPage(true)
  }, [fetchPage])

  React.useEffect(() => {
    void fetchHistory()
  }, [fetchHistory, refreshKey])

  const updateItemMetadata = React.useCallback(
    (generationId: string, metadata: CarouselShotsMetadata) => {
      setItems((current) =>
        current.map((item) => (item.id === generationId ? { ...item, metadata } : item)),
      )
    },
    [],
  )

  const updateItemShots = React.useCallback(
    (generationId: string, shots: CarouselShotsMetadata["shots"]) => {
      setItems((current) =>
        current.map((item) =>
          item.id === generationId
            ? { ...item, metadata: { ...item.metadata, shots } }
            : item,
        ),
      )
    },
    [],
  )

  return {
    error,
    fetchHistory,
    hasMore,
    isLoading,
    isLoadingMore,
    items,
    loadMore,
    updateItemMetadata,
    updateItemShots,
  }
}
