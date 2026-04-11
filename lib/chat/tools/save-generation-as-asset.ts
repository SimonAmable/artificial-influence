import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import {
  ASSET_CATEGORY_LABELS,
  normalizeTags,
} from "@/lib/assets/library"
import type {
  AssetCategory,
  AssetType,
  AssetVisibility,
} from "@/lib/assets/types"

interface CreateSaveGenerationAsAssetToolOptions {
  supabase: SupabaseClient
  userId: string
}

const CATEGORY_KEYWORDS: Record<AssetCategory, string[]> = {
  audio: ["audio", "voice", "song", "music", "narration", "podcast", "sound"],
  character: ["person", "portrait", "character", "model", "woman", "man", "avatar", "face"],
  motion: ["motion", "animate", "animation", "cinematic", "camera move", "walk cycle"],
  product: ["product", "packaging", "bottle", "jar", "can", "mockup", "ecommerce", "shoe", "watch"],
  scene: ["scene", "environment", "interior", "room", "landscape", "background", "street", "set"],
  shorts: ["shorts", "reel", "tiktok", "vertical", "ugc", "hook", "youtube short"],
  texture: ["texture", "pattern", "fabric", "material", "surface", "grain"],
  thumbnails: ["thumbnail", "cover", "poster", "banner", "hero image"],
}

const TAG_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "from",
  "into",
  "the",
  "this",
  "that",
  "with",
  "portrait",
  "image",
  "video",
  "audio",
])

function getPublicUrl(supabase: SupabaseClient, storagePath: string) {
  return supabase.storage.from("public-bucket").getPublicUrl(storagePath).data.publicUrl
}

function normalizePromptText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim()
}

function titleCase(value: string) {
  return value.replace(/\b[a-z]/g, (match) => match.toUpperCase())
}

function inferCategory(type: AssetType, prompt: string): AssetCategory {
  const normalizedPrompt = prompt.toLowerCase()

  if (type === "audio") return "audio"
  if (type === "video") {
    return CATEGORY_KEYWORDS.shorts.some((keyword) => normalizedPrompt.includes(keyword))
      ? "shorts"
      : "motion"
  }

  for (const category of ["product", "thumbnails", "texture", "scene", "character"] as const) {
    if (CATEGORY_KEYWORDS[category].some((keyword) => normalizedPrompt.includes(keyword))) {
      return category
    }
  }

  return "character"
}

function buildDescription({
  model,
  prompt,
  type,
}: {
  model: string | null
  prompt: string
  type: AssetType
}) {
  if (prompt.length > 0) {
    return prompt.slice(0, 280)
  }

  return `Saved ${type} generation${model ? ` created with ${model}` : ""}.`
}

