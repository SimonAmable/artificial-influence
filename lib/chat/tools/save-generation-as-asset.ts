import { tool } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import {
  ASSET_CATEGORY_LABELS,
  normalizeTags,
} from "@/lib/assets/library"
import { parseMediaId } from "@/lib/chat/media-id"
import type {
  AssetCategory,
  AssetType,
  AssetVisibility,
} from "@/lib/assets/types"

interface CreateSaveGenerationAsAssetToolOptions {
  supabase: SupabaseClient
  userId: string
}

type SaveSource =
  | { kind: "generation"; id: string }
  | { kind: "upload"; id: string }

const CATEGORY_KEYWORDS: Record<AssetCategory, string[]> = {
  character: ["person", "portrait", "character", "model", "woman", "man", "avatar", "face"],
  scene: ["scene", "environment", "interior", "room", "landscape", "background", "street", "set"],
  shorts: ["motion", "animate", "animation", "cinematic", "camera move", "walk cycle", "shorts", "reel", "tiktok", "vertical", "ugc", "hook", "youtube short"],
  element: [
    "audio", "voice", "song", "music", "narration", "podcast", "sound",
    "product", "packaging", "bottle", "jar", "can", "mockup", "ecommerce", "shoe", "watch",
    "texture", "pattern", "fabric", "material", "surface", "grain",
    "thumbnail", "cover", "poster", "banner", "hero image",
  ],
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

function getPublicUrl(supabase: SupabaseClient, bucket: string, storagePath: string) {
  return supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl
}

function normalizePromptText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim()
}

function titleCase(value: string) {
  return value.replace(/\b[a-z]/g, (match) => match.toUpperCase())
}

function inferAssetTypeFromMime(mimeType: string): AssetType {
  const mime = mimeType.toLowerCase()
  if (mime.startsWith("video/")) return "video"
  if (mime.startsWith("audio/")) return "audio"
  return "image"
}

function inferCategory(type: AssetType, prompt: string): AssetCategory {
  const normalizedPrompt = prompt.toLowerCase()

  if (type === "audio") return "element"
  if (type === "video") return "shorts"

  for (const category of ["element", "scene", "character"] as const) {
    if (CATEGORY_KEYWORDS[category].some((keyword) => normalizedPrompt.includes(keyword))) {
      return category
    }
  }

  return "character"
}

function buildAgentContextDescription({
  category,
  model,
  prompt,
  sourceLabel,
  type,
}: {
  category: AssetCategory
  model: string | null
  prompt: string
  sourceLabel?: string | null
  type: AssetType
}) {
  const lines: string[] = []

  if (sourceLabel) {
    lines.push(`Source: ${sourceLabel}.`)
  }
  if (model) {
    lines.push(`Recorded from model: ${model}.`)
  }
  lines.push(`Asset type: ${type}. Library category: ${category}.`)

  if (prompt.length > 0) {
    lines.push("Context notes (verbatim):", prompt)
  } else {
    lines.push("No prompt or label text was stored on this source.")
  }

  switch (category) {
    case "shorts":
      lines.push(
        "Agent context: Use as a shorts/video reference—match movement, rhythm, camera dynamics, and energy. Identity or exact likeness may come from separate character or face assets.",
      )
      break
    case "character":
      lines.push(
        "Agent context: Use as a generalized character reference—silhouette, styling, wardrobe palette, body type, personality vibe. Pair with dedicated face or portrait assets when likeness must be exact.",
      )
      break
    case "scene":
      lines.push(
        "Agent context: Use for environment, layout, lighting direction, palette, and establishing mood in new compositions.",
      )
      break
    case "element":
      lines.push(
        "Agent context: Use as a discrete element—describe role (product shot, texture, VO/music bed, etc.) so it can slot into larger workflows.",
      )
      break
  }

  const text = lines.join("\n\n")
  return text.length > 8000 ? `${text.slice(0, 7997)}...` : text
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
    sourceUploadId: (row.upload_id as string | null) ?? null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
    title: row.title as string,
    updatedAt: row.updated_at as string,
    url: row.asset_url as string,
    visibility: (row.visibility as AssetVisibility) ?? "private",
  }
}

