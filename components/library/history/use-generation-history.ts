"use client"

import * as React from "react"

import { HISTORY_PAGE_LIMIT } from "@/components/library/history/constants"
import type { Generation, GenerationType, HistoryResponse, PaginatedState } from "@/components/library/history/types"
import {
  createEmptyPaginatedState,
  createHistoryUrl,
  mergeUniqueById,
  normalizePagination,
} from "@/components/library/history/utils"
import { createClient } from "@/lib/supabase/client"

type UseGenerationHistoryOptions = {
  enabled?: boolean
  historyType: GenerationType
  historyTool: string
  searchQuery: string
}

export function useGenerationHistory({
  enabled = true,
  historyType,
  historyTool,
  searchQuery,
}: UseGenerationHistoryOptions) {
  const [states, setStates] = React.useState<Record<GenerationType, PaginatedState<Generation>>>(() => ({
    all: createEmptyPaginatedState<Generation>(HISTORY_PAGE_LIMIT),
    image: createEmptyPaginatedState<Generation>(HISTORY_PAGE_LIMIT),
    video: createEmptyPaginatedState<Generation>(HISTORY_PAGE_LIMIT),
    audio: createEmptyPaginatedState<Generation>(HISTORY_PAGE_LIMIT),
  }))
  const statesRef = React.useRef(states)
  const requestIdRef = React.useRef(0)
  const loadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    statesRef.current = states
  }, [states])

  React.useEffect(() => {
    setStates({
      all: createEmptyPaginatedState<Generation>(HISTORY_PAGE_LIMIT),
      image: createEmptyPaginatedState<Generation>(HISTORY_PAGE_LIMIT),
      video: createEmptyPaginatedState<Generation>(HISTORY_PAGE_LIMIT),
      audio: createEmptyPaginatedState<Generation>(HISTORY_PAGE_LIMIT),
    })
  }, [historyTool])

  const fetchGenerations = React.useCallback(
    async (type: GenerationType, append: boolean) => {
      const currentState = statesRef.current[type]
      if (append ? currentState.loadingMore : currentState.initialLoading) return

      const requestId = ++requestIdRef.current

      setStates((prev) => ({
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
          setStates((prev) => ({
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

        const offset =
          append && currentState.query === searchQuery ? currentState.nextOffset : 0
        const response = await fetch(
          createHistoryUrl(type, HISTORY_PAGE_LIMIT, offset, searchQuery, historyTool)
        )
        if (!response.ok) throw new Error("Failed to fetch generations")

        const data = (await response.json()) as HistoryResponse
        if (requestId !== requestIdRef.current) return

        const nextGenerations = Array.isArray(data.generations) ? data.generations : []
        const pagination = normalizePagination(data.pagination, {
          limit: HISTORY_PAGE_LIMIT,
          offset,
          returned: nextGenerations.length,
        })

        setStates((prev) => ({
          ...prev,
          [type]: {
            ...prev[type],
            items:
              append && prev[type].query === searchQuery
                ? mergeUniqueById(prev[type].items, nextGenerations)
                : nextGenerations,
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
        if (requestId !== requestIdRef.current) return

        setStates((prev) => ({
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
    },
    [historyTool, searchQuery]
  )

  const refresh = React.useCallback(() => {
    void fetchGenerations(historyType, false)
  }, [fetchGenerations, historyType])

  const loadMore = React.useCallback(() => {
    void fetchGenerations(historyType, true)
  }, [fetchGenerations, historyType])

  React.useEffect(() => {
    if (!enabled) return

    const state = states[historyType]
    if ((!state.hasLoaded || state.query !== searchQuery) && !state.initialLoading) {
      void fetchGenerations(historyType, false)
    }
  }, [enabled, fetchGenerations, historyType, searchQuery, states])

  React.useEffect(() => {
    if (!enabled) return

    const target = loadMoreSentinelRef.current
    const state = states[historyType]
    if (
      !target ||
      !state.hasLoaded ||
      state.initialLoading ||
      state.loadingMore ||
      state.error ||
      !state.pagination.hasMore
    ) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchGenerations(historyType, true)
        }
      },
      { rootMargin: "400px 0px" }
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [enabled, fetchGenerations, historyType, states])

  return {
    state: states[historyType],
    loadMoreSentinelRef,
    refresh,
    loadMore,
  }
}
