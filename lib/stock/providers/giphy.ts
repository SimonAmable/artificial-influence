import type {
  SearchStockReferencesInput,
  SearchStockReferencesResult,
  StockReferenceMediaType,
  StockReferenceRating,
  StockReferenceResult,
} from "@/lib/stock/types"

type GiphyImagesVariant = {
  height?: string
  mp4?: string
  url?: string
  webp?: string
  width?: string
}

type GiphyItem = {
  id: string
  images?: {
    downsized_still?: GiphyImagesVariant
    fixed_width?: GiphyImagesVariant
    original?: GiphyImagesVariant
    original_still?: GiphyImagesVariant
    preview_gif?: GiphyImagesVariant
  }
  title?: string
  type?: string
  url?: string
}

type GiphySearchResponse = {
  data?: GiphyItem[]
}

const GIPHY_LICENSE_NOTICE =
  "Live external reference from GIPHY. Treat as a source reference, not a saved stock asset."

function asNumber(value: string | undefined) {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function trimTitle(value: string | undefined, fallback: string) {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : fallback
}

function mapGiphyItem(item: GiphyItem, mediaType: StockReferenceMediaType): StockReferenceResult | null {
  const fixedWidth = item.images?.fixed_width
  const original = item.images?.original
  const previewGif = item.images?.preview_gif
  const still = item.images?.downsized_still ?? item.images?.original_still

  const previewUrl =
    fixedWidth?.webp ??
    fixedWidth?.mp4 ??
    fixedWidth?.url ??
    previewGif?.url ??
    still?.url ??
    original?.webp ??
    original?.url

  const thumbnailUrl = still?.url ?? fixedWidth?.webp ?? fixedWidth?.url ?? original?.webp ?? original?.url
  const referenceImageUrl = original?.webp ?? original?.url ?? fixedWidth?.webp ?? fixedWidth?.url
  const referenceVideoUrl = original?.mp4 ?? fixedWidth?.mp4 ?? null

  if (!previewUrl || !thumbnailUrl || !item.url) {
    return null
  }

  return {
    id: item.id,
    provider: "giphy",
    mediaType,
    title: trimTitle(item.title, "Untitled GIPHY reference"),
    pageUrl: item.url,
    previewUrl,
    thumbnailUrl,
    referenceImageUrl: referenceImageUrl ?? null,
    referenceVideoUrl,
    width: asNumber(original?.width ?? fixedWidth?.width),
    height: asNumber(original?.height ?? fixedWidth?.height),
    attribution: "Powered by GIPHY",
    licenseNotice: GIPHY_LICENSE_NOTICE,
  }
}

async function runGiphySearch({
  apiKey,
  query,
  mediaType,
  rating,
  limit,
  offset,
  lang,
}: {
  apiKey: string
  query: string
  mediaType: "gif" | "sticker"
  rating: StockReferenceRating
  limit: number
  offset: number
  lang?: string
}) {
  const endpoint =
    mediaType === "sticker"
      ? "https://api.giphy.com/v1/stickers/search"
      : "https://api.giphy.com/v1/gifs/search"

  const url = new URL(endpoint)
  url.searchParams.set("api_key", apiKey)
  url.searchParams.set("q", query)
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("offset", String(offset))
  url.searchParams.set("rating", rating)
  url.searchParams.set("bundle", "messaging_non_clips")

  if (lang?.trim()) {
    url.searchParams.set("lang", lang.trim())
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
    next: { revalidate: 300 },
  })

  if (!response.ok) {
    throw new Error(`GIPHY search failed with HTTP ${response.status}.`)
  }

  const payload = (await response.json()) as GiphySearchResponse
  return (payload.data ?? [])
    .map((item) => mapGiphyItem(item, mediaType))
    .filter((item): item is StockReferenceResult => Boolean(item))
}

export async function searchGiphyStockReferences(
  input: SearchStockReferencesInput,
): Promise<SearchStockReferencesResult> {
  const apiKey = process.env.GIPHY_API_KEY || process.env.NEXT_PUBLIC_GIPHY_API_KEY

  if (!apiKey) {
    throw new Error("GIPHY API key is not configured.")
  }

  const query = input.query.trim()
  if (!query) {
    return {
      provider: "giphy",
      query,
      mediaType: input.mediaType ?? "all",
      rating: input.rating ?? "pg",
      results: [],
      message: "Enter a search term to find stock references.",
      total: 0,
      attribution: "Powered by GIPHY",
      licenseNotice: GIPHY_LICENSE_NOTICE,
    }
  }

  const limit = Math.min(Math.max(input.limit ?? 18, 1), 24)
  const offset = Math.max(input.offset ?? 0, 0)
  const rating: StockReferenceRating = input.rating ?? "pg"
  const mediaType = input.mediaType === "sticker" || input.mediaType === "gif" ? input.mediaType : "all"
  const results =
    mediaType === "all"
      ? [
          ...await runGiphySearch({
            apiKey,
            query,
            mediaType: "gif",
            rating,
            limit: Math.max(1, Math.ceil(limit / 2)),
            offset,
            lang: input.lang,
          }),
          ...await runGiphySearch({
            apiKey,
            query,
            mediaType: "sticker",
            rating,
            limit: Math.max(1, Math.floor(limit / 2)),
            offset,
            lang: input.lang,
          }),
        ].slice(0, limit)
      : await runGiphySearch({
          apiKey,
          query,
          mediaType,
          rating,
          limit,
          offset,
          lang: input.lang,
        })

  return {
    provider: "giphy",
    query,
    mediaType,
    rating,
    results,
    message:
      results.length > 0
        ? `Found ${results.length} ${mediaType === "all" ? "GIPHY" : mediaType === "sticker" ? "sticker" : "GIF"} reference${results.length === 1 ? "" : "s"}.`
        : `No ${mediaType === "all" ? "GIPHY" : mediaType === "sticker" ? "sticker" : "GIF"} references matched that search.`,
    total: results.length,
    attribution: "Powered by GIPHY",
    licenseNotice: GIPHY_LICENSE_NOTICE,
  }
}
