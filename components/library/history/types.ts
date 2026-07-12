import type { AssetType } from "@/lib/assets/types"

export type GenerationType = "image" | "video" | "audio" | "all"
export type MediaGenerationType = Exclude<GenerationType, "all">
export type HistorySource = "all" | "generation" | "upload"
export type HistoryItemSource = Exclude<HistorySource, "all">

export type Generation = {
  id: string
  user_id: string
  prompt: string | null
  supabase_storage_path: string
  type: MediaGenerationType
  model: string | null
  tool?: string | null
  aspect_ratio?: string | null
  created_at: string
  url: string
  reference_image_urls?: string[]
  /** Where this history row came from. Missing means generation (legacy API). */
  source?: HistoryItemSource
  uploadId?: string
}

export type PaginationState = {
  limit: number
  offset: number
  returned: number
  total: number
  hasMore: boolean
}

export type PaginatedState<T> = {
  items: T[]
  query: string
  hasLoaded: boolean
  initialLoading: boolean
  loadingMore: boolean
  error: string | null
  nextOffset: number
  pagination: PaginationState
}

export type HistoryResponse = {
  generations?: Generation[]
  pagination?: Partial<PaginationState>
}

export type SaveAssetDraft = {
  url: string
  uploadId?: string
  supabaseStoragePath?: string
  assetType: AssetType
  title: string
  visibility?: "private" | "public"
  category?: import("@/lib/assets/types").AssetCategory
  sourceNodeType?: string
  sourceGenerationId?: string
  tags?: string[]
  description?: string
}

export type GenerationCardActionVariant = "library" | "fanvue"

export type FanvueGenerationActions = {
  onSendToVault: (generation: Generation) => void
  onCreatePost: (generation: Generation) => void
}
