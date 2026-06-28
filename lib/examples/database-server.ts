import { createClient } from "@/lib/supabase/server"
import type {
  CreateSavedExampleInput,
  SavedExample,
  SavedExampleDefaultSettings,
  UpdateSavedExampleInput,
} from "@/lib/examples/types"
import { normalizeTemplateInputs } from "@/lib/templates/input-utils"
import type { TemplatePromptAttachment } from "@/lib/templates/types"

function normalizePromptAttachments(value: unknown): TemplatePromptAttachment[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      url: typeof item.url === "string" ? item.url : "",
      title: typeof item.title === "string" ? item.title : null,
    }))
    .filter((item) => item.url.length > 0)
}

function normalizeDefaultSettings(value: unknown): SavedExampleDefaultSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as SavedExampleDefaultSettings
}

function mapSavedExampleRow(row: Record<string, unknown>): SavedExample {
  return {
    id: String(row.id),
    creator_id: String(row.creator_id),
    surface: row.surface === "video" ? "video" : "image",
    title: typeof row.title === "string" ? row.title : "",
    description: typeof row.description === "string" ? row.description : "",
    prompt: typeof row.prompt === "string" ? row.prompt : "",
    prompt_attachments: normalizePromptAttachments(row.prompt_attachments),
    inputs: normalizeTemplateInputs(row.inputs),
    default_settings: normalizeDefaultSettings(row.default_settings),
    source_generation_id: typeof row.source_generation_id === "string" ? row.source_generation_id : null,
    cover_url: typeof row.cover_url === "string" ? row.cover_url : null,
    cover_kind: row.cover_kind === "video" ? "video" : "image",
    visibility: row.visibility === "public" ? "public" : "private",
    usage_count: typeof row.usage_count === "number" ? row.usage_count : Number(row.usage_count ?? 0) || 0,
    last_used_at: typeof row.last_used_at === "string" ? row.last_used_at : null,
    created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
  }
}

export async function createSavedExample(
  userId: string,
  input: CreateSavedExampleInput,
): Promise<SavedExample> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("saved_examples")
    .insert({
      creator_id: userId,
      surface: input.surface,
      title: input.title,
      description: input.description ?? "",
      prompt: input.prompt,
      prompt_attachments: input.prompt_attachments ?? [],
      inputs: input.inputs ?? [],
      default_settings: input.default_settings ?? {},
      source_generation_id: input.source_generation_id ?? null,
      cover_url: input.cover_url ?? null,
      cover_kind: input.cover_kind ?? "image",
      visibility: input.visibility ?? "private",
    })
    .select("*")
    .single()

  if (error) {
    console.error("Error creating saved example:", error)
    throw new Error(`Failed to create saved example: ${error.message}`)
  }

  return mapSavedExampleRow(data as Record<string, unknown>)
}

export async function updateSavedExample(
  exampleId: string,
  userId: string,
  input: UpdateSavedExampleInput,
): Promise<SavedExample> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("saved_examples")
    .select("creator_id")
    .eq("id", exampleId)
    .single()

  if (!existing || existing.creator_id !== userId) {
    throw new Error("Example not found or access denied")
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.surface !== undefined) updates.surface = input.surface
  if (input.title !== undefined) updates.title = input.title
  if (input.description !== undefined) updates.description = input.description
  if (input.prompt !== undefined) updates.prompt = input.prompt
  if (input.prompt_attachments !== undefined) updates.prompt_attachments = input.prompt_attachments
  if (input.inputs !== undefined) updates.inputs = input.inputs
  if (input.default_settings !== undefined) updates.default_settings = input.default_settings
  if (input.source_generation_id !== undefined) updates.source_generation_id = input.source_generation_id
  if (input.cover_url !== undefined) updates.cover_url = input.cover_url
  if (input.cover_kind !== undefined) updates.cover_kind = input.cover_kind
  if (input.visibility !== undefined) updates.visibility = input.visibility
  if (input.usage_count !== undefined) updates.usage_count = input.usage_count
  if (input.last_used_at !== undefined) updates.last_used_at = input.last_used_at

  const { data, error } = await supabase
    .from("saved_examples")
    .update(updates)
    .eq("id", exampleId)
    .select("*")
    .single()

  if (error) {
    console.error("Error updating saved example:", error)
    throw new Error(`Failed to update saved example: ${error.message}`)
  }

  return mapSavedExampleRow(data as Record<string, unknown>)
}

export async function deleteSavedExample(exampleId: string, userId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("saved_examples")
    .delete()
    .eq("id", exampleId)
    .eq("creator_id", userId)

  if (error) {
    console.error("Error deleting saved example:", error)
    throw new Error(`Failed to delete saved example: ${error.message}`)
  }
}

export async function getSavedExampleById(
  exampleId: string,
  userId?: string,
): Promise<SavedExample | null> {
  const supabase = await createClient()

  let query = supabase.from("saved_examples").select("*").eq("id", exampleId)

  if (userId) {
    query = query.or(`visibility.eq.public,creator_id.eq.${userId}`)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    console.error("Error fetching saved example:", error)
    throw new Error(`Failed to fetch saved example: ${error.message}`)
  }

  return data ? mapSavedExampleRow(data as Record<string, unknown>) : null
}

export async function listSavedExamplesForGallery(
  userId?: string | null,
  surface?: string,
  search?: string,
): Promise<SavedExample[]> {
  const supabase = await createClient()

  let query = supabase
    .from("saved_examples")
    .select("*")
    .order("updated_at", { ascending: false })

  if (userId) {
    query = query.or(`visibility.eq.public,creator_id.eq.${userId}`)
  } else {
    query = query.eq("visibility", "public")
  }

  if (surface && surface !== "all") {
    query = query.eq("surface", surface)
  }

  const trimmedSearch = search?.trim()
  if (trimmedSearch) {
    const safeSearch = trimmedSearch.replace(/[%_,()'":;]/g, " ").replace(/\s+/g, " ").trim()
    if (safeSearch) {
      query = query.or(
        `title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%,prompt.ilike.%${safeSearch}%`,
      )
    }
  }

  const { data, error } = await query

  if (error) {
    console.error("Error listing saved examples:", error)
    throw new Error(`Failed to list saved examples: ${error.message}`)
  }

  return ((data as Record<string, unknown>[]) ?? []).map(mapSavedExampleRow)
}
