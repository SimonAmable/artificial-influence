"use client"

import * as React from "react"

import { CAROUSEL_SHOTS_TOOL } from "@/lib/carousel-shots/constants"
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

export function useCarouselShotsHistory(refreshKey = 0) {
  const [items, setItems] = React.useState<CarouselShotsHistoryItem[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const fetchHistory = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/generations?tool=${CAROUSEL_SHOTS_TOOL}&type=image&limit=50`,
      )
      const data = (await response.json().catch(() => ({}))) as {
        generations?: GenerationRow[]
        error?: string
        message?: string
      }

      if (!response.ok) {
        throw new Error(
          typeof data.message === "string"
            ? data.message
            : typeof data.error === "string"
              ? data.error
              : "Failed to load history",
        )
      }

      const rows = Array.isArray(data.generations) ? data.generations : []
      setItems(normalizeHistory(rows))
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load history"
      setError(message)
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [])

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
    isLoading,
    items,
    updateItemMetadata,
    updateItemShots,
  }
}
