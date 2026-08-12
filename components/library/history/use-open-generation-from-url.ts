"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import type { Generation } from "@/components/library/history/types"

type UseOpenGenerationFromUrlOptions = {
  enabled?: boolean
  onOpen: (generation: Generation) => void
}

export function useOpenGenerationFromUrl({
  enabled = true,
  onOpen,
}: UseOpenGenerationFromUrlOptions) {
  const searchParams = useSearchParams()
  const generationId = searchParams.get("generation")
  const handledGenerationIdRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (!enabled || !generationId) {
      return
    }

    if (handledGenerationIdRef.current === generationId) {
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const response = await fetch(`/api/generations/${encodeURIComponent(generationId)}`, {
          cache: "no-store",
        })
        const data = (await response.json()) as { generation?: Generation; error?: string }
        if (!response.ok || !data.generation) {
          return
        }

        if (cancelled) {
          return
        }

        handledGenerationIdRef.current = generationId
        onOpen(data.generation)
      } catch {
        // Ignore deep-link fetch failures; user can still browse history manually.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, generationId, onOpen])
}
