import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import {
  createSlideshowProjectSchema,
  slideshowCollectionSchema,
  slideshowProjectHooksSchema,
  slideshowProjectSchema,
  slideshowProjectSlidesSchema,
  slideshowProviderSchema,
  slideshowProjectStatusSchema,
  type SlideshowCollection,
  type SlideshowHookOption,
  type SlideshowProject,
  type SlideshowProjectStatus,
  type SlideshowProvider,
  type SlideshowSlide,
} from "@/lib/slideshow/types"

type CollectionRow = {
  id: string
  user_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

type CollectionItemRow = {
  id: string
  collection_id: string
  asset_id: string
  sort_order: number
  created_at: string
}

type AssetRow = {
  id: string
  user_id: string
  title: string
  asset_type: string
  asset_url: string
  thumbnail_url: string | null
  tags: string[] | null
  created_at: string
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

function mapCollection(
  row: CollectionRow,
  itemRows: CollectionItemRow[],
  assetsById: Map<string, AssetRow>,
): SlideshowCollection {
  return slideshowCollectionSchema.parse({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    items: itemRows
      .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
      .flatMap((item) => {
        const asset = assetsById.get(item.asset_id)
        if (!asset) return []
        return [
          {
            id: item.id,
            assetId: item.asset_id,
            title: asset.title,
            url: asset.asset_url,
            thumbnailUrl: asset.thumbnail_url,
            tags: Array.isArray(asset.tags) ? asset.tags : [],
            sortOrder: item.sort_order,
            createdAt: asset.created_at,
          },
        ]
      }),
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
    .select("id, user_id, title, asset_type, asset_url, thumbnail_url, tags, created_at")
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

  return rows
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
    .from("slideshow_collection_items")
    .select("id, collection_id, asset_id, sort_order, created_at")
    .in("collection_id", collectionIdList)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (itemError) {
    throw new Error(`Failed to load slideshow collection items: ${itemError.message}`)
  }

  const itemRows = (itemData ?? []) as CollectionItemRow[]
  const assetIds = Array.from(new Set(itemRows.map((item) => item.asset_id)))

  const { data: assetData, error: assetError } = assetIds.length
    ? await supabase
        .from("assets")
        .select("id, user_id, title, asset_type, asset_url, thumbnail_url, tags, created_at")
        .eq("user_id", userId)
        .eq("asset_type", "image")
        .in("id", assetIds)
    : { data: [], error: null }

  if (assetError) {
    throw new Error(`Failed to load slideshow collection assets: ${assetError.message}`)
  }

  const assetsById = new Map(((assetData ?? []) as AssetRow[]).map((asset) => [asset.id, asset]))
  const itemsByCollection = new Map<string, CollectionItemRow[]>()

  for (const item of itemRows) {
    const current = itemsByCollection.get(item.collection_id)
    if (current) {
      current.push(item)
    } else {
      itemsByCollection.set(item.collection_id, [item])
    }
  }

  return collectionRows.map((row) => mapCollection(row, itemsByCollection.get(row.id) ?? [], assetsById))
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
    assetIds?: string[]
  },
) {
  const normalizedAssetIds = Array.from(new Set(input.assetIds ?? []))
  await ensureOwnedImageAssets(supabase, userId, normalizedAssetIds)

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

  if (normalizedAssetIds.length > 0) {
    const { error: itemError } = await supabase.from("slideshow_collection_items").insert(
      normalizedAssetIds.map((assetId, index) => ({
        collection_id: data.id,
        asset_id: assetId,
        sort_order: index,
      })),
    )

    if (itemError) {
      throw new Error(`Failed to save slideshow collection items: ${itemError.message}`)
    }
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
    assetIds?: string[]
  },
) {
  const existing = await getSlideshowCollectionById(supabase, userId, collectionId)
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

  if (input.assetIds !== undefined) {
    const normalizedAssetIds = Array.from(new Set(input.assetIds))
    await ensureOwnedImageAssets(supabase, userId, normalizedAssetIds)

    const { error: deleteError } = await supabase
      .from("slideshow_collection_items")
      .delete()
      .eq("collection_id", collectionId)

    if (deleteError) {
      throw new Error(`Failed to refresh slideshow collection items: ${deleteError.message}`)
    }

    if (normalizedAssetIds.length > 0) {
      const { error: insertError } = await supabase.from("slideshow_collection_items").insert(
        normalizedAssetIds.map((assetId, index) => ({
          collection_id: collectionId,
          asset_id: assetId,
          sort_order: index,
        })),
      )

      if (insertError) {
        throw new Error(`Failed to save slideshow collection items: ${insertError.message}`)
      }
    }
  }

  const updated = await getSlideshowCollectionById(supabase, userId, collectionId)
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
  const name = input.name?.trim() || "Hook Slideshow"

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
  if (update.assetId !== undefined) current.assetId = update.assetId
  if (update.assetUrl !== undefined) current.assetUrl = update.assetUrl
  if (update.selectionMode !== undefined) current.selectionMode = update.selectionMode
  if (update.narrativeRole !== undefined) current.narrativeRole = update.narrativeRole
  if (update.notes !== undefined) current.notes = update.notes

  return slideshowProjectSlidesSchema.parse(nextSlides)
}