function resolveSaveSource(input: {
  generationId?: string
  uploadId?: string
  mediaId?: string
}): SaveSource | null {
  if (typeof input.generationId === "string" && input.generationId.length > 0) {
    return { kind: "generation", id: input.generationId }
  }
  if (typeof input.uploadId === "string" && input.uploadId.length > 0) {
    return { kind: "upload", id: input.uploadId }
  }
  if (typeof input.mediaId === "string" && input.mediaId.trim().length > 0) {
    const parsed = parseMediaId(input.mediaId.trim())
    if (parsed.namespace === "upload") {
      return { kind: "upload", id: parsed.uuid }
    }
    if (parsed.namespace === "generation") {
      return { kind: "generation", id: parsed.uuid }
    }
    return { kind: "generation", id: parsed.uuid }
  }
  return null
}

async function resolveLegacyUuidSource(
  supabase: SupabaseClient,
  userId: string,
  uuid: string,
): Promise<SaveSource | null> {
  const { data: generation } = await supabase
    .from("generations")
    .select("id")
    .eq("user_id", userId)
    .eq("id", uuid)
    .maybeSingle()

  if (generation?.id) {
    return { kind: "generation", id: generation.id as string }
  }

  const { data: upload } = await supabase
    .from("uploads")
    .select("id")
    .eq("user_id", userId)
    .eq("id", uuid)
    .maybeSingle()

  if (upload?.id) {
    return { kind: "upload", id: upload.id as string }
  }

  return null
}

