import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  createSlideshowProjectSchema,
  slideshowCollectionImageSourceKindSchema,
  slideshowCollectionSchema,
  slideshowImportCandidateSchema,
  slideshowImportModeSchema,
  slideshowProjectHooksSchema,
  slideshowProjectSchema,
  slideshowProjectSlidesSchema,
  slideshowProviderSchema,
  slideshowProjectStatusSchema,
  type SlideshowCollection,
  type SlideshowHookOption,
  type SlideshowImportCandidate,
  type SlideshowImportMode,
  type SlideshowProject,
  type SlideshowProjectStatus,
  type SlideshowProvider,
  type SlideshowSlide,
} from "@/lib/slideshow/types"
import { resolveStoredObjectUrl } from "@/lib/uploads/server"

type CollectionRow = {
  id: string
  user_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

type CollectionImageRow = {
  id: string
  user_id: string
  collection_id: string
  title: string
  image_url: string
  thumbnail_url: string | null
  supabase_storage_path: string | null
  source_kind: string
  source_asset_id: string | null
  source_url: string | null
  source_query: string | null
  tags: string[] | null
  width: number | null
  height: number | null
  sort_order: number
  metadata: unknown
  created_at: string
  updated_at: string
}

type AssetRow = {
  id: string
  user_id: string
  title: string
  description: string | null
  asset_type: string
  asset_url: string
  thumbnail_url: string | null
  supabase_storage_path: string | null
  tags: string[] | null
  created_at: string
}

type UploadRow = {
  id: string
  bucket: string
  storage_path: string
  mime_type: string
  original_filename: string | null
}

type ImportJobRow = {
  id: string
  user_id: string
  target_collection_id: string
  mode: string
  query_or_url: string
  candidates: unknown
  created_at: string
  expires_at: string
}

type ProjectRow = {
  id: string
  user_id: string
  name: string
  provider: SlideshowProvider
  social_connection_id: string
  brand_kit_id: string | null
  status: SlideshowProjectStatus
  selected_hook: string | null
  hook_options: unknown
  slides: unknown
  autopost_job_id: string | null
  created_at: string
  updated_at: string
}

type CollectionImageInsert = {
  title: string
  image_url: string
  thumbnail_url?: string | null
  supabase_storage_path?: string | null
  source_kind: "upload" | "asset" | "pinterest" | "generated"
  source_asset_id?: string | null
  source_url?: string | null
  source_query?: string | null
  tags?: string[]
  width?: number | null
  height?: number | null
  metadata?: Record<string, unknown>
}

function normalizeTags(tags: string[]) {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0),
    ),
  ).slice(0, 20)
}

