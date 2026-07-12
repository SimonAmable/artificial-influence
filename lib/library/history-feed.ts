import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveStoredObjectUrl } from "@/lib/uploads/resolve-stored-object-url"

export type HistoryFeedMediaType = "image" | "video" | "audio"
export type HistoryFeedSourceFilter = "all" | "generation" | "upload"
export type HistoryFeedItemSource = "generation" | "upload"

export type HistoryFeedItem = {
  id: string
  user_id: string
  prompt: string | null
  supabase_storage_path: string
  type: HistoryFeedMediaType
  model: string | null
  tool: string | null
  aspect_ratio: string | null
  created_at: string
  url: string
  reference_image_urls: string[]
  source: HistoryFeedItemSource
  uploadId?: string
}

type GenerationRow = {
  id: string
  user_id: string
  prompt: string | null
  supabase_storage_path: string | null
  type: HistoryFeedMediaType
  model: string | null
  tool: string | null
  aspect_ratio: string | null
  created_at: string
  reference_images_supabase_storage_path: string[] | null
  status: string | null
}

type UploadRow = {
  id: string
  user_id: string
  bucket: string
  storage_path: string
  mime_type: string
  label: string | null
  original_filename: string | null
  source: string
  created_at: string
}

function normalizeSearch(rawSearch: string) {
  return rawSearch.trim().replace(/\s+/g, " ").slice(0, 120)
}

function escapeIlikePattern(value: string) {
  return value
    .replace(/[\\%_]/g, (match) => `\\${match}`)
    .replace(/[,()]/g, " ")
}

function applyGenerationSearchFilter<T extends { or: (filters: string) => T }>(query: T, rawSearch: string) {
  const search = normalizeSearch(rawSearch)
  if (!search) return query

  const pattern = `%${escapeIlikePattern(search)}%`
  return query.or(
    [`prompt.ilike.${pattern}`, `model.ilike.${pattern}`, `tool.ilike.${pattern}`, `type.ilike.${pattern}`].join(
      ","
    )
  )
}

function applyUploadSearchFilter<T extends { or: (filters: string) => T }>(query: T, rawSearch: string) {
  const search = normalizeSearch(rawSearch)
  if (!search) return query

  const pattern = `%${escapeIlikePattern(search)}%`
  return query.or(
    [
      `label.ilike.${pattern}`,
      `original_filename.ilike.${pattern}`,
      `source.ilike.${pattern}`,
      `mime_type.ilike.${pattern}`,
    ].join(",")
  )
}

export function mediaTypeFromMime(mimeType: string): HistoryFeedMediaType | null {
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType.startsWith("video/")) return "video"
  if (mimeType.startsWith("audio/")) return "audio"
  return null
}

function mimePrefixForType(type: HistoryFeedMediaType) {
  switch (type) {
    case "image":
      return "image/%"
    case "video":
      return "video/%"
    case "audio":
      return "audio/%"
    default: {
      const _exhaustive: never = type
      return _exhaustive
    }
  }
}

function mapGenerationRow(
  supabase: SupabaseClient,
  generation: GenerationRow
): HistoryFeedItem | null {
  const path = generation.supabase_storage_path
  if (!path) return null

  const url = supabase.storage.from("public-bucket").getPublicUrl(path).data.publicUrl
  const referencePaths = generation.reference_images_supabase_storage_path ?? []
  const reference_image_urls = referencePaths
    .filter((p): p is string => typeof p === "string" && p.length > 0)
    .map((p) => supabase.storage.from("public-bucket").getPublicUrl(p).data.publicUrl)

  return {
    id: generation.id,
    user_id: generation.user_id,
    prompt: generation.prompt,
    supabase_storage_path: path,
    type: generation.type,
    model: generation.model,
    tool: generation.tool ?? null,
    aspect_ratio: generation.aspect_ratio ?? null,
    created_at: generation.created_at,
    url,
    reference_image_urls,
    source: "generation",
  }
}

async function mapUploadRow(supabase: SupabaseClient, upload: UploadRow): Promise<HistoryFeedItem | null> {
  const type = mediaTypeFromMime(upload.mime_type)
  if (!type) return null

  const url = await resolveStoredObjectUrl(supabase, upload.bucket, upload.storage_path)
  const prompt =
    upload.label?.trim() ||
    upload.original_filename?.trim() ||
    `Upload (${upload.source})`

  return {
    id: upload.id,
    user_id: upload.user_id,
    prompt,
    supabase_storage_path: upload.storage_path,
    type,
    model: null,
    tool: "upload",
    aspect_ratio: null,
    created_at: upload.created_at,
    url,
    reference_image_urls: [],
    source: "upload",
    uploadId: upload.id,
  }
}

type ListHistoryOptions = {
  userId: string
  type?: HistoryFeedMediaType | null
  tool?: string | null
  source?: HistoryFeedSourceFilter
  search?: string
  limit: number
  offset: number
  includePending?: boolean
  excludeFailed?: boolean
}