export function createSaveGenerationAsAssetTool({
  supabase,
  userId,
}: CreateSaveGenerationAsAssetToolOptions) {
  return tool({
    description:
      "Save thread media or update an existing library asset. Create mode: pass **generationId**, **uploadId**, or **mediaId** (`upl_<uuid>` / `gen_<uuid>` from listThreadMedia, or raw generation UUID from listRecentGenerations). Uploads and generations are both supported. Update mode: pass **assetId** (from searchAssets) plus any metadata fields to change (title, description, category, tags, visibility). Only use after the user clearly confirms save or update. If metadata is omitted on create, infer category, title, and rich agent-context description.",
    inputSchema: z
      .object({
        assetId: z
          .string()
          .uuid()
          .optional()
          .describe("Existing asset UUID to update. Use searchAssets to find ids."),
        generationId: z
          .string()
          .uuid()
          .optional()
          .describe("Completed generation UUID (listRecentGenerations `id` or `gen_<uuid>` via mediaId)."),
        uploadId: z
          .string()
          .uuid()
          .optional()
          .describe("Upload UUID (listThreadMedia `upl_<uuid>` via mediaId)."),
        mediaId: z
          .string()
          .optional()
          .describe("Thread media id: `upl_<uuid>`, `gen_<uuid>`, or legacy raw UUID."),
        confirmed: z
          .boolean()
          .describe("Must be true only after the user explicitly confirmed they want this saved or updated."),
        category: z
          .enum(["character", "scene", "shorts", "element"])
          .optional()
          .describe("Asset category. Required on update when changing category; inferred on create if omitted."),
        title: z
          .string()
          .max(120)
          .optional()
          .describe("Asset title. On update, pass only when changing the title."),
        description: z
          .string()
          .max(8000)
          .optional()
          .describe(
            "Rich agent-context notes. Shorts: movement, rhythm, camera. Character: generalized look. On update, pass only when changing description.",
          ),
        tags: z
          .array(z.string().max(40))
          .max(12)
          .optional()
          .describe("Optional tags. On create, merged with inferred tags when omitted."),
        visibility: z
          .enum(["private", "public"])
          .optional()
          .describe("Asset visibility. Defaults to private on create; unchanged on update if omitted."),
      })
      .superRefine((value, ctx) => {
        const isUpdate = typeof value.assetId === "string" && value.assetId.length > 0
        const source = resolveSaveSource(value)

        if (isUpdate) {
          if (source) {
            ctx.addIssue({
              code: "custom",
              message: "Do not pass generationId, uploadId, or mediaId when updating an existing asset.",
              path: ["assetId"],
            })
          }
          const hasMetadataChange =
            value.category !== undefined ||
            value.title !== undefined ||
            value.description !== undefined ||
            value.tags !== undefined ||
            value.visibility !== undefined
          if (!hasMetadataChange) {
            ctx.addIssue({
              code: "custom",
              message: "Provide at least one field to update (title, description, category, tags, or visibility).",
              path: ["assetId"],
            })
          }
          return
        }

        if (!source) {
          ctx.addIssue({
            code: "custom",
            message: "Provide exactly one of generationId, uploadId, or mediaId to save new media as an asset.",
            path: ["mediaId"],
          })
        }
      }),
    strict: true,
    execute: async ({
      assetId,
      category,
      confirmed,
      description,
      generationId,
      mediaId,
      tags,
      title,
      uploadId,
      visibility = "private",
    }) => {
      if (!confirmed) {
        throw new Error(
          "This tool can only be used after the user explicitly confirms they want to save or update the asset.",
        )
      }

      if (typeof assetId === "string" && assetId.length > 0) {
        const { data: existing, error: fetchError } = await supabase
          .from("assets")
          .select("*")
          .eq("user_id", userId)
          .eq("id", assetId)
          .maybeSingle()

        if (fetchError) {
          throw new Error(`Failed to load asset: ${fetchError.message}`)
        }
        if (!existing) {
          throw new Error("That asset was not found.")
        }

        const updatePayload: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        }

        if (category !== undefined) updatePayload.category = category
        if (title !== undefined) {
          const trimmed = title.trim()
          if (!trimmed) throw new Error("Title cannot be empty.")
          updatePayload.title = trimmed
        }
        if (description !== undefined) {
          updatePayload.description = description.trim() || null
        }
        if (tags !== undefined) {
          updatePayload.tags = normalizeTags(tags)
        }
        if (visibility !== undefined) {
          updatePayload.visibility = visibility
        }

        const { data: updatedAsset, error: updateError } = await supabase
          .from("assets")
          .update(updatePayload)
          .eq("user_id", userId)
          .eq("id", assetId)
          .select("*")
          .single()

        if (updateError || !updatedAsset) {
          throw new Error(`Failed to update asset: ${updateError?.message ?? "Unknown error"}`)
        }

        const mapped = mapAssetRow(updatedAsset as Record<string, unknown>)
        return {
          alreadySaved: false,
          asset: mapped,
          message: `Updated "${mapped.title}" in your asset library.`,
          updated: true,
        }
      }

      let source = resolveSaveSource({ generationId, uploadId, mediaId })
      if (mediaId && !generationId && !uploadId) {
        const parsed = parseMediaId(mediaId.trim())
        if (parsed.namespace === "legacy") {
          const resolved = await resolveLegacyUuidSource(supabase, userId, parsed.uuid)
          if (!resolved) {
            throw new Error("That media id was not found as a generation or upload.")
          }
          source = resolved
        }
      }

      if (!source) {
        throw new Error("Provide generationId, uploadId, or mediaId to save media as an asset.")
      }

      if (source.kind === "upload") {
        return saveUploadAsAsset({
          supabase,
          userId,
          uploadId: source.id,
          category,
          description,
          tags,
          title,
          visibility,
        })
      }

      return saveGenerationAsAsset({
        supabase,
        userId,
        generationId: source.id,
        category,
        description,
        tags,
        title,
        visibility,
      })
    },
  })
}

