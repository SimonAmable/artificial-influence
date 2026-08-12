"use client"

import * as React from "react"

import type { AssetRecord } from "@/lib/assets/types"
import { listAssets } from "@/lib/assets/library"

export function useCharacterAssets() {
  const [characters, setCharacters] = React.useState<AssetRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    void (async () => {
      setLoading(true)
      setError(null)

      try {
        const assets = await listAssets({
          category: "character",
          limit: 100,
        })

        if (!cancelled) {
          setCharacters(assets.filter((asset) => asset.assetType === "image"))
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not load characters")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return { characters, loading, error }
}