async function countGenerations(
  supabase: SupabaseClient,
  options: ListHistoryOptions
): Promise<number> {
  let countQuery = supabase
    .from("generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", options.userId)

  if (options.type) {
    countQuery = countQuery.eq("type", options.type)
  }
  if (options.tool) {
    countQuery = countQuery.eq("tool", options.tool)
  }
  countQuery = applyGenerationSearchFilter(countQuery, options.search ?? "")

  if (!options.includePending) {
    countQuery = countQuery.neq("status", "pending")
    countQuery = countQuery.not("supabase_storage_path", "is", null).neq("supabase_storage_path", "")
  }
  if (options.excludeFailed !== false) {
    countQuery = countQuery.neq("status", "failed")
  }

  const { count, error } = await countQuery
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function countUploads(supabase: SupabaseClient, options: ListHistoryOptions): Promise<number> {
  let countQuery = supabase
    .from("uploads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", options.userId)
    .not("storage_path", "is", null)
    .neq("storage_path", "")

  if (options.type) {
    countQuery = countQuery.like("mime_type", mimePrefixForType(options.type))
  } else {
    countQuery = countQuery.or("mime_type.like.image/%,mime_type.like.video/%,mime_type.like.audio/%")
  }

  countQuery = applyUploadSearchFilter(countQuery, options.search ?? "")

  const { count, error } = await countQuery
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function fetchGenerationsPage(
  supabase: SupabaseClient,
  options: ListHistoryOptions,
  rangeStart: number,
  rangeEnd: number
): Promise<HistoryFeedItem[]> {
  let query = supabase
    .from("generations")
    .select(
      "id, user_id, prompt, supabase_storage_path, type, model, tool, aspect_ratio, created_at, reference_images_supabase_storage_path, status"
    )
    .eq("user_id", options.userId)
    .order("created_at", { ascending: false })
    .range(rangeStart, rangeEnd)

  if (options.type) {
    query = query.eq("type", options.type)
  }
  if (options.tool) {
    query = query.eq("tool", options.tool)
  }
  query = applyGenerationSearchFilter(query, options.search ?? "")

  if (!options.includePending) {
    query = query.neq("status", "pending")
    query = query.not("supabase_storage_path", "is", null).neq("supabase_storage_path", "")
  }
  if (options.excludeFailed !== false) {
    query = query.neq("status", "failed")
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data as GenerationRow[] | null ?? [])
    .map((row) => mapGenerationRow(supabase, row))
    .filter((item): item is HistoryFeedItem => item != null)
}

async function fetchUploadsPage(
  supabase: SupabaseClient,
  options: ListHistoryOptions,
  rangeStart: number,
  rangeEnd: number
): Promise<HistoryFeedItem[]> {
  let query = supabase
    .from("uploads")
    .select(
      "id, user_id, bucket, storage_path, mime_type, label, original_filename, source, created_at"
    )
    .eq("user_id", options.userId)
    .not("storage_path", "is", null)
    .neq("storage_path", "")
    .order("created_at", { ascending: false })
    .range(rangeStart, rangeEnd)

  if (options.type) {
    query = query.like("mime_type", mimePrefixForType(options.type))
  } else {
    query = query.or("mime_type.like.image/%,mime_type.like.video/%,mime_type.like.audio/%")
  }

  query = applyUploadSearchFilter(query, options.search ?? "")

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const mapped = await Promise.all(
    (data as UploadRow[] | null ?? []).map((row) => mapUploadRow(supabase, row))
  )
  return mapped.filter((item): item is HistoryFeedItem => item != null)
}

function shouldIncludeUploads(source: HistoryFeedSourceFilter, tool: string | null | undefined) {
  if (source === "generation") return false
  // Tool filters only apply to generations.
  if (tool) return false
  return true
}

function shouldIncludeGenerations(source: HistoryFeedSourceFilter) {
  return source !== "upload"
}

export async function listHistoryFeed(supabase: SupabaseClient, options: ListHistoryOptions) {
  const source = options.source ?? "all"
  const tool = options.tool?.trim() || null
  const includeGenerations = shouldIncludeGenerations(source)
  const includeUploads = shouldIncludeUploads(source, tool)
  const { limit, offset } = options

  if (includeGenerations && !includeUploads) {
    const [items, total] = await Promise.all([
      fetchGenerationsPage(supabase, { ...options, tool }, offset, offset + limit - 1),
      countGenerations(supabase, { ...options, tool }),
    ])
    return {
      items,
      pagination: {
        limit,
        offset,
        returned: items.length,
        total,
        hasMore: offset + items.length < total,
      },
    }
  }

  if (includeUploads && !includeGenerations) {
    const [items, total] = await Promise.all([
      fetchUploadsPage(supabase, options, offset, offset + limit - 1),
      countUploads(supabase, options),
    ])
    return {
      items,
      pagination: {
        limit,
        offset,
        returned: items.length,
        total,
        hasMore: offset + items.length < total,
      },
    }
  }

  const fetchCap = offset + limit
  const [generationItems, uploadItems, generationTotal, uploadTotal] = await Promise.all([
    fetchGenerationsPage(supabase, { ...options, tool }, 0, fetchCap - 1),
    fetchUploadsPage(supabase, options, 0, fetchCap - 1),
    countGenerations(supabase, { ...options, tool }),
    countUploads(supabase, options),
  ])

  const merged = [...generationItems, ...uploadItems].sort((a, b) => {
    const aTime = new Date(a.created_at).getTime()
    const bTime = new Date(b.created_at).getTime()
    return bTime - aTime
  })

  const items = merged.slice(offset, offset + limit)
  const total = generationTotal + uploadTotal

  return {
    items,
    pagination: {
      limit,
      offset,
      returned: items.length,
      total,
      hasMore: offset + items.length < total,
    },
  }
}
