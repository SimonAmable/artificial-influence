"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowSquareOut,
  Copy,
  FilmStrip,
  Gif,
  Image as ImageIcon,
  MagnifyingGlass,
  Sticker,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SearchStockReferencesResult, StockReferenceResult } from "@/lib/stock/types"

const DEFAULT_QUERY = "reaction meme"

function ResourcePreview({ result }: { result: StockReferenceResult }) {
  if (result.referenceVideoUrl) {
    return (
      <video
        src={result.referenceVideoUrl}
        muted
        loop
        autoPlay
        playsInline
        className="h-full w-full object-cover"
      />
    )
  }

  return (
    <Image
      src={result.previewUrl}
      alt={result.title}
      fill
      unoptimized
      sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw"
      className="object-cover"
    />
  )
}

export function ResourcesPage() {
  const [query, setQuery] = React.useState(DEFAULT_QUERY)
  const deferredQuery = React.useDeferredValue(query)
  const [provider, setProvider] = React.useState<"auto" | "giphy">("auto")
  const [mediaType, setMediaType] = React.useState<"all" | "gif" | "sticker">("all")
  const [rating, setRating] = React.useState<"g" | "pg" | "pg-13" | "r">("pg")
  const [result, setResult] = React.useState<SearchStockReferencesResult | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  function handleQueryChange(nextValue: string) {
    setQuery(nextValue)

    if (!nextValue.trim()) {
      setResult(null)
      setError(null)
      setIsLoading(false)
    }
  }

  React.useEffect(() => {
    const trimmedQuery = deferredQuery.trim()
    if (!trimmedQuery) {
      return
    }

    const controller = new AbortController()

    async function loadResults() {
      setIsLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          query: trimmedQuery,
          provider,
          mediaType,
          rating,
          limit: "18",
        })

        const response = await fetch(`/api/stock/search?${params.toString()}`, {
          signal: controller.signal,
        })
        const payload = (await response.json()) as SearchStockReferencesResult | { error?: string }

        if (!response.ok) {
          throw new Error("error" in payload && payload.error ? payload.error : "Stock search failed.")
        }

        React.startTransition(() => {
          setResult(payload as SearchStockReferencesResult)
        })
      } catch (loadError) {
        if (controller.signal.aborted) return
        setResult(null)
        setError(loadError instanceof Error ? loadError.message : "Stock search failed.")
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadResults()

    return () => controller.abort()
  }, [deferredQuery, mediaType, provider, rating])

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`)
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,200,120,0.18),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(120,180,255,0.18),_transparent_30%),linear-gradient(180deg,_rgba(250,248,243,1)_0%,_rgba(255,255,255,1)_24%,_rgba(248,247,244,1)_100%)]">
      <div className="container mx-auto px-4 py-10">
        <div className="mx-auto max-w-6xl space-y-8">
          <section className="rounded-[28px] border border-border/70 bg-background/90 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.08)] backdrop-blur">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-3">
                <Badge variant="outline" className="w-fit gap-2 rounded-full px-3 py-1">
                  <MagnifyingGlass className="h-3.5 w-3.5" />
                  Live stock references
                </Badge>
                <div className="space-y-2">
                  <h1 className="text-4xl font-semibold tracking-tight text-foreground">Resources</h1>
                  <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                    Search live external references for memes, reactions, GIFs, and stickers. These stay external so you can pull URLs into the agent without mixing them into your saved asset library.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                <p>{result?.attribution ?? "Powered by GIPHY"}</p>
                <p className="mt-1">Use copied URLs as transient references for image and video generation.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_160px_140px]">
              <Input
                value={query}
                onChange={(event) => handleQueryChange(event.target.value)}
                placeholder="Search exact terms, like cat reaction meme"
                className="h-12 rounded-2xl border-border/70 bg-background px-4"
              />
              <Select value={provider} onValueChange={(value: "auto" | "giphy") => setProvider(value)}>
                <SelectTrigger className="h-12 rounded-2xl">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto route</SelectItem>
                  <SelectItem value="giphy">GIPHY</SelectItem>
                </SelectContent>
              </Select>
              <Select value={mediaType} onValueChange={(value: "all" | "gif" | "sticker") => setMediaType(value)}>
                <SelectTrigger className="h-12 rounded-2xl">
                  <SelectValue placeholder="Media type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="gif">GIFs</SelectItem>
                  <SelectItem value="sticker">Stickers</SelectItem>
                </SelectContent>
              </Select>
              <Select value={rating} onValueChange={(value: "g" | "pg" | "pg-13" | "r") => setRating(value)}>
                <SelectTrigger className="h-12 rounded-2xl">
                  <SelectValue placeholder="Rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="g">G</SelectItem>
                  <SelectItem value="pg">PG</SelectItem>
                  <SelectItem value="pg-13">PG-13</SelectItem>
                  <SelectItem value="r">R</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary" className="gap-2 rounded-full px-3 py-1">
                  {mediaType === "sticker" ? <Sticker className="h-3.5 w-3.5" /> : <Gif className="h-3.5 w-3.5" />}
                  {result?.total ?? 0} results
                </Badge>
                <span>{result?.message ?? "Search for a live reference source."}</span>
              </div>
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/assets">Open saved assets</Link>
              </Button>
            </div>

            {error ? (
              <Card className="border-destructive/40 bg-destructive/5">
                <CardContent className="p-5 text-sm text-destructive">{error}</CardContent>
              </Card>
            ) : null}

            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Card key={index} className="overflow-hidden border-border/60 bg-background/80">
                    <div className="aspect-[4/3] animate-pulse bg-muted" />
                    <CardContent className="space-y-3 p-4">
                      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : null}

            {!isLoading && result?.results.length ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {result.results.map((item) => (
                  <Card key={`${item.provider}-${item.id}`} className="overflow-hidden border-border/60 bg-background/90 shadow-sm">
                    <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                      <ResourcePreview result={item} />
                      <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                        <Badge className="rounded-full bg-background/90 text-foreground shadow-sm">{item.provider}</Badge>
                        <Badge variant="secondary" className="rounded-full">
                          {item.mediaType === "sticker" ? <Sticker className="mr-1 h-3 w-3" /> : item.referenceVideoUrl ? <FilmStrip className="mr-1 h-3 w-3" /> : <ImageIcon className="mr-1 h-3 w-3" />}
                          {item.mediaType}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="space-y-4 p-4">
                      <div className="space-y-2">
                        <p className="line-clamp-2 text-sm font-medium text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.attribution}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        {item.width && item.height ? <span>{item.width}x{item.height}</span> : null}
                        <span>{item.referenceVideoUrl ? "video-ready" : "image-ready"}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.referenceImageUrl ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                            onClick={() => void copyValue(item.referenceImageUrl!, "Image URL")}
                          >
                            <Copy className="mr-2 h-3.5 w-3.5" />
                            Copy image URL
                          </Button>
                        ) : null}
                        {item.referenceVideoUrl ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                            onClick={() => void copyValue(item.referenceVideoUrl!, "Video URL")}
                          >
                            <Copy className="mr-2 h-3.5 w-3.5" />
                            Copy video URL
                          </Button>
                        ) : null}
                        <Button asChild size="sm" className="rounded-full">
                          <Link href={item.pageUrl} target="_blank" rel="noreferrer">
                            <ArrowSquareOut className="mr-2 h-3.5 w-3.5" />
                            Open source
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : null}

            {!isLoading && !error && result && result.results.length === 0 ? (
              <Card className="border-border/60 bg-background/80">
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  No live references matched that search. Try a shorter reaction phrase or switch between GIFs and stickers.
                </CardContent>
              </Card>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  )
}
