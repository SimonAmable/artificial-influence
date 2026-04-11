import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

interface CreateSearchAssetsToolOptions {
  supabase: SupabaseClient
  userId: string
}

type AssetTypeFilter = "image" | "video" | "audio"
type AssetCategoryFilter =
  | "character"
  | "scene"
  | "texture"
  | "thumbnails"
  | "motion"
  | "audio"
  | "shorts"
  | "product"

function scoreAssetMatch(
  asset: { title: string; description: string | null; tags: string[]; category: string; assetType: string },
  query: string,
) {
  if (!query) return 1

  const haystacks = [
    asset.title.toLowerCase(),
    (asset.description ?? "").toLowerCase(),
    asset.tags.join(" ").toLowerCase(),
    asset.category.toLowerCase(),
    asset.assetType.toLowerCase(),
  ]

  if (haystacks.some((value) => value === query)) return 100
  if (haystacks.some((value) => value.includes(query))) return 70

  const queryTokens = query.split(/\s+/).filter(Boolean)
  const overlap = haystacks.reduce((best, value) => {
    const tokenCount = queryTokens.filter((token) => value.includes(token)).length
    return Math.max(best, tokenCount)
  }, 0)

  return overlap > 0 ? 30 + overlap * 10 : 0
}

export function createSearchAssetsTool({
  supabase,
  userId,
}: CreateSearchAssetsToolOptions) {
  return tool({
    description:
      "Search saved UniCan assets. Use this when the user wants to reuse an existing image, video, or audio asset, or when you need asset ids to feed another tool.",
    inputSchema: z.object({
      query: z
        .string()
        .max(120)
        .optional()
        .describe("Optional search text such as red hair character, studio product, or motion reference."),
      assetType: z
        .enum(["image", "video", "audio"])
        .optional()
        .describe("Optional asset type filter."),
      category: z
        .enum(["character", "scene", "texture", "thumbnails", "motion", "audio", "shorts", "product"])
        .optional()
        .describe("Optional asset category filter."),
      includePublic: z
        .boolean()
        .optional()
        .describe("Whether to also search public assets outside the user's private library."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(12)
        .optional()
        .describe("Maximum number of assets to return."),
    }),
    strict: true,
    execute: async ({ assetType, category, includePublic = false, limit = 8, query }) => {
      let dbQuery = supabase
        .from("assets")
        .select(
          "id, title, description, asset_type, category, visibility, tags, asset_url, thumbnail_url, created_at, updated_at",
        )
        .order("created_at", { ascending: false })
        .limit(Math.max(limit * 3, 24))

      if (includePublic) {
        dbQuery = dbQuery.or(`user_id.eq.${userId},visibility.eq.public`)
      } else {
        dbQuery = dbQuery.eq("user_id", userId)
      }

      if (assetType) {
        dbQuery = dbQuery.eq("asset_type", assetType)
      }

      if (category) {
        dbQuery = dbQuery.eq("category", category)
      }

      const { data, error } = await dbQuery

      if (error) {
        throw new Error(`Failed to search assets: ${error.message}`)
      }

      const normalizedQuery = (query ?? "").trim().toLowerCase()
      const assets = (data ?? [])
        .map((asset) => ({
          assetType: asset.asset_type as AssetTypeFilter,
          category: asset.category as AssetCategoryFilter,
          createdAt: String(asset.created_at),
          description: typeof asset.description === "string" ? asset.description : null,
          id: String(asset.id),
          tags: Array.isArray(asset.tags)
            ? asset.tags.filter((tag): tag is string => typeof tag === "string")
            : [],
          thumbnailUrl: typeof asset.thumbnail_url === "string" ? asset.thumbnail_url : null,
          title: String(asset.title ?? "Untitled Asset"),
          updatedAt: String(asset.updated_at),
          url: String(asset.asset_url),
          visibility:
            asset.visibility === "public" || asset.visibility === "private"
              ? asset.visibility
              : "private",
        }))
        .map((asset) => ({
          ...asset,
          score: scoreAssetMatch(asset, normalizedQuery),
        }))
        .filter((asset) => normalizedQuery.length === 0 || asset.score > 0)
        .sort((a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, limit)
        .map(({ score: _score, ...asset }) => asset)

      return {
        assets,
        message:
          assets.length > 0
            ? `Found ${assets.length} saved asset${assets.length === 1 ? "" : "s"}.`
            : "No saved assets matched that search.",
        query: query ?? null,
        total: assets.length,
      }
    },
  })
}
