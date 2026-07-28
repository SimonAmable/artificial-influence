"use client"

import * as React from "react"
import Image from "next/image"
import { UsersThree } from "@phosphor-icons/react"

import { AssetCard } from "@/components/library/assets/asset-card"
import { GenerationCard } from "@/components/library/history/generation-card"
import type { Generation, SaveAssetDraft } from "@/components/library/history/types"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { AssetRecord, AssetType } from "@/lib/assets/types"
import { cn } from "@/lib/utils"

const GENERATION_PAGE_SIZE = 30

type Props = {
  currentUserId: string | null
  search: string
  columnCount: number
  selectedId: string | null
  onSelectedIdChange: (id: string | null) => void
  onOpenAsset: (asset: AssetRecord) => void
  onOpenGeneration: (generation: Generation) => void
  onCopy: (url: string, type: AssetType) => void
  onDownload: (url: string, type: AssetType, title?: string) => void
  onDeleteGeneration: (generation: Generation) => void
  onSave: (draft: SaveAssetDraft) => void
}

export function CharactersPanel({
  currentUserId,
  search,
  columnCount,
  selectedId,
  onSelectedIdChange,
  onOpenAsset,
  onOpenGeneration,
  onCopy,
  onDownload,
  onDeleteGeneration,
  onSave,
}: Props) {
  const [characters, setCharacters] = React.useState<AssetRecord[]>([])
  const [generations, setGenerations] = React.useState<Generation[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [nextOffset, setNextOffset] = React.useState(0)
  const [hasMore, setHasMore] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      setGenerations([])
      setNextOffset(0)
      setHasMore(false)
      try {
        const assetsResponse = await fetch("/api/assets?category=character&limit=100")
        if (!assetsResponse.ok) throw new Error("Could not load characters")
        const assetsPayload = (await assetsResponse.json()) as { assets?: AssetRecord[] }
        const nextCharacters = assetsPayload.assets ?? []

        const params = new URLSearchParams({ limit: String(GENERATION_PAGE_SIZE), offset: "0" })
        if (selectedId) params.set("characterAssetId", selectedId)
        else params.set("hasCharacter", "true")
        if (search.trim()) params.set("search", search.trim())
        const generationsResponse = await fetch(`/api/generations?${params.toString()}`)
        if (!generationsResponse.ok) throw new Error("Could not load character content")
        const generationsPayload = (await generationsResponse.json()) as {
          generations?: Generation[]
          pagination?: { returned?: number; hasMore?: boolean }
        }
        const linked = (generationsPayload.generations ?? []).filter((item) =>
          selectedId ? item.character_asset_id === selectedId : Boolean(item.character_asset_id),
        )
        if (!cancelled) {
          setCharacters(nextCharacters)
          setGenerations(linked)
          setNextOffset(generationsPayload.pagination?.returned ?? linked.length)
          setHasMore(Boolean(generationsPayload.pagination?.hasMore))
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load characters")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [search, selectedId])

  const loadMore = React.useCallback(async () => {
    if (loading || loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const params = new URLSearchParams({
        limit: String(GENERATION_PAGE_SIZE),
        offset: String(nextOffset),
      })
      if (selectedId) params.set("characterAssetId", selectedId)
      else params.set("hasCharacter", "true")
      if (search.trim()) params.set("search", search.trim())

      const response = await fetch(`/api/generations?${params.toString()}`)
      if (!response.ok) throw new Error("Could not load more character content")
      const payload = (await response.json()) as {
        generations?: Generation[]
        pagination?: { returned?: number; hasMore?: boolean }
      }
      const page = (payload.generations ?? []).filter((item) =>
        selectedId ? item.character_asset_id === selectedId : Boolean(item.character_asset_id),
      )
      setGenerations((current) => {
        const seen = new Set(current.map((item) => item.id))
        return [...current, ...page.filter((item) => !seen.has(item.id))]
      })
      setNextOffset((current) => current + (payload.pagination?.returned ?? page.length))
      setHasMore(Boolean(payload.pagination?.hasMore))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load more character content")
    } finally {
      setLoadingMore(false)
    }
  }, [hasMore, loading, loadingMore, nextOffset, search, selectedId])

  React.useEffect(() => {
    const target = loadMoreRef.current
    if (!target || loading || loadingMore || !hasMore || error) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore()
      },
      { rootMargin: "400px 0px" },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [error, hasMore, loadMore, loading, loadingMore])

  const selectedCharacter = characters.find((character) => character.id === selectedId) ?? null
  const visibleCharacters = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return characters
    return characters.filter((character) =>
      [character.title, character.description, ...character.tags]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    )
  }, [characters, search])
  const mainCharacters = selectedCharacter ? [selectedCharacter] : visibleCharacters

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Button
          type="button"
          size="sm"
          variant={selectedId ? "outline" : "default"}
          className="shrink-0 rounded-full"
          onClick={() => onSelectedIdChange(null)}
        >
          <UsersThree className="size-4" />
          All characters
        </Button>
        {characters.slice(0, 8).map((character) => (
          <Button
            key={character.id}
            type="button"
            size="sm"
            variant={selectedId === character.id ? "default" : "outline"}
            className="max-w-40 shrink-0 rounded-full pl-1.5"
            onClick={() => onSelectedIdChange(character.id)}
          >
            <span className="relative size-6 overflow-hidden rounded-full bg-muted">
              <Image src={character.thumbnailUrl || character.url} alt="" fill className="object-cover" sizes="24px" />
            </span>
            <span className="truncate">{character.title}</span>
          </Button>
        ))}
        {characters.length > 8 ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" size="sm" variant="outline" className="shrink-0 rounded-full">
                +{characters.length - 8} more
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2">
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {characters.slice(8).map((character) => (
                  <Button
                    key={character.id}
                    type="button"
                    variant="ghost"
                    className="w-full justify-start gap-2 px-2"
                    onClick={() => onSelectedIdChange(character.id)}
                  >
                    <span className="relative size-7 shrink-0 overflow-hidden rounded-full bg-muted">
                      <Image
                        src={character.thumbnailUrl || character.url}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="28px"
                      />
                    </span>
                    <span className="truncate">{character.title}</span>
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>

      {error ? <p className="py-12 text-center text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="py-12 text-center text-sm text-muted-foreground">Loading character content…</p> : null}
      {!loading && !error && characters.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Save a character to start organizing their content.</p>
      ) : null}

      {!loading && !error ? (
        <div
          className={cn("grid gap-3", {
            "grid-cols-2": columnCount === 2,
            "grid-cols-2 md:grid-cols-3": columnCount === 3,
            "grid-cols-2 md:grid-cols-4": columnCount === 4,
            "grid-cols-2 md:grid-cols-4 xl:grid-cols-5": columnCount === 5,
            "grid-cols-2 md:grid-cols-4 xl:grid-cols-6": columnCount === 6,
          })}
        >
          {mainCharacters.map((character) => (
            <div
              key={`character-${character.id}`}
              className="relative rounded-2xl ring-2 ring-primary ring-offset-2 ring-offset-background"
            >
              <span className="pointer-events-none absolute left-2 top-2 z-20 rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">
                Main character
              </span>
              <AssetCard
                asset={character}
                isOwner={character.userId === currentUserId}
                onOpen={
                  selectedId
                    ? onOpenAsset
                    : () => onSelectedIdChange(character.id)
                }
              />
            </div>
          ))}
          {generations.map((generation) => (
            <GenerationCard
              key={generation.id}
              generation={generation}
              actionVariant="library"
              onOpen={onOpenGeneration}
              onCopy={onCopy}
              onDownload={onDownload}
              onDelete={onDeleteGeneration}
              onSave={onSave}
            />
          ))}
        </div>
      ) : null}
      <div ref={loadMoreRef} className="h-1" aria-hidden />
      {loadingMore ? (
        <p className="py-5 text-center text-sm text-muted-foreground">Loading more…</p>
      ) : null}
    </div>
  )
}
