import type { SupabaseClient } from "@supabase/supabase-js"
import {
  DEFAULT_STUDIO_VIEWPORT,
  type CreateStudioProjectInput,
  type StudioProject,
  type StudioViewport,
  type UpdateStudioProjectInput,
} from "@/lib/studio/types"

function normalizeViewport(raw: unknown): StudioViewport {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_STUDIO_VIEWPORT }
  const value = raw as Record<string, unknown>
  const x = typeof value.x === "number" && Number.isFinite(value.x) ? value.x : 0
  const y = typeof value.y === "number" && Number.isFinite(value.y) ? value.y : 0
  const zoom =
    typeof value.zoom === "number" && Number.isFinite(value.zoom) && value.zoom > 0
      ? value.zoom
      : 1
  return { x, y, zoom }
}

function mapProject(row: Record<string, unknown>): StudioProject {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: typeof row.name === "string" && row.name.trim() ? row.name : "Untitled Studio",
    thumbnail_url: typeof row.thumbnail_url === "string" ? row.thumbnail_url : null,
    viewport: normalizeViewport(row.viewport),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export async function listStudioProjects(
  supabase: SupabaseClient,
  userId: string,
): Promise<StudioProject[]> {
  const { data, error } = await supabase
    .from("studio_projects")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  if (error) {
    throw new Error(`Failed to list studio projects: ${error.message}`)
  }

  return (data ?? []).map((row) => mapProject(row as Record<string, unknown>))
}

export async function getStudioProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<StudioProject | null> {
  const { data, error } = await supabase
    .from("studio_projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load studio project: ${error.message}`)
  }

  return data ? mapProject(data as Record<string, unknown>) : null
}

export async function createStudioProject(
  supabase: SupabaseClient,
  userId: string,
  input: CreateStudioProjectInput = {},
): Promise<StudioProject> {
  const { data, error } = await supabase
    .from("studio_projects")
    .insert({
      user_id: userId,
      name: input.name?.trim() || "Untitled Studio",
      viewport: input.viewport ?? DEFAULT_STUDIO_VIEWPORT,
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(`Failed to create studio project: ${error?.message ?? "Unknown error"}`)
  }

  return mapProject(data as Record<string, unknown>)
}

export async function updateStudioProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  input: UpdateStudioProjectInput,
): Promise<StudioProject> {
  const patch: Record<string, unknown> = {}
  if (typeof input.name === "string") {
    patch.name = input.name.trim() || "Untitled Studio"
  }
  if (input.thumbnail_url !== undefined) {
    patch.thumbnail_url = input.thumbnail_url
  }
  if (input.viewport) {
    patch.viewport = normalizeViewport(input.viewport)
  }

  const { data, error } = await supabase
    .from("studio_projects")
    .update(patch)
    .eq("id", projectId)
    .eq("user_id", userId)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(`Failed to update studio project: ${error?.message ?? "Unknown error"}`)
  }

  return mapProject(data as Record<string, unknown>)
}

export async function deleteStudioProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<void> {
  const { error } = await supabase
    .from("studio_projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", userId)

  if (error) {
    throw new Error(`Failed to delete studio project: ${error.message}`)
  }
}

export async function assertStudioProjectOwned(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("studio_projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to verify studio project: ${error.message}`)
  }

  return Boolean(data)
}
