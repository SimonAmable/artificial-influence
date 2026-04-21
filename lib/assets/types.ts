export type AssetVisibility = "private" | "public"

export type AssetCategory =
  | "character"
  | "scene"
  | "texture"
  | "thumbnails"
  | "motion"
  | "audio"
  | "shorts"
  | "product"

export type AssetType = "image" | "video" | "audio"

export interface AssetRecord {
  id: string
  userId: string
  uploadId?: string | null
  title: string
  description?: string | null
  assetType: AssetType
  category: AssetCategory
  visibility: AssetVisibility
  tags: string[]
  url: string
  thumbnailUrl?: string | null
  createdAt: string
  updatedAt: string
  sourceNodeType?: string | null
  sourceGenerationId?: string | null
}

export interface CreateAssetInput {
  title: string
  description?: string
  assetType: AssetType
  category: AssetCategory
  visibility: AssetVisibility
  tags?: string[]
  url: string
  uploadId?: string
  supabaseStoragePath?: string
  thumbnailUrl?: string
  sourceNodeType?: string
  sourceGenerationId?: string
}
