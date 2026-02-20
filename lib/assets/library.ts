import type {
  AssetCategory,
  AssetRecord,
  AssetType,
  AssetVisibility,
  CreateAssetInput,
} from "@/lib/assets/types"

export const ASSET_CATEGORIES: AssetCategory[] = [
  "character",
  "scene",
  "texture",
  "motion",
  "audio",
]

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  character: "Characters",
  scene: "Scenes",
  texture: "Textures",
  motion: "Motion",
  audio: "Audio",
}

export const STARTER_TAGS = [
  "tiktok",
  "dance",
  "shorts",
  "reels",
  "cinematic",
  "studio",
  "street",
  "portrait",
  "closeup",
  "9:16",
] as const

export function getDefaultCategoryByType(assetType: AssetType): AssetCategory {
  if (assetType === "video") return "motion"
  if (assetType === "audio") return "audio"
  return "character"
}

export function getDefaultTagsForType(assetType: AssetType): string[] {
  if (assetType === "video") return ["tiktok", "dance", "shorts"]
  if (assetType === "audio") return ["reels", "shorts"]
  return ["portrait", "9:16"]
}

export interface AssetQuery {
  visibility?: AssetVisibility
  category?: AssetCategory
  search?: string
  limit?: number
  offset?: number
}

function queryParams(query: AssetQuery) {
  const params = new URLSearchParams()
  if (query.visibility) params.set("visibility", query.visibility)
  if (query.category) params.set("category", query.category)
  if (query.search?.trim()) params.set("search", query.search.trim())
  if (typeof query.limit === "number") params.set("limit", String(query.limit))
  if (typeof query.offset === "number") params.set("offset", String(query.offset))
  return params
}

export async function listAssets(query: AssetQuery): Promise<AssetRecord[]> {
  const params = queryParams(query)
  const response = await fetch(`/api/assets?${params.toString()}`)
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error || "Failed to fetch assets")
  }
  const data = await response.json()
  return (data.assets || []) as AssetRecord[]
}

export async function saveAsset(input: CreateAssetInput): Promise<AssetRecord> {
  const response = await fetch("/api/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error || "Failed to save asset")
  }

  const data = await response.json()
  return data.asset as AssetRecord
}

export async function deleteAsset(assetId: string): Promise<void> {
  const response = await fetch(`/api/assets/${assetId}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error || "Failed to delete asset")
  }
}

export async function updateAsset(assetId: string, input: CreateAssetInput): Promise<AssetRecord> {
  const response = await fetch(`/api/assets/${assetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error || "Failed to update asset")
  }

  const data = await response.json()
  return data.asset as AssetRecord
}

export function normalizeTags(tags: string[] | undefined) {
  return (tags || [])
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0)
    .slice(0, 12)
}

export function inferStoragePathFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    const marker = "/storage/v1/object/public/public-bucket/"
    const markerIndex = parsed.pathname.indexOf(marker)
    if (markerIndex < 0) return null
    const startIndex = markerIndex + marker.length
    const candidate = parsed.pathname.slice(startIndex)
    return candidate || null
  } catch {
    return null
  }
}