async function saveUploadAsAsset({
  supabase,
  userId,
  uploadId,
  category,
  description,
  tags,
  title,
  visibility,
}: {
  supabase: SupabaseClient
  userId: string
  uploadId: string
  category?: AssetCategory
  description?: string
  tags?: string[]
  title?: string
  visibility: AssetVisibility
}) {
  const { data: upload, error } = await supabase
    .from("uploads")
    .select("id, bucket, storage_path, mime_type, label, original_filename, created_at")
    .eq("user_id", userId)
    .eq("id", uploadId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load upload: ${error.message}`)
  }
  if (!upload) {
    throw new Error("That upload was not found.")
  }

  if (typeof upload.storage_path !== "string" || upload.storage_path.length === 0) {
    throw new Error("This upload has no stored media file to save as an asset.")
  }

  const { data: existingAssets, error: existingError } = await supabase
    .from("assets")
    .select("*")
    .eq("user_id", userId)
    .eq("upload_id", uploadId)
    .order("created_at", { ascending: false })
    .limit(1)

  if (existingError) {
    throw new Error(`Failed to check existing assets: ${existingError.message}`)
  }

  if ((existingAssets ?? []).length > 0) {
    return {
      alreadySaved: true,
      asset: mapAssetRow(existingAssets![0] as Record<string, unknown>),
      message: "That upload was already saved as an asset.",
    }
  }

  const bucket = typeof upload.bucket === "string" && upload.bucket.length > 0 ? upload.bucket : "public-bucket"
  const mimeType = typeof upload.mime_type === "string" ? upload.mime_type : "image/png"
  const assetType = inferAssetTypeFromMime(mimeType)
  const labelText = normalizePromptText(
    typeof upload.label === "string" && upload.label.length > 0
      ? upload.label
      : typeof upload.original_filename === "string"
        ? upload.original_filename
        : "",
  )
  const resolvedCategory = category ?? inferCategory(assetType, labelText)
  const resolvedDescription =
    typeof description === "string" && description.trim().length > 0
      ? description.trim()
      : buildAgentContextDescription({
          category: resolvedCategory,
          model: null,
          prompt: labelText,
          sourceLabel: "User upload",
          type: assetType,
        })
  const resolvedTitle =
    typeof title === "string" && title.trim().length > 0
      ? title.trim()
      : buildTitle({
          category: resolvedCategory,
          createdAt: String(upload.created_at),
          prompt: labelText,
          type: assetType,
        })
  const assetUrl = getPublicUrl(supabase, bucket, upload.storage_path)
  const thumbnailUrl = assetType === "image" ? assetUrl : null
  const resolvedTags =
    tags !== undefined
      ? normalizeTags(tags)
      : buildTags({
          aspectRatio: null,
          category: resolvedCategory,
          model: null,
          prompt: labelText,
          type: assetType,
        })

  const { data: createdAsset, error: insertError } = await supabase
    .from("assets")
    .insert({
      user_id: userId,
      upload_id: upload.id,
      source_generation_id: null,
      title: resolvedTitle,
      description: resolvedDescription,
      asset_type: assetType,
      category: resolvedCategory,
      visibility,
      tags: resolvedTags,
      asset_url: assetUrl,
      thumbnail_url: thumbnailUrl,
      supabase_storage_path: upload.storage_path,
      source_node_type: "chat-upload",
      metadata: {
        generatedAt: upload.created_at,
        mimeType,
        prompt: labelText,
        source: "upload",
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
}

async function saveGenerationAsAsset({
  supabase,
  userId,
  generationId,
  category,
  description,
  tags,
  title,
  visibility,
}: {
  supabase: SupabaseClient
  userId: string
  generationId: string
  category?: AssetCategory
  description?: string
  tags?: string[]
  title?: string
  visibility: AssetVisibility
}) {
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
      : buildAgentContextDescription({
          category: resolvedCategory,
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
  const assetUrl = getPublicUrl(supabase, "public-bucket", generation.supabase_storage_path)
  const thumbnailUrl = assetType === "image" ? assetUrl : null
  const resolvedTags =
    tags !== undefined
      ? normalizeTags(tags)
      : buildTags({
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
      tags: resolvedTags,
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
}