function buildTitle({
  category,
  createdAt,
  prompt,
  type,
}: {
  category: AssetCategory
  createdAt: string
  prompt: string
  type: AssetType
}) {
  const cleaned = prompt
    .split(/[.!?\n]/)[0]
    ?.replace(/["']/g, "")
    .replace(/[^a-z0-9\s-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (cleaned) {
    const words = cleaned.split(" ").slice(0, 7).join(" ")
    if (words.length >= 6) {
      return titleCase(words)
    }
  }

  const date = new Date(createdAt)
  const label = ASSET_CATEGORY_LABELS[category]
  const fallbackSuffix =
    type === "video" ? "Clip" : type === "audio" ? "Audio" : "Asset"

  return `${label} ${fallbackSuffix} ${Number.isNaN(date.valueOf()) ? "" : date.toLocaleDateString("en-US")}`.trim()
}

function buildTags({
  aspectRatio,
  category,
  model,
  prompt,
  type,
}: {
  aspectRatio: string | null
  category: AssetCategory
  model: string | null
  prompt: string
  type: AssetType
}) {
  const rawTokens = prompt
    .toLowerCase()
    .replace(/[^a-z0-9: ]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && token.length <= 18 && !TAG_STOP_WORDS.has(token))

  const modelTokens = (model ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3)

  return normalizeTags([
    type,
    category,
    ...(aspectRatio ? [aspectRatio] : []),
    ...modelTokens.slice(0, 2),
    ...rawTokens.slice(0, 6),
  ])
}

function mapAssetRow(row: Record<string, unknown>) {
  return {
    assetType: row.asset_type as AssetType,
    category: row.category as AssetCategory,
    createdAt: row.created_at as string,
    description: (row.description as string | null) ?? null,
    id: row.id as string,
    sourceGenerationId: (row.source_generation_id as string | null) ?? null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
    title: row.title as string,
    updatedAt: row.updated_at as string,
    url: row.asset_url as string,
    visibility: (row.visibility as AssetVisibility) ?? "private",
  }
}

export function createSaveGenerationAsAssetTool({
  supabase,
  userId,
}: CreateSaveGenerationAsAssetToolOptions) {
  return tool({
    description:
      "Save a completed generation as a reusable library asset. Only use this after the user clearly confirms they want that generation saved. If the user does not specify metadata, choose a sensible category, title, and short description yourself.",
    inputSchema: z.object({
      generationId: z
        .string()
        .uuid()
        .describe("The generation UUID to save as an asset. Usually retrieved from listRecentGenerations."),
      confirmed: z
        .boolean()
        .describe("Must be true only after the user explicitly confirmed they want this generation saved as an asset."),
      category: z
        .enum(["character", "scene", "texture", "thumbnails", "motion", "audio", "shorts", "product"])
        .optional()
        .describe("Optional asset category. If omitted, infer the best fit."),
      title: z
        .string()
        .max(120)
        .optional()
        .describe("Optional asset title. If omitted, generate a short descriptive title."),
      description: z
        .string()
        .max(400)
        .optional()
        .describe("Optional asset description. If omitted, derive it from the generation prompt."),
      visibility: z
        .enum(["private", "public"])
        .optional()
        .describe("Optional asset visibility. Defaults to private."),
    }),
    strict: true,
    execute: async ({
      category,
      confirmed,
      description,
      generationId,
      title,
      visibility = "private",
    }) => {
      if (!confirmed) {
        throw new Error("This tool can only be used after the user explicitly confirms they want to save the generation.")
      }

      const { data: generation, error } = await supabase
        .from("generations")
        .select("id, prompt, model, tool, type, status, supabase_storage_path, created_at, aspect_ratio")
        .eq("user_id", userId)
        .eq("id", generationId)
        .maybeSingle()

      if (error) {
        throw new Error(`Failed to load generation: ${error.message}`)
      }

      if (!generation) {
        throw new Error("That generation was not found.")
      }

      if (generation.status !== "completed") {
        throw new Error("Only completed generations can be saved as assets.")
      }

      if (typeof generation.supabase_storage_path !== "string" || generation.supabase_storage_path.length === 0) {
        throw new Error("This generation has no stored media file to save as an asset.")
      }

      const { data: existingAssets, error: existingError } = await supabase
        .from("assets")
        .select("*")
        .eq("user_id", userId)
        .eq("source_generation_id", generationId)
        .order("created_at", { ascending: false })
        .limit(1)

      if (existingError) {
        throw new Error(`Failed to check existing assets: ${existingError.message}`)
      }

      if ((existingAssets ?? []).length > 0) {
        return {
          alreadySaved: true,
          asset: mapAssetRow(existingAssets![0] as Record<string, unknown>),
          message: "That generation was already saved as an asset.",
        }
      }

      const assetType = generation.type as AssetType
      const prompt = normalizePromptText(generation.prompt)
      const resolvedCategory = category ?? inferCategory(assetType, prompt)
      const resolvedDescription =
        typeof description === "string" && description.trim().length > 0
          ? description.trim()
          : buildDescription({
              model: typeof generation.model === "string" ? generation.model : null,
              prompt,
              type: assetType,
            })
      const resolvedTitle =
        typeof title === "string" && title.trim().length > 0
          ? title.trim()
          : buildTitle({
              category: resolvedCategory,
              createdAt: String(generation.created_at),
              prompt,
              type: assetType,
            })
      const assetUrl = getPublicUrl(supabase, generation.supabase_storage_path)
      const thumbnailUrl = assetType === "image" ? assetUrl : null
      const tags = buildTags({
        aspectRatio:
          typeof generation.aspect_ratio === "string" ? generation.aspect_ratio : null,
        category: resolvedCategory,
        model: typeof generation.model === "string" ? generation.model : null,
        prompt,
        type: assetType,
      })

      const { data: createdAsset, error: insertError } = await supabase
        .from("assets")
        .insert({
          user_id: userId,
          source_generation_id: generation.id,
          title: resolvedTitle,
          description: resolvedDescription,
          asset_type: assetType,
          category: resolvedCategory,
          visibility,
          tags,
          asset_url: assetUrl,
          thumbnail_url: thumbnailUrl,
          supabase_storage_path: generation.supabase_storage_path,
          source_node_type: typeof generation.tool === "string" ? generation.tool : "chat-generation",
          metadata: {
            aspectRatio:
              typeof generation.aspect_ratio === "string" ? generation.aspect_ratio : null,
            generatedAt: generation.created_at,
            model: typeof generation.model === "string" ? generation.model : null,
            prompt,
            source: "generation",
            status: generation.status,
            tool: typeof generation.tool === "string" ? generation.tool : null,
          },
        })
        .select("*")
        .single()

      if (insertError || !createdAsset) {
        throw new Error(`Failed to save asset: ${insertError?.message ?? "Unknown error"}`)
      }

      return {
        alreadySaved: false,
        asset: mapAssetRow(createdAsset as Record<string, unknown>),
        message: `Saved "${resolvedTitle}" as a reusable asset.`,
      }
    },
  })
}
