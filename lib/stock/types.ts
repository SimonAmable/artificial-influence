export type StockReferenceProvider = "giphy"

export type StockReferenceMediaType =
  | "gif"
  | "sticker"
  | "image"
  | "video"
  | "audio"

export type StockReferenceRating = "g" | "pg" | "pg-13" | "r"

export interface StockReferenceResult {
  id: string
  provider: StockReferenceProvider
  mediaType: StockReferenceMediaType
  title: string
  pageUrl: string
  previewUrl: string
  thumbnailUrl: string
  referenceImageUrl?: string | null
  referenceVideoUrl?: string | null
  width?: number | null
  height?: number | null
  attribution: string
  licenseNotice?: string | null
}

export interface SearchStockReferencesInput {
  query: string
  provider?: StockReferenceProvider | "auto"
  mediaType?: StockReferenceMediaType | "all"
  rating?: StockReferenceRating
  limit?: number
  offset?: number
  lang?: string
  intent?: string
}

export interface SearchStockReferencesResult {
  provider: StockReferenceProvider
  query: string
  mediaType: StockReferenceMediaType | "all"
  rating: StockReferenceRating
  results: StockReferenceResult[]
  message: string
  total: number
  attribution: string
  licenseNotice?: string | null
}