function inferCollectionTags(collection: Pick<CollectionRow, "name" | "description">) {
  return normalizeTags(
    `${collection.name} ${collection.description ?? ""}`
      .split(/[^a-zA-Z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3),
  ).slice(0, 8)
}

function formatImageTitle(fileName: string | null | undefined) {
  const value = (fileName ?? "").trim()
  if (!value) return "Slideshow image"
  const stripped = value.replace(/\.[^/.]+$/, "")
  const normalized = stripped.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim()
  return normalized || "Slideshow image"
}

function mapCollection(row: CollectionRow, itemRows: CollectionImageRow[]): SlideshowCollection {
  return slideshowCollectionSchema.parse({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    items: itemRows
      .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
      .map((item) => ({
        id: item.id,
        sourceKind: slideshowCollectionImageSourceKindSchema.parse(item.source_kind),
        sourceAssetId: item.source_asset_id,
        sourceUrl: item.source_url,
        sourceQuery: item.source_query,
        title: item.title,
        url: item.image_url,
        thumbnailUrl: item.thumbnail_url,
        tags: Array.isArray(item.tags) ? item.tags : [],
        width: item.width,
        height: item.height,
        sortOrder: item.sort_order,
        metadata:
          typeof item.metadata === "object" && item.metadata !== null && !Array.isArray(item.metadata)
            ? (item.metadata as Record<string, unknown>)
            : {},
        createdAt: item.created_at,
      })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}

function mapProject(row: ProjectRow): SlideshowProject {
  return slideshowProjectSchema.parse({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    provider: row.provider,
    socialConnectionId: row.social_connection_id,
    brandKitId: row.brand_kit_id,
    status: row.status,
    selectedHook: row.selected_hook,
    hookOptions: slideshowProjectHooksSchema.parse(Array.isArray(row.hook_options) ? row.hook_options : []),
    slides: slideshowProjectSlidesSchema.parse(Array.isArray(row.slides) ? row.slides : []),
    autopostJobId: row.autopost_job_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}

async function loadOwnedSocialConnection(
  supabase: SupabaseClient,
  userId: string,
  socialConnectionId: string,
) {
  const { data, error } = await supabase
    .from("social_connections")
    .select("id, provider")
    .eq("id", socialConnectionId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to verify social connection: ${error.message}`)
  }

  if (!data?.id || !slideshowProviderSchema.safeParse(data.provider).success) {
    throw new Error("Social connection not found.")
  }

  return {
    id: String(data.id),
    provider: slideshowProviderSchema.parse(data.provider),
  }
}

async function ensureOwnedBrandKit(
  supabase: SupabaseClient,
  userId: string,
  brandKitId: string | null,
) {
  if (!brandKitId) return null

  const { data, error } = await supabase
    .from("brand_kits")
    .select("id")
    .eq("id", brandKitId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to verify brand kit: ${error.message}`)
  }

  if (!data?.id) {
    throw new Error("Brand kit not found.")
  }

  return String(data.id)
}

async function ensureOwnedImageAssets(
  supabase: SupabaseClient,
  userId: string,
  assetIds: string[],
) {
  if (assetIds.length === 0) return []

  const { data, error } = await supabase
    .from("assets")
    .select("id, user_id, title, description, asset_type, asset_url, thumbnail_url, supabase_storage_path, tags, created_at")
    .eq("user_id", userId)
    .eq("asset_type", "image")
    .in("id", assetIds)

  if (error) {
    throw new Error(`Failed to verify slideshow assets: ${error.message}`)
  }

  const rows = (data ?? []) as AssetRow[]
  if (rows.length !== new Set(assetIds).size) {
    throw new Error("One or more image assets could not be used in a slideshow collection.")
  }

  const byId = new Map(rows.map((row) => [row.id, row]))
  return assetIds.map((assetId) => byId.get(assetId)!).filter(Boolean)
}

async function loadCollectionRows(
  supabase: SupabaseClient,
  userId: string,
  collectionIds?: string[],
) {
  let collectionsQuery = supabase
    .from("slideshow_collections")
    .select("id, user_id, name, description, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  if (Array.isArray(collectionIds) && collectionIds.length > 0) {
    collectionsQuery = collectionsQuery.in("id", collectionIds)
  }

  const { data: collectionsData, error: collectionsError } = await collectionsQuery
  if (collectionsError) {
    throw new Error(`Failed to load slideshow collections: ${collectionsError.message}`)
  }

  const collectionRows = (collectionsData ?? []) as CollectionRow[]
  if (collectionRows.length === 0) return []

  const collectionIdList = collectionRows.map((collection) => collection.id)
  const { data: itemData, error: itemError } = await supabase
    .from("slideshow_collection_images")
    .select("id, user_id, collection_id, title, image_url, thumbnail_url, supabase_storage_path, source_kind, source_asset_id, source_url, source_query, tags, width, height, sort_order, metadata, created_at, updated_at")
    .in("collection_id", collectionIdList)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (itemError) {
    throw new Error(`Failed to load slideshow collection images: ${itemError.message}`)
  }

  const itemRows = (itemData ?? []) as CollectionImageRow[]
  const itemsByCollection = new Map<string, CollectionImageRow[]>()

  for (const item of itemRows) {
    const current = itemsByCollection.get(item.collection_id)
    if (current) {
      current.push(item)
    } else {
      itemsByCollection.set(item.collection_id, [item])
    }
  }

  return collectionRows.map((row) => mapCollection(row, itemsByCollection.get(row.id) ?? []))
}

async function getOwnedCollectionRow(
  supabase: SupabaseClient,
  userId: string,
  collectionId: string,
) {
  const { data, error } = await supabase
    .from("slideshow_collections")
    .select("id, user_id, name, description, created_at, updated_at")
    .eq("id", collectionId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load slideshow collection: ${error.message}`)
  }

  return (data as CollectionRow | null) ?? null
}

async function getCollectionImageRows(
  supabase: SupabaseClient,
  collectionId: string,
) {
  const { data, error } = await supabase
    .from("slideshow_collection_images")
    .select("id, user_id, collection_id, title, image_url, thumbnail_url, supabase_storage_path, source_kind, source_asset_id, source_url, source_query, tags, width, height, sort_order, metadata, created_at, updated_at")
    .eq("collection_id", collectionId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) {
    throw new Error(`Failed to load slideshow collection images: ${error.message}`)
  }

  return (data ?? []) as CollectionImageRow[]
}

async function insertCollectionImages(
  supabase: SupabaseClient,
  userId: string,
  collection: CollectionRow,
  items: CollectionImageInsert[],
) {
  if (items.length === 0) {
    return getSlideshowCollectionById(supabase, userId, collection.id)
  }

  const existingRows = await getCollectionImageRows(supabase, collection.id)
  const existingStoragePaths = new Set(
    existingRows
      .map((row) => row.supabase_storage_path)
      .filter((value): value is string => typeof value === "string" && value.length > 0),
  )
  const existingAssetIds = new Set(
    existingRows
      .map((row) => row.source_asset_id)
      .filter((value): value is string => typeof value === "string" && value.length > 0),
  )

  const baseSortOrder =
    existingRows.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1

  const rowsToInsert = items.flatMap((item, index) => {
    if (item.supabase_storage_path && existingStoragePaths.has(item.supabase_storage_path)) {
      return []
    }
    if (item.source_asset_id && existingAssetIds.has(item.source_asset_id)) {
      return []
    }

    if (item.supabase_storage_path) existingStoragePaths.add(item.supabase_storage_path)
    if (item.source_asset_id) existingAssetIds.add(item.source_asset_id)

    return [
      {
        user_id: userId,
        collection_id: collection.id,
        title: item.title.trim() || "Slideshow image",
        image_url: item.image_url,
        thumbnail_url: item.thumbnail_url ?? null,
        supabase_storage_path: item.supabase_storage_path ?? null,
        source_kind: item.source_kind,
        source_asset_id: item.source_asset_id ?? null,
        source_url: item.source_url ?? null,
        source_query: item.source_query ?? null,
        tags: normalizeTags(item.tags ?? inferCollectionTags(collection)),
        width: item.width ?? null,
        height: item.height ?? null,
        sort_order: baseSortOrder + index,
        metadata: item.metadata ?? {},
      },
    ]
  })

  if (rowsToInsert.length > 0) {
    const { error } = await supabase.from("slideshow_collection_images").insert(rowsToInsert)
    if (error) {
      throw new Error(`Failed to save slideshow collection images: ${error.message}`)
    }
  }

  return getSlideshowCollectionById(supabase, userId, collection.id)
}

export async function listSlideshowCollections(
  supabase: SupabaseClient,
  userId: string,
) {
  return loadCollectionRows(supabase, userId)
}

export async function getSlideshowCollectionById(
  supabase: SupabaseClient,
  userId: string,
  collectionId: string,
) {
  const collections = await loadCollectionRows(supabase, userId, [collectionId])
  return collections[0] ?? null
}

export async function createSlideshowCollection(
  supabase: SupabaseClient,
  userId: string,
  input: {
    name: string
    description?: string | null
  },
) {
  const { data, error } = await supabase
    .from("slideshow_collections")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
    })
    .select("id")
    .single()

  if (error || !data?.id) {
    throw new Error(error?.message || "Failed to create slideshow collection.")
  }

  const created = await getSlideshowCollectionById(supabase, userId, String(data.id))
  if (!created) {
    throw new Error("Created slideshow collection could not be loaded.")
  }
  return created
}

export async function updateSlideshowCollection(
  supabase: SupabaseClient,
  userId: string,
  collectionId: string,
  input: {
    name?: string
    description?: string | null
    itemIds?: string[]
  },
) {
  const existing = await getOwnedCollectionRow(supabase, userId, collectionId)
  if (!existing) {
    throw new Error("Slideshow collection not found.")
  }

  const updates: Record<string, unknown> = {}
  if (input.name !== undefined) updates.name = input.name.trim()
  if (input.description !== undefined) updates.description = input.description?.trim() || null

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from("slideshow_collections")
      .update(updates)
      .eq("id", collectionId)
      .eq("user_id", userId)

    if (error) {
      throw new Error(`Failed to update slideshow collection: ${error.message}`)
    }
  }

  if (input.itemIds !== undefined) {
    const existingItems = await getCollectionImageRows(supabase, collectionId)
    const existingIds = new Set(existingItems.map((item) => item.id))
    const normalizedItemIds = Array.from(new Set(input.itemIds))

    if (!normalizedItemIds.every((itemId) => existingIds.has(itemId))) {
      throw new Error("One or more collection images could not be updated.")
    }

    const removedIds = existingItems
      .map((item) => item.id)
      .filter((itemId) => !normalizedItemIds.includes(itemId))

    if (removedIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("slideshow_collection_images")
        .delete()
        .eq("collection_id", collectionId)
        .in("id", removedIds)

      if (deleteError) {
        throw new Error(`Failed to remove slideshow collection images: ${deleteError.message}`)
      }
    }

    for (let index = 0; index < normalizedItemIds.length; index += 1) {
      const itemId = normalizedItemIds[index]
      const { error: updateError } = await supabase
        .from("slideshow_collection_images")
        .update({ sort_order: index })
        .eq("collection_id", collectionId)
        .eq("id", itemId)

      if (updateError) {
        throw new Error(`Failed to reorder slideshow collection images: ${updateError.message}`)
      }
    }
  }

  const updated = await getSlideshowCollectionById(supabase, userId, collectionId)
  if (!updated) {
    throw new Error("Updated slideshow collection could not be loaded.")
  }
  return updated
}

export async function appendUploadedImagesToCollection(
  supabase: SupabaseClient,
  userId: string,
  collectionId: string,
  uploads: Array<{ uploadId: string; title?: string }>,
) {
  const collection = await getOwnedCollectionRow(supabase, userId, collectionId)
  if (!collection) {
    throw new Error("Slideshow collection not found.")
  }

  const uploadIds = Array.from(new Set(uploads.map((upload) => upload.uploadId)))
  const { data, error } = await supabase
    .from("uploads")
    .select("id, bucket, storage_path, mime_type, original_filename")
    .eq("user_id", userId)
    .in("id", uploadIds)

  if (error) {
    throw new Error(`Failed to verify uploaded images: ${error.message}`)
  }

  const uploadRows = (data ?? []) as UploadRow[]
  if (uploadRows.length !== uploadIds.length) {
    throw new Error("One or more uploads could not be used in the collection.")
  }

  const byId = new Map(uploadRows.map((row) => [row.id, row]))
  const storageClient = createServiceRoleClient() ?? supabase
  const rows: CollectionImageInsert[] = []

  for (const upload of uploads) {
    const row = byId.get(upload.uploadId)
    if (!row || !row.mime_type.startsWith("image/")) {
      throw new Error("Only image uploads can be added to slideshow collections.")
    }

    rows.push({
      title: upload.title?.trim() || formatImageTitle(row.original_filename),
      image_url: await resolveStoredObjectUrl(storageClient, row.bucket, row.storage_path),
      thumbnail_url: null,
      supabase_storage_path: row.storage_path,
      source_kind: "upload",
      tags: inferCollectionTags(collection),
      metadata: {
        uploadId: row.id,
      },
    })
  }

  const updated = await insertCollectionImages(supabase, userId, collection, rows)
  if (!updated) {
    throw new Error("Updated slideshow collection could not be loaded.")
  }
  return updated
}

export async function appendAssetCopiesToCollection(
  supabase: SupabaseClient,
  userId: string,
  collectionId: string,
  assetIds: string[],
) {
  const collection = await getOwnedCollectionRow(supabase, userId, collectionId)
  if (!collection) {
    throw new Error("Slideshow collection not found.")
  }

  const assets = await ensureOwnedImageAssets(supabase, userId, Array.from(new Set(assetIds)))
  const rows: CollectionImageInsert[] = assets.map((asset) => ({
    title: asset.title,
    image_url: asset.asset_url,
    thumbnail_url: asset.thumbnail_url,
    supabase_storage_path: asset.supabase_storage_path,
    source_kind: "asset",
    source_asset_id: asset.id,
    source_url: asset.asset_url,
    tags: Array.isArray(asset.tags) ? asset.tags : [],
    metadata: {
      assetDescription: asset.description,
      copiedAt: new Date().toISOString(),
    },
  }))

  const updated = await insertCollectionImages(supabase, userId, collection, rows)
  if (!updated) {
    throw new Error("Updated slideshow collection could not be loaded.")
  }
  return updated
}

export async function appendPinterestImagesToCollection(
  supabase: SupabaseClient,
  userId: string,
  collectionId: string,
  images: Array<{
    title: string
    imageUrl: string
    thumbnailUrl?: string | null
    supabaseStoragePath?: string | null
    sourceUrl: string
    sourceQuery: string
    width?: number | null
    height?: number | null
    tags?: string[]
    metadata?: Record<string, unknown>
  }>,
) {
  const collection = await getOwnedCollectionRow(supabase, userId, collectionId)
  if (!collection) {
    throw new Error("Slideshow collection not found.")
  }

  const rows: CollectionImageInsert[] = images.map((image) => ({
    title: image.title,
    image_url: image.imageUrl,
    thumbnail_url: image.thumbnailUrl ?? null,
    supabase_storage_path: image.supabaseStoragePath ?? null,
    source_kind: "pinterest",
    source_url: image.sourceUrl,
    source_query: image.sourceQuery,
    width: image.width ?? null,
    height: image.height ?? null,
    tags: normalizeTags(image.tags ?? [collection.name, image.sourceQuery]),
    metadata: image.metadata ?? {},
  }))

  const updated = await insertCollectionImages(supabase, userId, collection, rows)
  if (!updated) {
    throw new Error("Updated slideshow collection could not be loaded.")
  }
  return updated
}

export async function deleteSlideshowCollection(
  supabase: SupabaseClient,
  userId: string,
  collectionId: string,
) {
  const { error } = await supabase
    .from("slideshow_collections")
    .delete()
    .eq("id", collectionId)
    .eq("user_id", userId)

  if (error) {
    throw new Error(`Failed to delete slideshow collection: ${error.message}`)
  }
}

export async function createSlideshowCollectionImportJob(
  supabase: SupabaseClient,
  userId: string,
  input: {
    collectionId: string
    mode: SlideshowImportMode
    queryOrUrl: string
    candidates: SlideshowImportCandidate[]
  },
) {
  const collection = await getOwnedCollectionRow(supabase, userId, input.collectionId)
  if (!collection) {
    throw new Error("Slideshow collection not found.")
  }

  const { data, error } = await supabase
    .from("slideshow_collection_import_jobs")
    .insert({
      user_id: userId,
      target_collection_id: input.collectionId,
      mode: input.mode,
      query_or_url: input.queryOrUrl,
      candidates: input.candidates,
    })
    .select("id, user_id, target_collection_id, mode, query_or_url, candidates, created_at, expires_at")
    .single()

  if (error || !data) {
    throw new Error(error?.message || "Failed to create slideshow import preview.")
  }

  return {
    id: String(data.id),
    userId: String(data.user_id),
    targetCollectionId: String(data.target_collection_id),
    mode: slideshowImportModeSchema.parse(data.mode),
    queryOrUrl: String(data.query_or_url),
    candidates: z.array(slideshowImportCandidateSchema).parse(data.candidates),
    createdAt: String(data.created_at),
    expiresAt: String(data.expires_at),
  }
}

export async function getSlideshowCollectionImportJobById(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
) {
  const { data, error } = await supabase
    .from("slideshow_collection_import_jobs")
    .select("id, user_id, target_collection_id, mode, query_or_url, candidates, created_at, expires_at")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load slideshow import preview: ${error.message}`)
  }

  if (!data) return null

  const row = data as ImportJobRow
  return {
    id: row.id,
    userId: row.user_id,
    targetCollectionId: row.target_collection_id,
    mode: slideshowImportModeSchema.parse(row.mode),
    queryOrUrl: row.query_or_url,
    candidates: z.array(slideshowImportCandidateSchema).parse(row.candidates),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }
}

export async function deleteSlideshowCollectionImportJob(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
) {
  const { error } = await supabase
    .from("slideshow_collection_import_jobs")
    .delete()
    .eq("id", jobId)
    .eq("user_id", userId)

  if (error) {
    throw new Error(`Failed to delete slideshow import preview: ${error.message}`)
  }
}

export async function listSlideshowProjects(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("slideshow_projects")
    .select("id, user_id, name, provider, social_connection_id, brand_kit_id, status, selected_hook, hook_options, slides, autopost_job_id, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  if (error) {
    throw new Error(`Failed to load slideshow projects: ${error.message}`)
  }

  return ((data ?? []) as ProjectRow[]).map(mapProject)
}

export async function getSlideshowProjectById(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
) {
  const { data, error } = await supabase
    .from("slideshow_projects")
    .select("id, user_id, name, provider, social_connection_id, brand_kit_id, status, selected_hook, hook_options, slides, autopost_job_id, created_at, updated_at")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load slideshow project: ${error.message}`)
  }

  return data ? mapProject(data as ProjectRow) : null
}

export async function createSlideshowProject(
  supabase: SupabaseClient,
  userId: string,
  input: z.infer<typeof createSlideshowProjectSchema>,
) {
  const connection = await loadOwnedSocialConnection(supabase, userId, input.socialConnectionId)
  const brandKitId = await ensureOwnedBrandKit(supabase, userId, input.brandKitId)
  const name = input.name?.trim() || "Legacy slideshow"

  const { data, error } = await supabase
    .from("slideshow_projects")
    .insert({
      user_id: userId,
      name,
      provider: connection.provider,
      social_connection_id: connection.id,
      brand_kit_id: brandKitId,
      status: "draft",
      hook_options: [],
      slides: [],
    })
    .select("id, user_id, name, provider, social_connection_id, brand_kit_id, status, selected_hook, hook_options, slides, autopost_job_id, created_at, updated_at")
    .single()

  if (error || !data) {
    throw new Error(error?.message || "Failed to create slideshow project.")
  }

  return mapProject(data as ProjectRow)
}

export async function updateSlideshowProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  input: {
    name?: string
    socialConnectionId?: string
    brandKitId?: string | null
    selectedHook?: string | null
    hookOptions?: SlideshowHookOption[]
    slides?: SlideshowSlide[]
    status?: SlideshowProjectStatus
    autopostJobId?: string | null
  },
) {
  const existing = await getSlideshowProjectById(supabase, userId, projectId)
  if (!existing) {
    throw new Error("Slideshow project not found.")
  }

  const updates: Record<string, unknown> = {}

  if (input.name !== undefined) updates.name = input.name.trim()

  if (input.socialConnectionId !== undefined) {
    const connection = await loadOwnedSocialConnection(supabase, userId, input.socialConnectionId)
    updates.social_connection_id = connection.id
    updates.provider = connection.provider
  }

  if (input.brandKitId !== undefined) {
    updates.brand_kit_id = await ensureOwnedBrandKit(supabase, userId, input.brandKitId)
  }

  if (input.selectedHook !== undefined) {
    updates.selected_hook = input.selectedHook?.trim() || null
  }

  if (input.hookOptions !== undefined) {
    updates.hook_options = slideshowProjectHooksSchema.parse(input.hookOptions)
  }

  if (input.slides !== undefined) {
    updates.slides = slideshowProjectSlidesSchema.parse(input.slides)
  }

  if (input.status !== undefined) {
    updates.status = slideshowProjectStatusSchema.parse(input.status)
  }

  if (input.autopostJobId !== undefined) {
    updates.autopost_job_id = input.autopostJobId
  }

  if (Object.keys(updates).length === 0) {
    return existing
  }

  const { data, error } = await supabase
    .from("slideshow_projects")
    .update(updates)
    .eq("id", projectId)
    .eq("user_id", userId)
    .select("id, user_id, name, provider, social_connection_id, brand_kit_id, status, selected_hook, hook_options, slides, autopost_job_id, created_at, updated_at")
    .single()

  if (error || !data) {
    throw new Error(error?.message || "Failed to update slideshow project.")
  }

  return mapProject(data as ProjectRow)
}

export function applySlideUpdate(
  slides: SlideshowSlide[],
  update: {
    index: number
    overlayText?: string
    collectionId?: string
    collectionImageId?: string
    assetId?: string
    assetUrl?: string
    selectionMode?: "random" | "first" | "manual"
    narrativeRole?: string | null
    notes?: string | null
  },
) {
  const nextSlides = slides.map((slide) => ({ ...slide }))
  const current = nextSlides.find((slide) => slide.index === update.index)
  if (!current) {
    throw new Error("Slide not found.")
  }

  if (update.overlayText !== undefined) current.overlayText = update.overlayText
  if (update.collectionId !== undefined) current.collectionId = update.collectionId
  if (update.collectionImageId !== undefined) {
    current.collectionImageId = update.collectionImageId
  } else if (update.assetId !== undefined) {
    current.collectionImageId = update.assetId
  }
  if (update.assetUrl !== undefined) current.assetUrl = update.assetUrl
  if (update.selectionMode !== undefined) current.selectionMode = update.selectionMode
  if (update.narrativeRole !== undefined) current.narrativeRole = update.narrativeRole
  if (update.notes !== undefined) current.notes = update.notes

  return slideshowProjectSlidesSchema.parse(nextSlides)
}
