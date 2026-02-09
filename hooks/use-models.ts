"use client"

import * as React from "react"
import type { Model, ModelType } from "@/lib/types/models"

interface UseModelsResult {
  models: Model[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 min
const cache = new Map<string, { models: Model[]; timestamp: number }>()

function getCacheKey(type?: ModelType): string {
  return type ?? "all"
}

/**
 * Fetches models from /api/models, optionally filtered by type.
 * Caches by type to dedupe fetches when multiple nodes use the same type.
 */
export function useModels(type?: ModelType): UseModelsResult {
  const key = getCacheKey(type)
  const cached = cache.get(key)
  const [models, setModels] = React.useState<Model[]>(
    () => (cached && Date.now() - cached.timestamp < CACHE_TTL_MS ? cached.models : [])
  )
  const [isLoading, setIsLoading] = React.useState(() => !cached || Date.now() - cached.timestamp >= CACHE_TTL_MS)
  const [error, setError] = React.useState<string | null>(null)

  const fetchModels = React.useCallback(async () => {
    const key = getCacheKey(type)
    const cached = cache.get(key)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setModels(cached.models)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const url = type ? `/api/models?type=${type}` : "/api/models"
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error("Failed to fetch models")
      }
      const data = await res.json()
      const modelsData = (data.models ?? []) as Model[]
      setModels(modelsData)
      cache.set(key, { models: modelsData, timestamp: Date.now() })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch models")
      setModels([])
    } finally {
      setIsLoading(false)
    }
  }, [type])

  React.useEffect(() => {
    void fetchModels()
  }, [fetchModels])

  return { models, isLoading, error, refetch: fetchModels }
}
